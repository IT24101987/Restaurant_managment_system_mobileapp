import mongoose from "mongoose";

const diningTableSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true
    },
    tableNo: {
       type: String, 
       required: true, 
       unique: true, trim: true
       },
    seats: { 
      type: Number, 
      required: true,
      enum: [2, 4, 6, 8],
      default: 2 
    },
    location: {
      type: String,
      enum: ["indoor", "outdoor"],
      default: "indoor",
      trim: true
    },
    purpose: {
      type: String,
      enum: ["vip", "family"],
      default: "family",
      trim: true
    },
    isAvailable: { 
      type: Boolean, 
      default: true 
    }
  },
  { 
    timestamps: true, collection: "tables" 

  }
);

const DiningTable = mongoose.models.DiningTable || mongoose.model("DiningTable", diningTableSchema);
export default DiningTable;

