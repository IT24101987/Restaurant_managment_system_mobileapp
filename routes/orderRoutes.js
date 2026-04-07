import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import {
  cancelOrder,
  createOrder,
  getOrderById,
  getKitchenTicket,
  listOrders,
  markOrderPaid,
  updateOrder,
  updateOrderStatus
} from "../controllers/orderController.js";

const router = express.Router();

router.get("/orders", requireAuth, listOrders);
router.get("/orders/:id", requireAuth, getOrderById);
router.post("/orders", requireAuth, createOrder);
router.put("/orders/:id", requireAuth, updateOrder);
router.patch("/orders/:id/status", requireAuth, updateOrderStatus);
router.patch("/orders/:id/cancel", requireAuth, cancelOrder);
router.patch("/orders/:id/pay", requireAuth, markOrderPaid);
router.get("/orders/:id/kot", requireAuth, getKitchenTicket);

export default router;
