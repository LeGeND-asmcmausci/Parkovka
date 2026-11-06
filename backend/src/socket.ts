/**
 * Socket.IO configuration for live parking map updates.
 *
 * - JWT is verified from handshake auth token or Authorization header.
 * - Anonymous clients may connect read-only (map data is public) and receive
 *   availability/space events; they cannot mutate anything.
 * - Clients can only join/leave facility rooms. All state-changing events are
 *   emitted server-side after successful database transactions.
 */

import type { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import logger from "./utils/logger";
import { extractTokenFromHeader, verifyAccessToken } from "./utils/jwt";
import { setRealtimeServer } from "./utils/realtime";

const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface SocketUser {
  id: string;
  role: string;
  email?: string;
}

export const setupSocketIO = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: CORS_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  setRealtimeServer(io);

  io.use((socket: Socket, next) => {
    const authToken =
      (socket.handshake.auth && (socket.handshake.auth as Record<string, unknown>).token) as
        | string
        | undefined;
    const headerToken = extractTokenFromHeader(socket.handshake.headers.authorization);

    const token = authToken || headerToken || null;

    // Public map listeners may stay anonymous; they only get read access.
    if (!token) {
      socket.data.user = null;
      return next();
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.user = {
        id: String(payload.sub),
        email: typeof payload.email === "string" ? payload.email : undefined,
        role: String(payload.role),
      } satisfies SocketUser;

      return next();
    } catch {
      return next(new Error("Invalid or expired authentication token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket.data.user ?? null) as SocketUser | null;

    // Every connection listens to the public map room.
    socket.join("map");

    if (user) {
      socket.join(`user:${user.id}`);
      if (user.role === "GUARD" || user.role === "ADMIN") {
        socket.join("staff");
      }
    }

    logger.info(
      `Socket.IO connected: ${socket.id} (${user ? `${user.role}:${user.id}` : "anonymous"})`
    );

    socket.on("join:facility", (facilityId: unknown) => {
      if (typeof facilityId !== "string" || !UUID_PATTERN.test(facilityId)) {
        socket.emit("error", { message: "Invalid facility ID" });
        return;
      }
      socket.join(`facility:${facilityId}`);
    });

    socket.on("leave:facility", (facilityId: unknown) => {
      if (typeof facilityId !== "string" || !UUID_PATTERN.test(facilityId)) return;
      socket.leave(`facility:${facilityId}`);
    });

    socket.on("disconnect", () => {
      logger.info(`Socket.IO disconnected: ${socket.id}`);
    });
  });

  return io;
};

export default setupSocketIO;
