import mongoose from "mongoose";
import Dish from "../models/dish.js";
import Review from "../models/review.js";

function normalizePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

async function refreshDishRating(dishId) {
  const objectId = new mongoose.Types.ObjectId(String(dishId));
  const [summary] = await Review.aggregate([
    { $match: { dishId: objectId } },
    {
      $group: {
        _id: "$dishId",
        ratingCount: { $sum: 1 },
        averageRating: { $avg: "$rating" }
      }
    }
  ]);

  const ratingCount = Number(summary?.ratingCount || 0);
  const averageRating = ratingCount
    ? Number(Number(summary.averageRating || 0).toFixed(2))
    : 0;

  await Dish.findByIdAndUpdate(
    dishId,
    { ratingCount, averageRating },
    { new: false, runValidators: false }
  );

  return { ratingCount, averageRating };
}

export async function createOrUpdateReview(req, res) {
  try {
    const reviewerEmail = String(req.user?.email || "").trim().toLowerCase();
    if (!reviewerEmail) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const targetType = String(req.body?.targetType || "dish").trim().toLowerCase();
    const dishId = String(req.body?.dishId || "").trim();
    const reviewerName = String(req.body?.reviewerName || "").trim();
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || "").trim();

    if (!["dish", "service"].includes(targetType)) {
      return res.status(400).json({ message: "targetType must be dish or service" });
    }
    if (targetType === "dish" && (!dishId || !mongoose.Types.ObjectId.isValid(dishId))) {
      return res.status(400).json({ message: "Valid dishId is required for dish reviews" });
    }
    if (!reviewerName) {
      return res.status(400).json({ message: "Reviewer name is required" });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be an integer between 1 and 5" });
    }
    if (comment.length > 220) {
      return res.status(400).json({ message: "Comment must be 220 characters or fewer" });
    }

    let dish = null;
    if (targetType === "dish") {
      dish = await Dish.findById(dishId).select("_id name").lean();
      if (!dish) {
        return res.status(404).json({ message: "Dish not found" });
      }
    }

    const reviewKey = targetType === "dish"
      ? { targetType, dishId, reviewerEmail }
      : { targetType, reviewerEmail, dishId: null };

    const existing = await Review.findOne(reviewKey);
    if (existing) {
      existing.reviewerName = reviewerName;
      existing.rating = rating;
      existing.comment = comment;
      await existing.save();
    } else {
      await Review.create({
        targetType,
        dishId: targetType === "dish" ? dishId : null,
        reviewerEmail,
        reviewerName,
        rating,
        comment
      });
    }

    const summary = targetType === "dish"
      ? await refreshDishRating(dishId)
      : { ratingCount: null, averageRating: null };

    return res.status(existing ? 200 : 201).json({
      message: existing ? "Review updated" : "Review added",
      targetType,
      dish: targetType === "dish"
        ? {
          _id: dish._id,
          name: dish.name,
          averageRating: summary.averageRating,
          ratingCount: summary.ratingCount
        }
        : null
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to save review" });
  }
}

export async function listReviews(req, res) {
  try {
    const dishId = String(req.query?.dishId || "").trim();
    const targetType = String(req.query?.targetType || "").trim().toLowerCase();
    const page = normalizePositiveInt(req.query?.page, 1);
    const limit = Math.min(normalizePositiveInt(req.query?.limit, 20), 100);
    const skip = (page - 1) * limit;

    const filter = {};
    if (targetType) {
      if (!["dish", "service"].includes(targetType)) {
        return res.status(400).json({ message: "Invalid targetType" });
      }
      filter.targetType = targetType;
    }
    if (dishId) {
      if (!mongoose.Types.ObjectId.isValid(dishId)) {
        return res.status(400).json({ message: "Invalid dishId" });
      }
      filter.dishId = dishId;
    } else {
      filter.reviewerEmail = String(req.user?.email || "").trim().toLowerCase();
    }

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate("dishId", "_id name category")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter)
    ]);

    return res.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: skip + reviews.length < total
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to list reviews", error: error.message });
  }
}

export async function listAdminReviews(req, res) {
  try {
    const dishId = String(req.query?.dishId || "").trim();
    const targetType = String(req.query?.targetType || "").trim().toLowerCase();
    const page = normalizePositiveInt(req.query?.page, 1);
    const limit = Math.min(normalizePositiveInt(req.query?.limit, 50), 100);
    const skip = (page - 1) * limit;
    const filter = {};
    if (targetType) {
      if (!["dish", "service"].includes(targetType)) {
        return res.status(400).json({ message: "Invalid targetType" });
      }
      filter.targetType = targetType;
    }

    if (dishId) {
      if (!mongoose.Types.ObjectId.isValid(dishId)) {
        return res.status(400).json({ message: "Invalid dishId" });
      }
      filter.dishId = dishId;
    }

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate("dishId", "_id name category")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter)
    ]);

    return res.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: skip + reviews.length < total
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load reviews", error: error.message });
  }
}

