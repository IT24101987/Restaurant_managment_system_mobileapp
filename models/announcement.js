import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: { type: String, enum: ["notice", "offer"], default: "notice" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

announcementSchema.index({ isActive: 1, createdAt: -1 });
announcementSchema.index({ createdAt: -1 });

const Announcement =
  mongoose.models.Announcement || mongoose.model("Announcement", announcementSchema);

export default Announcement;
