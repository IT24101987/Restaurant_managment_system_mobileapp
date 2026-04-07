import Order from "../models/order.js";
import DiningTable from "../models/diningTable.js";
import {
  ACTIVE_TABLE_STATUSES,
  DEFAULT_RESERVATION_MINUTES,
  buildReservationWindow,
  deriveReservationStart,
  expireTableReservations,
  normalizeTimeLabel
} from "../utils/reservation.js";

// LIST TABLE RESERVATIONS
export async function listTableReservations(req, res) {
  try {
    await expireTableReservations();
    const reservations = await Order.find({
      orderType: "table"
    })
      .populate("tableId", "tableNo seats")
      .sort({ createdAt: -1 });

    res.json({ reservations });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch reservations", error: error.message });
  }
}

// CREATE MANUAL TABLE RESERVATION
export async function createManualReservation(req, res) {
  try {
    const {
      tableId,
      seatCount,
      customerName,
      phone,
      timeSlotLabel,
      tableNumber,
      reservationDate,
      reservationTime,
      reservationStart,
      reservationDurationMin
    } = req.body;

    if (!tableId) {
      return res.status(400).json({ message: "tableId is required for manual reservations" });
    }
    if (!timeSlotLabel) {
      return res.status(400).json({ message: "timeSlotLabel is required" });
    }
    if (!customerName) {
      return res.status(400).json({ message: "customerName is required" });
    }
    if (!/^[A-Za-z\s]+$/.test(String(customerName).trim())) {
      return res.status(400).json({ message: "customerName must contain only letters and spaces" });
    }
    if (!/^\d{10}$/.test(String(phone || "").trim())) {
      return res.status(400).json({ message: "phone must be exactly 10 digits" });
    }

    const normalizedSeatCount = Number(seatCount || 0);
    if (!Number.isInteger(normalizedSeatCount) || normalizedSeatCount < 1) {
      return res.status(400).json({ message: "Seat count must be at least 1" });
    }

    await expireTableReservations();
    const table = await DiningTable.findById(tableId).lean();
    if (!table) {
      return res.status(404).json({ message: "Table not found" });
    }
    if (!table.isAvailable) {
      return res.status(400).json({ message: "Selected table is not available" });
    }
    const resolvedStart = deriveReservationStart({
      reservationStart,
      reservationDate,
      reservationTime,
      timeSlotLabel,
      fallbackDate: new Date()
    });
    const window = buildReservationWindow({
      start: resolvedStart,
      durationMin: Number(reservationDurationMin || DEFAULT_RESERVATION_MINUTES)
    });
    if (!window) {
      return res.status(400).json({ message: "Unable to determine reservation time" });
    }

    const normalizedTimeLabel = normalizeTimeLabel(timeSlotLabel).toUpperCase();
    const overlappingOrders = await Order.find({
      orderType: "table",
      status: { $in: ACTIVE_TABLE_STATUSES },
      tableId,
      $or: [
        {
          reservationStart: { $lt: window.end },
          reservationEnd: { $gt: window.start }
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

    const order = await Order.create({
      orderNumber: "ORD-" + Date.now(),
      orderType: "table",
      tableId,
      timeSlotLabel,
      reservationStart: resolvedStart,
      reservationEnd: window.end,
      reservationDurationMin: Number(reservationDurationMin || DEFAULT_RESERVATION_MINUTES),
      tableNumber,
      seatCount: normalizedSeatCount,
      customerName,
      phone,
      paymentMethod: "cash",
      items: [{
        name: "Manual Booking",
        quantity: 1,
        price: 0
      }],
      isManualBooking: true,
      createdBy: req.user?.email || "system"
    });

    res.status(201).json({ message: "Manual reservation created", reservation: order });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// DELETE (CANCEL) TABLE RESERVATION
export async function deleteTableReservation(req, res) {
  try {
    const reservation = await Order.findById(req.params.id);
    if (!reservation || reservation.orderType !== "table") {
      return res.status(404).json({ message: "Reservation not found" });
    }

    reservation.status = "Cancelled";
    await reservation.save();

    res.json({ message: "Reservation cancelled", reservation });
  } catch (error) {
    res.status(500).json({ message: "Failed to cancel reservation", error: error.message });
  }
}
