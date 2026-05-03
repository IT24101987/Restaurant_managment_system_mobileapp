import Order from "../models/order.js";
import Dish from "../models/dish.js";
import Payment from "../models/payment.js";
import DiningTable from "../models/diningTable.js";
import {
  ACTIVE_TABLE_STATUSES,
  DEFAULT_RESERVATION_MINUTES,
  buildReservationWindow,
  deriveReservationStart,
  expireTableReservations,
  normalizeTimeLabel
} from "../utils/reservation.js";
const ALLOWED_SEAT_COUNTS = [1, 2, 3, 4, 6, 8];
const DELIVERY_FEE = 250;
const TABLE_BOOKING_FEE = 250;

//GET ALL ORDERS 

export async function listOrders(req, res) {
  try {
    await expireTableReservations();
    const orders = await Order.find()
      .populate("tableId", "tableNo seats")
      .sort({ createdAt: -1 });

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}


   //GET ORDER BY ID

export async function getOrderById(req, res) {
  try {
    const order = await Order.findById(req.params.id)
      .populate("tableId", "tableNo seats");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}


   //CREATE ORDER

export async function createOrder(req, res) {
  try {
    const {
      orderType,
      timeSlotLabel,
      tableId,
      seatCount,
      customerName,
      phone,
      deliveryAddress,
      paymentMethod,
      items,
      reservationDate,
      reservationTime,
      reservationStart,
      reservationDurationMin,
      isManualBooking
    } = req.body;
    const normalizedCustomerName = String(customerName || "").trim();
    const normalizedPhone = String(phone || "").replace(/\D/g, "");
    const normalizedPaymentMethod = String(paymentMethod || "cash").toLowerCase();
    const normalizedOrderType = String(orderType || "").toLowerCase();
    const isManualTableBooking =
      Boolean(isManualBooking) && normalizedOrderType === "table";
    const initialPaymentStatus =
      (normalizedOrderType === "delivery" || normalizedOrderType === "table" || isManualTableBooking) &&
      normalizedPaymentMethod === "card"
        ? "paid"
        : "unpaid";

    // Basic validation
    if (!orderType || !timeSlotLabel) {
      return res.status(400).json({
        message: "orderType and timeSlotLabel are required"
      });
    }
    if (!normalizedCustomerName) {
      return res.status(400).json({ message: "customerName is required" });
    }
    if (!/^\d{10}$/.test(normalizedPhone)) {
      return res.status(400).json({ message: "phone must be exactly 10 digits" });
    }
    if (!["cash", "card"].includes(normalizedPaymentMethod)) {
      return res.status(400).json({ message: "paymentMethod must be either cash or card" });
    }

    let orderItems = [];
    const hasItems = Array.isArray(items) && items.length > 0;
    if (!hasItems && orderType !== "table") {
      return res.status(400).json({
        message: "items are required"
      });
    }

    if (hasItems) {
      for (const item of items) {
        if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) {
          return res.status(400).json({ message: "Item quantity must be a positive integer" });
        }
      }

      const dishIds = items.map(item => item.dishId);
      const dishes = await Dish.find({ _id: { $in: dishIds } });

      orderItems = items.map(item => {
        const dish = dishes.find(d => d._id.toString() === item.dishId);

        if (!dish) {
          throw new Error("Invalid dish selected");
        }

        return {
          dishId: dish._id,
          name: dish.name,
          quantity: item.quantity,
          price: dish.price
        };
      });
    }
    if (!hasItems && isManualTableBooking) {
      if (normalizedPaymentMethod !== "card") {
        return res.status(400).json({ message: "Card payment is required for table booking" });
      }
      orderItems = [
        {
          name: "Table Booking",
          quantity: 1,
          price: TABLE_BOOKING_FEE
        }
      ];
    }
    const itemsSubtotal = orderItems.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );
    const deliveryCharge = normalizedOrderType === "delivery" ? DELIVERY_FEE : 0;
    const orderTotalAmount = itemsSubtotal + deliveryCharge;

    let normalizedSeatCount = Number(seatCount || 0);
    let resolvedReservationStart = null;
    let reservationWindow = null;
    if (orderType === "table") {
      await expireTableReservations();
      if (!tableId) {
        return res.status(400).json({ message: "tableId is required for table orders" });
      }
      if (!Number.isInteger(normalizedSeatCount) || normalizedSeatCount < 1) {
        return res.status(400).json({ message: "Seat count must be 1, 2, 3, 4, 6, or 8" });
      }
      if (!ALLOWED_SEAT_COUNTS.includes(normalizedSeatCount)) {
        return res.status(400).json({ message: "Seat count must be 1, 2, 3, 4, 6, or 8" });
      }

      const table = await DiningTable.findById(tableId).lean();
      if (!table) {
        return res.status(404).json({ message: "Table not found" });
      }
      if (!table.isAvailable) {
        return res.status(400).json({ message: "Selected table is not available" });
      }

      const normalizedTimeLabel = normalizeTimeLabel(timeSlotLabel).toUpperCase();
      resolvedReservationStart = deriveReservationStart({
        reservationStart,
        reservationDate,
        reservationTime,
        timeSlotLabel,
        fallbackDate: new Date()
      });
      reservationWindow = buildReservationWindow({
        start: resolvedReservationStart,
        durationMin: Number(reservationDurationMin || DEFAULT_RESERVATION_MINUTES)
      });
      if (!reservationWindow) {
        return res.status(400).json({ message: "Unable to determine reservation time" });
      }

      const overlappingOrders = await Order.find({
        orderType: "table",
        status: { $in: ACTIVE_TABLE_STATUSES },
        tableId: table._id,
        $or: [
          {
            reservationStart: { $lt: reservationWindow.end },
            reservationEnd: { $gt: reservationWindow.start }
          },
          {
            reservationStart: { $exists: false },
            reservationEnd: { $exists: false },
            $expr: {
              $eq: [
                {
                  $toUpper: {
                    $trim: { input: "$timeSlotLabel" }
                  }
                },
                normalizedTimeLabel
              ]
            }
          }
        ]
      }).select("seatCount").lean();

      const bookedSeats = overlappingOrders.reduce(
        (sum, order) => sum + Number(order.seatCount || 1),
        0
      );
      const capacity = Number(table.seats || 0);
      const remainingSeats = Math.max(capacity - bookedSeats, 0);

      if (normalizedSeatCount > remainingSeats) {
        return res.status(400).json({
          message: `Only ${remainingSeats} seats are available on selected table.`
        });
      }
    }

    const order = await Order.create({
      orderNumber: "ORD-" + Date.now(),
      orderType,
      tableId,
      timeSlotLabel,
      reservationStart: orderType === "table" ? resolvedReservationStart : undefined,
      reservationEnd: orderType === "table" ? reservationWindow?.end : undefined,
      reservationDurationMin:
        orderType === "table"
          ? Number(reservationDurationMin || DEFAULT_RESERVATION_MINUTES)
          : undefined,
      tableNumber: req.body.tableNumber,
      seatCount: orderType === "table" ? normalizedSeatCount : seatCount,
      customerName: normalizedCustomerName,
      phone: normalizedPhone,
      deliveryAddress,
      paymentMethod: normalizedPaymentMethod,
      paymentStatus: initialPaymentStatus,
      totalAmount: orderTotalAmount,
      isManualBooking: isManualTableBooking,
      items: orderItems,
      createdBy: req.user?.email || "system"
    });

    if (initialPaymentStatus === "paid" && normalizedPaymentMethod === "card") {
      const payment = await Payment.create({
        paymentId: `PAY-${Date.now()}`,
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        phone: order.phone,
        paymentMethod: "card",
        subtotal: orderTotalAmount,
        offerType: "fixed",
        offerValue: 0,
        discountAmount: 0,
        taxPercent: 0,
        taxAmount: 0,
        totalAmount: orderTotalAmount,
        paidBy: req.user?.email || "system"
      });

      order.paymentId = payment._id;
      await order.save();
    }

    res.status(201).json({ message: "Order created", order });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}


   //UPDATE ORDER

export async function updateOrder(req, res) {
  try {
    const allowedFields = ["customerName", "phone", "deliveryAddress", "items", "paymentMethod"];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const existingOrder = await Order.findById(req.params.id);
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (updates.items !== undefined) {
      if (String(existingOrder.paymentStatus || "").toLowerCase() === "paid") {
        return res.status(400).json({ message: "Cannot add or update dishes for paid orders" });
      }

      if (!Array.isArray(updates.items) || updates.items.length === 0) {
        return res.status(400).json({ message: "items must be a non-empty array" });
      }

      for (const item of updates.items) {
        if (!String(item?.name || "").trim()) {
          return res.status(400).json({ message: "Each item must have a name" });
        }
        if (!Number.isInteger(Number(item?.quantity)) || Number(item.quantity) < 1) {
          return res.status(400).json({ message: "Item quantity must be a positive integer" });
        }
        if (!Number.isFinite(Number(item?.price)) || Number(item.price) < 0) {
          return res.status(400).json({ message: "Item price must be 0 or greater" });
        }
      }

      const normalizedItems = updates.items.map((item) => ({
        dishId: item.dishId,
        name: String(item.name).trim(),
        quantity: Number(item.quantity),
        price: Number(item.price)
      }));
      updates.items = normalizedItems;

      const itemsSubtotal = normalizedItems.reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
        0
      );
      const deliveryCharge =
        String(existingOrder.orderType || "").toLowerCase() === "delivery" ? DELIVERY_FEE : 0;
      updates.totalAmount = itemsSubtotal + deliveryCharge;
    }

    const order = await Order.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json({ message: "Order updated", order });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}


   //UPDATE STATUS

export async function updateOrderStatus(req, res) {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const validStatuses = ["New", "Preparing", "Ready", "Served", "Delivered", "Cancelled"];
    if (!req.body.status || !validStatuses.includes(req.body.status)) {
      return res.status(400).json({ message: "Invalid status. Must be one of: " + validStatuses.join(", ") });
    }

    order.status = req.body.status;
    await order.save();

    res.json({ message: "Status updated", order });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}


   //CANCEL ORDER

export async function cancelOrder(req, res) {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.status = "Cancelled";
    await order.save();

    let refundRequested = false;
    if (order.paymentStatus === "paid" && order.paymentMethod === "card") {
      const payment = await Payment.findOne({ orderId: order._id });
      if (payment) {
        payment.refundStatus = "requested";
        payment.refundRequestedAt = new Date();
        payment.refundedAt = undefined;
        payment.refundReviewedBy = undefined;
        await payment.save();
        refundRequested = true;
      }
    }

    res.json({
      message: refundRequested ? "Order cancelled and refund requested" : "Order cancelled",
      order,
      refundRequested
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}


   //MARK AS PAID

export async function markOrderPaid(req, res) {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.paymentStatus = "paid";
    await order.save();

    res.json({ message: "Payment marked as paid", order });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}


   //GET KOT

export async function getKitchenTicket(req, res) {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({
      kot: {
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        tableNumber: order.tableNumber,
        items: order.items,
        status: order.status,
        createdAt: order.createdAt
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
