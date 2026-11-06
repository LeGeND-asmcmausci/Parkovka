/**
 * Server-side realtime emitters.
 *
 * Route handlers call these AFTER a database transaction commits, so clients
 * never receive events for rolled-back state. Socket.IO is registered here by
 * setupSocketIO so route modules do not depend on the HTTP layer.
 */

import type { Server } from "socket.io";
import type { FacilityAvailability } from "./availability";

let io: Server | null = null;

export const setRealtimeServer = (server: Server): void => {
  io = server;
};

export const getRealtimeServer = (): Server | null => io;

const facilityRooms = (facilityId: string): string[] => [`facility:${facilityId}`, "map"];

export interface SpaceUpdatedPayload {
  facilityId: string;
  spaceId: string;
  spaceNumber: string;
  status: string;
  previousStatus?: string;
  floorId?: string;
  zoneId?: string | null;
  reason?: "RESERVATION_CREATED" | "RESERVATION_CANCELLED" | "CHECK_IN" | "CHECK_OUT" | "STATUS_CHANGED";
}

/**
 * Emit a full availability snapshot for one facility.
 * Chained rooms deliver the event once per socket, even when it joined both.
 */
export const emitAvailability = (availability: FacilityAvailability): void => {
  if (!io) return;

  const payload = {
    ...availability,
    timestamp: new Date().toISOString(),
  };

  try {
    io.to(facilityRooms(availability.facilityId)).emit("parking:availability", payload);
  } catch {
    // Realtime failures must never break an API response.
  }
};

/**
 * Emit a single space status change for one facility.
 */
export const emitSpaceUpdated = (payload: SpaceUpdatedPayload): void => {
  if (!io) return;

  try {
    io.to(facilityRooms(payload.facilityId)).emit("parking:space_updated", {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Realtime failures must never break an API response.
  }
};

/**
 * Recompute availability from the database and emit it.
 */
export const emitAvailabilityForFacility = async (
  facilityId: string
): Promise<void> => {
  if (!io) return;

  const { getFacilityAvailability } = await import("./availability");
  const availability = await getFacilityAvailability(facilityId);
  emitAvailability(availability);
};
