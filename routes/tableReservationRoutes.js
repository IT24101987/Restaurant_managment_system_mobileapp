import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import requireStaff from "../middlewares/requireStaff.js";
import {
  createManualReservation,
  deleteTableReservation,
  listTableReservations
} from "../controllers/tableReservationController.js";

const router = express.Router();

router.get("/admin/table-reservations", requireAuth, requireStaff, listTableReservations);
router.post("/admin/table-reservations", requireAuth, requireStaff, createManualReservation);
router.delete("/admin/table-reservations/:id", requireAuth, requireStaff, deleteTableReservation);

export default router;
