import Order from "../models/order.js";
import Payment from "../models/payment.js";


  // CREATE PAYMENT//

export async function createPayment(req, res) {
  try {
    const { orderId, paymentMethod, taxPercent = 0, offerType = "fixed", offerValue = 0 } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({ message: "Order already paid" });
    }

    if (!["cash", "card"].includes(paymentMethod)) {
      return res.status(400).json({ message: "Payment method must be cash or card" });
    }

    const taxPercentNum = Number(taxPercent || 0);
    if (!Number.isFinite(taxPercentNum) || taxPercentNum < 0 || taxPercentNum > 100) {
      return res.status(400).json({ message: "Tax percent must be between 0 and 100" });
    }

    const normalizedOfferType = String(offerType || "fixed").toLowerCase();
    if (!["fixed", "percent"].includes(normalizedOfferType)) {
      return res.status(400).json({ message: "Offer type must be fixed or percent" });
    }

    const offerValueNum = Number(offerValue || 0);
    if (!Number.isFinite(offerValueNum) || offerValueNum < 0) {
      return res.status(400).json({ message: "Offer value must be 0 or greater" });
    }
    if (normalizedOfferType === "percent" && offerValueNum > 100) {
      return res.status(400).json({ message: "Percent discount cannot exceed 100" });
    }

    // Calculate subtotal
    const subtotal = order.items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);

    const rawDiscount =
      normalizedOfferType === "percent"
        ? subtotal * (offerValueNum / 100)
        : offerValueNum;
    const discountAmount = Math.min(Math.max(rawDiscount, 0), subtotal);
    const taxableAmount = Math.max(subtotal - discountAmount, 0);
    const taxAmount = taxableAmount * (taxPercentNum / 100);
    const totalAmount = taxableAmount + taxAmount;

    const payment = await Payment.create({
      paymentId: `PAY-${Date.now()}`,
      orderId: order._id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      phone: order.phone,
      paymentMethod,
      subtotal,
      offerType: normalizedOfferType,
      offerValue: offerValueNum,
      discountAmount,
      taxPercent: taxPercentNum,
      taxAmount,
      totalAmount,
      paidBy: req.user?.email || "system"
    });

    // Update order
    order.paymentStatus = "paid";
    order.paymentMethod = paymentMethod;
    order.paymentId = payment._id;
    order.totalAmount = totalAmount;
    await order.save();

    res.status(201).json({
      message: "Payment successful",
      payment
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to create payment",
      error: error.message
    });
  }
}
//GET PAYMENT BY ORDER///

export async function getPaymentByOrderId(req, res) {
  try {
    const payment = await Payment.findOne({ orderId: req.params.orderId });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.json({ payment });

  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch payment",
      error: error.message
    });
  }
}


   //LIST ALL PAYMENTS//

export async function listPaidPayments(req, res) {
  try {
    const payments = await Payment.find()
      .populate("orderId", "orderNumber orderType tableNumber customerName")
      .sort({ createdAt: -1 });

    res.json({ payments });

  } catch (error) {
    res.status(500).json({
      message: "Failed to list payments",
      error: error.message
    });
  }
}

export async function reviewRefundRequest(req, res) {
  try {
    const { action } = req.body;
    if (!["approve", "reject"].includes(String(action || "").toLowerCase())) {
      return res.status(400).json({ message: "action must be approve or reject" });
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    if (payment.refundStatus !== "requested") {
      return res.status(400).json({ message: "Refund is not in requested status" });
    }

    if (action.toLowerCase() === "approve") {
      payment.refundStatus = "approved";
      payment.refundedAt = new Date();
    } else {
      payment.refundStatus = "rejected";
      payment.refundedAt = undefined;
    }
    payment.refundReviewedBy = req.user?.email || "system";
    await payment.save();

    res.json({
      message: `Refund ${action.toLowerCase()}d successfully`,
      payment
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to review refund request",
      error: error.message
    });
  }
}
