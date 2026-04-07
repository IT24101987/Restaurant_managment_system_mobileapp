import mongoose from "mongoose";

const dishSchema = new mongoose.Schema(
  {
    name: {
       type: String,
        required: true,
         trim: true
        },
    category: { 
      type: String, 
      trim: true 
    },
    description: {
       type: String, 
       trim: true 
      },
    imageUrl: { 
      type: String, 
      trim: true 
    },
    price: { 
      type: Number,
       required: true,
       min: 0 
    },
    prepTimeMin: {
       type: Number,
        min: 1, 
        default: 15
       },
    isAvailable: { 
      type: Boolean, 
      default: true 
    },
    isTrending: {
      type: Boolean,
      default: false
    },
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    ratingCount: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  { timestamps: true, collection: "dishes" }
);

dishSchema.index({ name: 1 }, { unique: true });
dishSchema.index({ category: 1, name: 1 });
dishSchema.index({ isAvailable: 1, name: 1 });
dishSchema.index({ isTrending: 1, name: 1 });

const Dish = mongoose.models.Dish || mongoose.model("Dish", dishSchema);
export default Dish;
