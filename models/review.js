import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ["dish", "service"],
      default: "dish",
      required: true,
      index: true
    },
    dishId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dish",
      index: true
    },
    reviewerEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    reviewerName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 220,
      default: ""
    }
  },
  { timestamps: true, collection: "reviews" }
);

reviewSchema.index({ targetType: 1, dishId: 1, reviewerEmail: 1 });
reviewSchema.index({ targetType: 1, createdAt: -1 });

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);
export default Review;
