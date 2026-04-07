import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import requireStaff from "../middlewares/requireStaff.js";
import { addDish, deleteDish, listDishes, listPublicDishes, updateDish } from "../controllers/dishController.js";

const router = express.Router();

router.get("/dishes/public", listPublicDishes);
router.get("/admin/dishes", requireAuth, requireStaff, listDishes);
router.post("/admin/dishes", requireAuth, requireStaff, addDish);
router.patch("/admin/dishes/:id", requireAuth, requireStaff, updateDish);
router.delete("/admin/dishes/:id", requireAuth, requireStaff, deleteDish);

export default router;
