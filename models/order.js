import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    dishId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Dish"
    },
    name: { 
      type: String, 
      required: true,
       trim: true 
      },
    quantity: { 
      type: Number, 
      required: true,
       min: 1 
      },
    price: { 
      type: Number, 
      required: true, 
      min: 0 
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { 
      type: String,
       required: true, 
       unique: true 
      },
    orderType: {
      type: String,
      enum: ["table", "delivery", "pickup"],
      required: true
    },
    tableId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "DiningTable"
     },
    timeSlotLabel: { 
      type: String, 
      required: true, 
      trim: true 
    },
    reservationStart: {
      type: Date
    },
    reservationEnd: {
      type: Date
    },
    reservationDurationMin: {
      type: Number,
      min: 1,
      default: 60
    },
    tableNumber: { 
      type: String, 
      trim: true 
    },
    seatCount: {
      type: Number,
      min: 1
    },
    customerName: { 
      type: String, 
      trim: true 
    },
    phone: { 
      type: String, 
      trim: true 
    },
    deliveryAddress: { 
      type: String, 
      trim: true 
    },
    paymentMethod: { 
      type: String, 
      enum: ["cash", "card"],
       default: "cash" 
      },
    paymentId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Payment"
     },
    items: { 
      type: [orderItemSchema], 
      required: true
     },
    status: {
      type: String,
      enum: ["New", "Preparing", "Ready", "Served", "Delivered", "Cancelled"],
      default: "New"
    },
    paymentStatus: { 
      type: String, enum: ["unpaid", "paid"], 
      default: "unpaid" 
    },
    totalAmount: {
      type: Number,
      min: 0
    },
    createdBy: { 
      type: String, 
      required: true 
    }
    ,
    isManualBooking: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ orderType: 1, status: 1, tableId: 1 });
orderSchema.index({ timeSlotLabel: 1, status: 1, orderType: 1 });
orderSchema.index({ reservationEnd: 1, status: 1, orderType: 1 });

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
export default Order;
