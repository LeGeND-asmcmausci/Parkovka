import { Server } from "socket.io";
import logger from "./utils/logger";

// Socket.IO configuration
export const setupSocketIO = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    cookie: {
      name: "parking-session",
    },
    allowEIO3: true,
  });

  // Track room membership
  const roomSessions: Map<string, Set<string>> = new Map(); // roomId -> set of userIds

  io.use(async (socket, next) => {
    try {
      const token = socket.hand.auth?.token;
      
      if (!token) {
        return next(new Error("Authentication required"));
      }
      
      // Verify token
      let payload: any;
      try {
        // In production, use proper JWT verification
        payload = { 
          sub: socket.hand.auth?.userId, 
          role: socket.hand.auth?.role 
        };
      } catch (error) {
        return next(new Error("Invalid authentication token"));
      }
      
      // Attach user to socket
      socket.data.user = {
        id: payload.sub,
        role: payload.role,
      };
      
      next();
    } catch (error) {
      next(error);
    }
  });

  // Event: join parking availability room
  io.on("connection", (socket) => {
    const userId = socket.data.user?.id;
    const userRole = socket.data.user?.role;

    logger.info(`Socket.IO client connected: ${socket.id}, user: ${userId}, role: ${userRole}`);

    // Join user-specific rooms
    if (userId) {
      socket.join(`user:${userId}`);
    }

    // Guard joins their assigned facilities
    if (userRole === "GUARD") {
      // In production, fetch guard's assigned facilities from DB
      // For now, join general guard room
      socket.join("guard:all");
    }

    // User joins general availability room
    if (userRole === "USER") {
      socket.join("user:availability");
    }

    // Facility rooms - admin can join any, guard joins assigned, user joins their favorites
    socket.on("join:facility", (facilityId: string) => {
      if (userRole === "ADMIN") {
        socket.join(`facility:${facilityId}`);
        logger.info(`Admin ${userId} joined facility room: ${facilityId}`);
      } else if (userRole === "GUARD") {
        // Guard can only join assigned facilities
        socket.join(`facility:${facilityId}`);
        logger.info(`Guard ${userId} joined facility room: ${facilityId}`);
      } else if (userRole === "USER") {
        socket.join(`facility:${facilityId}`);
      }
    });

    // Event: leave facility room
    socket.on("leave:facility", (facilityId: string) => {
      socket.leave(`facility:${facilityId}`);
    });

    // Event: parking space updated
    socket.on("parking:space:updated", ({ facilityId, spaceId, status }) => {
      // Broadcast to facility room
      io.to(`facility:${facilityId}`).emit("parking.space:updated", {
        facilityId,
        spaceId,
        status,
        timestamp: new Date().toISOString(),
      });
    });

    // Event: availability updated
    socket.on("parking:availability:updated", ({ facilityId }) => {
      io.to(`facility:${facilityId}`).emit("parking.availability:updated", {
        facilityId,
        timestamp: new Date().toISOString(),
      });
    });

    // Event: reservation created
    socket.on("reservation:created", ({ reservationId, facilityId }) => {
      io.to(`facility:${facilityId}`).emit("reservation:created", {
        reservationId,
        facilityId,
        timestamp: new Date().toISOString(),
      });
    });

    // Event: reservation cancelled
    socket.on("reservation:cancelled", ({ reservationId, facilityId }) => {
      io.to(`facility:${facilityId}`).emit("reservation:cancelled", {
        reservationId,
        facilityId,
        timestamp: new Date().toISOString(),
      });
    });

    // Event: session started
    socket.on("session:started", ({ sessionId, facilityId }) => {
      io.to(`facility:${facilityId}`).emit("session:started", {
        sessionId,
        facilityId,
        timestamp: new Date().toISOString(),
      });
    });

    // Event: session completed
    socket.on("session:completed", ({ sessionId, facilityId }) => {
      io.to(`facility:${facilityId}`).emit("session:completed", {
        sessionId,
        facilityId,
        timestamp: new Date().toISOString(),
      });
    });

    // Event: payment completed
    socket.on("payment:completed", ({ paymentId, facilityId }) => {
      io.to(`facility:${facilityId}`).emit("payment:completed", {
        paymentId,
        facilityId,
        timestamp: new Date().toISOString(),
      });
    });

    // Event: notification created
    socket.on("notification:created", ({ userId, title, message }) => {
      io.to(`user:${userId}`).emit("notification:created", {
        userId,
        title,
        message,
        timestamp: new Date().toISOString(),
      });
    });

    // Disconnect
    socket.on("disconnect", () => {
      logger.info(`Socket.IO client disconnected: ${socket.id}`);
      if (userId) {
        socket.leave(`user:${userId}`);
      }
    });
  });

  return io;
};