import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import requireStaff from "../middlewares/requireStaff.js";
import { addTable, deleteTable, listTables, updateTable } from "../controllers/tableController.js";

const router = express.Router();

router.get("/admin/tables", requireAuth, requireStaff, listTables);
router.post("/admin/tables", requireAuth, requireStaff, addTable);
router.patch("/admin/tables/:id", requireAuth, requireStaff, updateTable);
router.delete("/admin/tables/:id", requireAuth, requireStaff, deleteTable);

export default router;
