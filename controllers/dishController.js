import Dish from "../models/dish.js";
import Review from "../models/review.js";

const DISH_FIELDS = ["name", "category", "description", "imageUrl", "price", "prepTimeMin", "isAvailable", "isTrending"
];

function pickDishPayload(body) {
  const payload = {};
  for (const field of DISH_FIELDS) {
    if (field in body) payload[field] = body[field];
  }
  return payload;
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return Boolean(value);
}

async function ensureTrendingCapacity(excludeDishId = null) {
  const filter = { isTrending: true };
  if (excludeDishId) filter._id = { $ne: excludeDishId };
  const trendingCount = await Dish.countDocuments(filter);
  if (trendingCount >= 3) {
    const error = new Error("Only 3 dishes can be set as trending. Disable one first.");
    error.statusCode = 400;
    throw error;
  }
}

// Add Dish
export async function addDish(req, res) {
  try {
    const payload = pickDishPayload(req.body || {});
    if ("isTrending" in payload) payload.isTrending = toBoolean(payload.isTrending);
    if (payload.isTrending === true) {
      await ensureTrendingCapacity();
    }
    const dish = await Dish.create(payload);
    res.status(201).json({ dish });
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
}

//  List All Dishes
export async function listDishes(req, res) {
  try {
    const dishes = await Dish.find().sort({ name: 1 }).lean();
    res.json({ dishes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

//  Update Dish
export async function updateDish(req, res) {
  try {
    const payload = pickDishPayload(req.body || {});
    if ("isTrending" in payload) payload.isTrending = toBoolean(payload.isTrending);
    if (payload.isTrending === true) {
      await ensureTrendingCapacity(req.params.id);
    }
    const dish = await Dish.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    ).select("_id name category description imageUrl price prepTimeMin isAvailable isTrending").lean();

    if (!dish) {
      return res.status(404).json({ message: "Dish not found" });
    }

    res.json({ dish });
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
}

//  list available dishes 
export async function listPublicDishes(req, res) {
  try {
    const dishes = await Dish.find({ isAvailable: { $ne: false } })
      .select("name category description imageUrl price prepTimeMin isTrending averageRating ratingCount")
      .sort({ isTrending: -1, name: 1 })
      .lean();
    res.json({ dishes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Delete Dish
export async function deleteDish(req, res) {
  try {
    const result = await Dish.deleteOne({ _id: req.params.id });
    if (!result.deletedCount) {
      return res.status(404).json({ message: "Dish not found" });
    }
    await Review.deleteMany({ dishId: req.params.id });

    res.json({ message: "Dish deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