export async function getAdminReviewSummary(req, res) {
  try {
    const [summary] = await Review.aggregate([
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          totalComments: {
            $sum: {
              $cond: [
                { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$comment", ""] } } } }, 0] },
                1,
                0
              ]
            }
          },
          serviceReviewCount: {
            $sum: {
              $cond: [{ $eq: ["$targetType", "service"] }, 1, 0]
            }
          },
          dishReviewCount: {
            $sum: {
              $cond: [{ $eq: ["$targetType", "dish"] }, 1, 0]
            }
          }
        }
      }
    ]);

    const totalReviews = Number(summary?.totalReviews || 0);
    const averageRating = totalReviews ? Number(Number(summary?.averageRating || 0).toFixed(2)) : 0;
    const totalComments = Number(summary?.totalComments || 0);
    const serviceReviewCount = Number(summary?.serviceReviewCount || 0);
    const dishReviewCount = Number(summary?.dishReviewCount || 0);

    return res.json({
      totalReviews,
      averageRating,
      totalComments,
      serviceReviewCount,
      dishReviewCount
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load review summary", error: error.message });
  }
}

export async function updateAdminReview(req, res) {
  try {
    const payload = {};
    if (req.body?.reviewerName !== undefined) payload.reviewerName = String(req.body.reviewerName || "").trim();
    if (req.body?.comment !== undefined) payload.comment = String(req.body.comment || "").trim();
    if (req.body?.rating !== undefined) payload.rating = Number(req.body.rating);

    if ("reviewerName" in payload && !payload.reviewerName) {
      return res.status(400).json({ message: "Reviewer name is required" });
    }
    if ("rating" in payload && (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5)) {
      return res.status(400).json({ message: "Rating must be an integer between 1 and 5" });
    }
    if ("comment" in payload && payload.comment.length > 220) {
      return res.status(400).json({ message: "Comment must be 220 characters or fewer" });
    }

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    ).populate("dishId", "_id name category");

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const isDishReview = String(review.targetType || "dish") === "dish";
    const summary = isDishReview
      ? await refreshDishRating(review.dishId?._id || review.dishId)
      : { averageRating: null, ratingCount: null };

    return res.json({
      message: "Review updated",
      review,
      dish: isDishReview
        ? {
          _id: review.dishId?._id || review.dishId,
          averageRating: summary.averageRating,
          ratingCount: summary.ratingCount
        }
        : null
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to update review" });
  }
}

export async function deleteAdminReview(req, res) {
  try {
    const review = await Review.findByIdAndDelete(req.params.id).lean();
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const isDishReview = String(review.targetType || "dish") === "dish";
    const summary = isDishReview
      ? await refreshDishRating(review.dishId)
      : { averageRating: null, ratingCount: null };

    return res.json({
      message: "Review deleted",
      dish: isDishReview
        ? {
          _id: review.dishId,
          averageRating: summary.averageRating,
          ratingCount: summary.ratingCount
        }
        : null
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to delete review" });
  }
}

export async function updateMyReview(req, res) {
  try {
    const reviewerEmail = String(req.user?.email || "").trim().toLowerCase();
    if (!reviewerEmail) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const review = await Review.findOne({ _id: req.params.id, reviewerEmail });
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (req.body?.reviewerName !== undefined) {
      review.reviewerName = String(req.body.reviewerName || "").trim();
      if (!review.reviewerName) {
        return res.status(400).json({ message: "Reviewer name is required" });
      }
    }
    if (req.body?.rating !== undefined) {
      const rating = Number(req.body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be an integer between 1 and 5" });
      }
      review.rating = rating;
    }
    if (req.body?.comment !== undefined) {
      const comment = String(req.body.comment || "").trim();
      if (comment.length > 220) {
        return res.status(400).json({ message: "Comment must be 220 characters or fewer" });
      }
      review.comment = comment;
    }

    await review.save();
    await review.populate("dishId", "_id name category");

    const isDishReview = String(review.targetType || "dish") === "dish";
    const summary = isDishReview
      ? await refreshDishRating(review.dishId?._id || review.dishId)
      : { averageRating: null, ratingCount: null };

    return res.json({
      message: "Review updated",
      review,
      dish: isDishReview
        ? {
          _id: review.dishId?._id || review.dishId,
          averageRating: summary.averageRating,
          ratingCount: summary.ratingCount
        }
        : null
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to update review" });
  }
}

export async function deleteMyReview(req, res) {
  try {
    const reviewerEmail = String(req.user?.email || "").trim().toLowerCase();
    if (!reviewerEmail) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const review = await Review.findOneAndDelete({ _id: req.params.id, reviewerEmail }).lean();
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const isDishReview = String(review.targetType || "dish") === "dish";
    const summary = isDishReview
      ? await refreshDishRating(review.dishId)
      : { averageRating: null, ratingCount: null };

    return res.json({
      message: "Review deleted",
      dish: isDishReview
        ? {
          _id: review.dishId,
          averageRating: summary.averageRating,
          ratingCount: summary.ratingCount
        }
        : null
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to delete review" });
  }
}
