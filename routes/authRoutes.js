import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import requireAdmin from "../middlewares/requireAdmin.js";
import {
  changeMyPassword,
  createAdminUser,
  createStaffUser,
  createuser,
  deleteMyProfile,
  getMyProfile,
  loginAdmin,
  loginUser,
  updateMyProfile
} from "../controllers/userController.js";

const router = express.Router();

router.post("/register", createuser);
router.post("/register/admin", requireAuth, requireAdmin, createAdminUser);
router.post("/register/staff", requireAuth, requireAdmin, createStaffUser);
router.post("/login", loginUser);
router.post("/login/admin", loginAdmin);
//my profile
router.get("/me", requireAuth, getMyProfile);
router.patch("/me", requireAuth, updateMyProfile);
router.post("/me/change-password", requireAuth, changeMyPassword);
router.delete("/me", requireAuth, deleteMyProfile);

export default router;
