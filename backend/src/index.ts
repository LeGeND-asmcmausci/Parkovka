import "dotenv/config";
import logger from "./utils/logger";
import { prisma } from "./utils/db";
import { connectRedis } from "./utils/redis";
import { setupSocketIO } from "./socket";
import { createApp } from "./app";

const app = createApp();
const PORT = Number(process.env.PORT) || 3001;

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);

  connectRedis().catch(() => {
    logger.warn("Redis connection failed, continuing without Redis");
  });
});

// Set up Socket.IO (real-time map updates)
const io = setupSocketIO(server);

export { app, server, io };

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: unknown) => {
  logger.error(
    `Unhandled Rejection: ${reason instanceof Error ? reason.message : String(reason)}`
  );
});

// Handle uncaught exceptions
process.on("uncaughtException", (err: Error) => {
  logger.error(`Uncaught Exception: ${err.message}`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  });
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
