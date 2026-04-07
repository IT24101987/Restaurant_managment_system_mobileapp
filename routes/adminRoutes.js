import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import requireAdmin from "../middlewares/requireAdmin.js";
import {
  addAnnouncement,
  deleteUser,
  listAnnouncements,
  listUsers,
  updateAnnouncement,
  updateUser
} from "../controllers/adminController.js";

const router = express.Router();

router.get("/admin/announcements", requireAuth, requireAdmin, listAnnouncements);
router.post("/admin/announcements", requireAuth, requireAdmin, addAnnouncement);
router.patch("/admin/announcements/:id", requireAuth, requireAdmin, updateAnnouncement);

router.get("/admin/users", requireAuth, requireAdmin, listUsers);
router.patch("/admin/users/:id", requireAuth, requireAdmin, updateUser);
router.delete("/admin/users/:id", requireAuth, requireAdmin, deleteUser);

export default router;
