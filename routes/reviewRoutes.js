import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import requireStaff from "../middlewares/requireStaff.js";
import {
  createOrUpdateReview,
  deleteMyReview,
  deleteAdminReview,
  getAdminReviewSummary,
  listAdminReviews,
  listReviews,
  updateMyReview,
  updateAdminReview
} from "../controllers/reviewController.js";

const router = express.Router();

router.post("/reviews", requireAuth, createOrUpdateReview);
router.get("/reviews", requireAuth, listReviews);
router.patch("/reviews/:id", requireAuth, updateMyReview);
router.delete("/reviews/:id", requireAuth, deleteMyReview);

router.get("/admin/reviews/summary", requireAuth, requireStaff, getAdminReviewSummary);
router.get("/admin/reviews", requireAuth, requireStaff, listAdminReviews);
router.patch("/admin/reviews/:id", requireAuth, requireStaff, updateAdminReview);
router.delete("/admin/reviews/:id", requireAuth, requireStaff, deleteAdminReview);

export default router;
