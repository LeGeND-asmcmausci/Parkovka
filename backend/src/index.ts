// @ts-nocheck
import "./utils/db.ts";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import logger from "./utils/logger";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import parkingRoutes from "./routes/parking";
import reservationRoutes from "./routes/reservation";
import guardRoutes from "./routes/guard";
import paymentRoutes from "./routes/payment";
import { errorHandler } from "./middleware/error";
import { connectRedis } from "./utils/redis";
import { setupSocketIO } from "./socket";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/parking", parkingRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/guard", guardRoutes);
app.use("/api/payments", paymentRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler (should be after all routes)
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);

  // Connect Redis
  connectRedis().catch(() => {
    logger.warn("Redis connection failed, continuing without Redis");
  });
});

// Set up Socket.IO
const io = setupSocketIO(server);

// Export for testing
export { app, server, io };

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: any) => {
  logger.error("Unhandled Rejection at:", reason instanceof Error ? reason.message : String(reason));
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err: Error) => {
  logger.error("Uncaught Exception:", err.message);
  process.exit(1);
});