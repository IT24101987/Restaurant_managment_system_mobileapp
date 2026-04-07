import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
       type: String, 
       required: true, 
       unique: true, 
       trim: true
       },
    orderId: {
       type: mongoose.Schema.Types.ObjectId,
        ref: "Order", 
        required: true, 
        unique: true 
      },
    orderNumber: { 
      type: String, 
      trim: true 
    },
    customerName: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    paymentMethod: { 
      type: String, 
      enum: ["cash", "card"], 
      required: true 
    },
    subtotal: { 
      type: Number,
       required: true, 
       min: 0 
      },
    offerType: { 
      type: String, 
      enum: ["fixed", "percent"],
       default: "fixed"
       },
    offerValue: { 
      type: Number, 
      default: 0, 
      min: 0 
    },
    discountAmount: { 
      type: Number, 
      default: 0, 
      min: 0 
    },
    taxPercent: { 
      type: Number, 
      default: 0, min: 0 
    },
    taxAmount: { 
      type: Number, 
      default: 0, min: 0
     },
    totalAmount: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    refundStatus: {
      type: String,
      enum: ["none", "requested", "approved", "rejected"],
      default: "none"
    },
    refundRequestedAt: {
      type: Date
    },
    refundedAt: {
      type: Date
    },
    refundReviewedBy: {
      type: String,
      trim: true
    },
    cardDetails: {
      cardHolderName: {
         type: String, 
         trim: true 
        },
      cardNumberLast4: { 
        type: String, 
        trim: true 
      },
      expiryMonth: { 
        type: String, 
        trim: true 
      },
      expiryYear: { 
        type: String, 
        trim: true 
      }
    },
    paidBy: { 
      type: String, 
      required: true, 
      trim: true 
    }
  },
  { timestamps: true }
);

const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
export default Payment;
