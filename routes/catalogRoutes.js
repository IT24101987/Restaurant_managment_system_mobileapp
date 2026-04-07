import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import { getCatalog } from "../controllers/catalogController.js";

const router = express.Router();

router.get("/catalog", requireAuth, getCatalog);

export default router;
