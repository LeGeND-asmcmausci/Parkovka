import "./types/express";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import parkingRoutes from "./routes/parking";
import reservationRoutes from "./routes/reservation";
import guardRoutes from "./routes/guard";
import paymentRoutes from "./routes/payment";
import { errorHandler } from "./middleware/error";

/**
 * Builds the Express application without binding a port.
 *
 * Keeping the app separate from `index.ts` lets tests mount it on an ephemeral
 * port while the real server keeps its Socket.IO + graceful shutdown wiring.
 */
export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true,
    })
  );
  // `rawBody` is required for provider signatures that cover the exact payload.
  app.use(
    express.json({
      limit: "10kb",
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get("/health", (_req, res) => {
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
  app.use((_req, res) => {
    res.status(404).json({ message: "Route not found" });
  });

  // Error handler (must be after all routes)
  app.use(errorHandler);

  return app;
};

export default createApp;
