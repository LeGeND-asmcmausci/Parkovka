/**
 * Availability calculation helpers.
 *
 * Every number here is derived from real ParkingSpace rows and live
 * ParkingSession / Reservation records. Nothing is hardcoded.
 */

import { prisma } from "./db";

export interface FacilityAvailability {
  facilityId: string;
  totalSpaces: number;
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  reservedHeld: number;
  activeSessions: number;
  activeReservations: number;
  occupancyRate: number;
  calculatedAt: string;
}

const createEmptyAvailability = (facilityId: string): FacilityAvailability => ({
  facilityId,
  totalSpaces: 0,
  available: 0,
  occupied: 0,
  reserved: 0,
  maintenance: 0,
  reservedHeld: 0,
  activeSessions: 0,
  activeReservations: 0,
  occupancyRate: 0,
  calculatedAt: new Date().toISOString(),
});

const finalize = (availability: FacilityAvailability): FacilityAvailability => {
  availability.totalSpaces =
    availability.available +
    availability.occupied +
    availability.reserved +
    availability.reservedHeld +
    availability.maintenance;

  availability.reserved += availability.reservedHeld;

  availability.occupancyRate =
    availability.totalSpaces > 0
      ? Math.round(((availability.occupied + availability.reserved) / availability.totalSpaces) * 1000) / 10
      : 0;

  availability.calculatedAt = new Date().toISOString();
  return availability;
};

/**
 * Availability for many facilities using three grouped queries (no N+1).
 */
export const getAvailabilityForFacilities = async (
  facilityIds: string[]
): Promise<Map<string, FacilityAvailability>> => {
  const result = new Map<string, FacilityAvailability>();
  const ids = Array.from(new Set(facilityIds.filter(Boolean)));

  for (const id of ids) {
    result.set(id, createEmptyAvailability(id));
  }

  if (ids.length === 0) return result;

  const now = new Date();

  const [spaceGroups, sessionGroups, reservationGroups] = await Promise.all([
    prisma.parkingSpace.groupBy({
      by: ["facilityId", "status"],
      where: { facilityId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.parkingSession.groupBy({
      by: ["facilityId"],
      where: { facilityId: { in: ids }, status: "ACTIVE" },
      _count: { _all: true },
    }),
    prisma.reservation.groupBy({
      by: ["facilityId"],
      where: {
        facilityId: { in: ids },
        status: "CONFIRMED",
        endTime: { gt: now },
      },
      _count: { _all: true },
    }),
  ]);

  for (const group of spaceGroups) {
    const availability = result.get(group.facilityId);
    if (!availability) continue;

    const count = group._count?._all ?? 0;

    switch (group.status) {
      case "AVAILABLE":
        availability.available += count;
        break;
      case "OCCUPIED":
        availability.occupied += count;
        break;
      case "RESERVED":
        availability.reserved += count;
        break;
      case "RESERVED_HELD":
        availability.reservedHeld += count;
        break;
      case "MAINTENANCE":
        availability.maintenance += count;
        break;
      default:
        break;
    }
  }

  for (const group of sessionGroups) {
    const availability = result.get(group.facilityId);
    if (!availability) continue;
    availability.activeSessions = group._count?._all ?? 0;
  }

  for (const group of reservationGroups) {
    const availability = result.get(group.facilityId);
    if (!availability) continue;
    availability.activeReservations = group._count?._all ?? 0;
  }

  for (const availability of result.values()) {
    finalize(availability);
  }

  return result;
};

/**
 * Availability for a single facility.
 */
export const getFacilityAvailability = async (facilityId: string): Promise<FacilityAvailability> => {
  const map = await getAvailabilityForFacilities([facilityId]);
  return map.get(facilityId) ?? finalize(createEmptyAvailability(facilityId));
};
