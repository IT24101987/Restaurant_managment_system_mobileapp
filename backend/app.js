import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import rateLimit from "express-rate-limit";
import fs from "fs";
import config from "./config.js";
import authenticateUser from "./middlewares/authentication.js";
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from "./routes/authRoutes.js";
import catalogRoutes from "./routes/catalogRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import tableRoutes from "./routes/tableRoutes.js";
import tableReservationRoutes from "./routes/tableReservationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import dishRoutes from "./routes/dishRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";

const app = express();

let isDatabaseReady = false;

if (!config.mongodbURI) {
  console.error("MONGODB_URI is missing. Set it in backend/.env or in Vercel environment variables.");
} else {
  mongoose.connect(config.mongodbURI)
    .then(() => {
      isDatabaseReady = true;
      console.log("MongoDB connected");
    })
    .catch((err) => {
      isDatabaseReady = false;
      console.error("MongoDB connection failed:", err.message);
    });
}

mongoose.connection.on("disconnected", () => { isDatabaseReady = false; });
mongoose.connection.on("connected", () => { isDatabaseReady = true; });

app.use(express.json({ limit: "15mb" }));

const allowLocalhostPort = /^http:\/\/localhost:517\d$/;
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (config.corsOrigins.includes(origin)) return callback(null, true);
    if (allowLocalhostPort.test(origin)) return callback(null, true);
    return callback(new Error("CORS blocked"), false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.join(__dirname, "..", "frontend");

app.use((req, res, next) => {
  while (req.url === "/api" || req.url.startsWith("/api/")) {
    req.url = req.url.replace(/^\/api/, "") || "/";
  }
  next();
});

if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
}

app.get(["/", "/api"], (req, res) => {
  res.json({ message: "Restaurant Management System API" });
});

app.use(authenticateUser);
app.use((req, res, next) => {
  const isApiRoute =
    req.path.startsWith("/register") ||
    req.path.startsWith("/login") ||
    req.path.startsWith("/orders") ||
    req.path.startsWith("/catalog") ||
    req.path.startsWith("/dishes") ||
    req.path.startsWith("/reviews") ||
    req.path.startsWith("/admin") ||
    req.path.startsWith("/payments");

  if (isApiRoute && !isDatabaseReady) {
    return res.status(503).json({
      message: "Database is not connected. Set MONGODB_URI and restart backend."
    });
  }
  next();
});

app.use(authRoutes);
app.use(catalogRoutes);
app.use(orderRoutes);
app.use(paymentRoutes);
app.use(tableRoutes);
app.use(tableReservationRoutes);
app.use(dishRoutes);
app.use(reviewRoutes);
app.use(adminRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error" });
});

export default app;
