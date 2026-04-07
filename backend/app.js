import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import rateLimit from "express-rate-limit";
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
  // For serverless, connect to database on each request if not already connected
  const connectDB = async () => {
    if (mongoose.connection.readyState === 0) {
      try {
        await mongoose.connect(config.mongodbURI);
        isDatabaseReady = true;
        console.log("MongoDB connected");
      } catch (err) {
        isDatabaseReady = false;
        console.error("MongoDB connection failed:", err.message);
      }
    } else {
      isDatabaseReady = mongoose.connection.readyState === 1;
    }
  };

  // Connect immediately
  connectDB();
}

app.use(express.json({ limit: "15mb" }));

// Add request logging for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

const allowLocalhostPort = /^http:\/\/localhost:517\d$/;
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    // Allow configured origins
    if (config.corsOrigins.includes(origin)) return callback(null, true);

    // Allow localhost development
    if (allowLocalhostPort.test(origin)) return callback(null, true);

    // Block other origins
    return callback(new Error("CORS blocked"), false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Temporarily remove root route handler for debugging
// app.get("/", (req, res) => {
//   res.json({ message: "Restaurant Management System API" });
// });

app.get("/api/health", (req, res) => {
  res.json({
    message: "API is healthy",
    database: isDatabaseReady ? "connected" : "disconnected",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/test", (req, res) => {
  res.json({ message: "Test route working" });
});


// app.use(authenticateUser);
app.use((req, res, next) => {
  const isApiRoute = req.path.startsWith("/api");

  if (isApiRoute && !isDatabaseReady) {
    return res.status(503).json({
      message: "Database is not connected. Set MONGODB_URI and restart backend."
    });
  }
  next();
});


// app.use('/api', authRoutes);
app.use('/api', authRoutes);
// Temporarily comment out all routes for debugging
// app.use('/api', catalogRoutes);
// app.use('/api', orderRoutes);
// app.use('/api', paymentRoutes);
// app.use('/api', tableRoutes);
// app.use('/api', tableReservationRoutes);
// app.use('/api', dishRoutes);
// app.use('/api', reviewRoutes);
// app.use('/api', adminRoutes);

// Add catch-all route for debugging
// app.use('*', (req, res) => {
//   console.log(`Catch-all: ${req.method} ${req.originalUrl}`);
//   res.status(404).json({ message: "Route not found", path: req.originalUrl });
// });

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error" });
});

export default app;
