import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import rateLimit from "express-rate-limit";
import config from "../config.js";
import authenticateUser from "../middlewares/authentication.js";
import authRoutes from "../routes/authRoutes.js";
import catalogRoutes from "../routes/catalogRoutes.js";
import orderRoutes from "../routes/orderRoutes.js";
import paymentRoutes from "../routes/paymentRoutes.js";
import tableRoutes from "../routes/tableRoutes.js";
import tableReservationRoutes from "../routes/tableReservationRoutes.js";
import adminRoutes from "../routes/adminRoutes.js";
import dishRoutes from "../routes/dishRoutes.js";
import reviewRoutes from "../routes/reviewRoutes.js";

const app = express();

// Track database connection status
let isDatabaseReady = false;

// MongoDB connection
if (!config.mongodbURI) {
  console.error("MONGODB_URI is missing. Add it in backend/.env");
} else {
  mongoose
    .connect(config.mongodbURI)
    .then(() => {
      isDatabaseReady = true;
      console.log("MongoDB connected");
    })
    .catch((err) => {
      isDatabaseReady = false;
      console.error("MongoDB connection error:", err.message);
    });
}

mongoose.connection.on("connected", () => (isDatabaseReady = true));
mongoose.connection.on("disconnected", () => (isDatabaseReady = false));

// Middleware
app.use(express.json({ limit: "15mb" }));

// Allow localhost + configured origins
const allowLocalhostPort = /^http:\/\/localhost:517\d$/;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // mobile apps or postman
      if (config.corsOrigins.includes(origin)) return callback(null, true);
      if (allowLocalhostPort.test(origin)) return callback(null, true);
      return callback(new Error("CORS blocked"), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
  })
);

// Rate limiter for login/register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/login", authLimiter);
app.use("/api/register", authLimiter);

// JWT Authentication Middleware
app.use(authenticateUser);

// Check DB ready before API requests
app.use((req, res, next) => {
  const apiRoutes = [
    "/api/register",
    "/api/login",
    "/api/orders",
    "/api/catalog",
    "/api/dishes",
    "/api/reviews",
    "/api/admin",
    "/api/payments",
  ];

  const isApiRoute = apiRoutes.some((r) => req.path.startsWith(r));

  if (isApiRoute && !isDatabaseReady) {
    return res.status(503).json({
      message: "Database is not connected. Set MONGODB_URI and restart.",
    });
  }

  next();
});

// Mount your routes under /api
app.use("/api", authRoutes);
app.use("/api", catalogRoutes);
app.use("/api", orderRoutes);
app.use("/api", paymentRoutes);
app.use("/api", tableRoutes);
app.use("/api", tableReservationRoutes);
app.use("/api", dishRoutes);
app.use("/api", reviewRoutes);
app.use("/api", adminRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("ERROR:", err.stack);
  res.status(500).json({ message: "Internal server error" });
});


export default app; 