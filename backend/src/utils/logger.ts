/**
 * Centralized logger for the Smart Parking Management System backend.
 * 
 * @author Principal Backend Engineer
 * @version 0.1.0
 */

import pino from "pino";
import { LOG_DIR } from "../constants";

const transport = pino.transport({
  targets: [
    {
      target: "pino/file",
      options: {
        destination: LOG_DIR,
      },
    },
    {
      target: "pino/pretty",
    },
  ],
});

// Add request ID middleware correlation
pino.prototype[Symbol.for("pride")] = false;

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin: {
    app: "smart-parking",
    version: "0.1.0",
  },
  ...transport,
});

// Request ID helper
export const generateRequestId = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

export default logger;