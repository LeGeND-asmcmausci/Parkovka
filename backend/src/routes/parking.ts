import { Router, Request, Response, NextFunction } from "express";
import { param, query } from "express-validator";
import { validate } from "../middleware/validation";
import { prisma } from "../utils/db";
import { createError, ErrorMessages } from "../utils/http-error";
import {
  getAvailabilityForFacilities,
  getFacilityAvailability,
} from "../utils/availability";

const router = Router();

const PARKING_TYPES = ["SURFACE", "UNDERGROUND", "MULTI_LEVEL", "STREET"];
const SPACE_STATUSES = ["AVAILABLE", "RESERVED", "OCCUPIED", "MAINTENANCE", "RESERVED_HELD"];

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

/** Decimal columns (latitude/longitude) must never leak as strings to the map. */
const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const publicFacilitySelect = {
  id: true,
  name: true,
  description: true,
  address: true,
  city: true,
  country: true,
  latitude: true,
  longitude: true,
  openingHours: true,
  parkingType: true,
  covered: true,
  status: true,
  hourlyRate: true,
  dailyRate: true,
  currency: true,
  timezone: true,
  totalSpaces: true,
  _count: { select: { floors: true, ParkingSpace: true } },
} as const;

const serializeFacility = (facility: any, availability?: any) => ({
  id: facility.id,
  name: facility.name,
  description: facility.description,
  address: facility.address,
  city: facility.city,
  country: facility.country,
  // Geographic coordinate format: WGS84 decimal degrees as numbers.
  coordinates: {
    latitude: toNumber(facility.latitude),
    longitude: toNumber(facility.longitude),
  },
  latitude: toNumber(facility.latitude),
  longitude: toNumber(facility.longitude),
  openingHours: facility.openingHours,
  parkingType: facility.parkingType,
  covered: facility.covered,
  status: facility.status,
  pricing: {
    hourlyRate: facility.hourlyRate,
    dailyRate: facility.dailyRate,
    currency: facility.currency,
  },
  currency: facility.currency,
  timezone: facility.timezone,
  totalSpaces: availability?.totalSpaces ?? facility.totalSpaces,
  floorCount: facility._count?.floors ?? 0,
  spaceCount: facility._count?.ParkingSpace ?? 0,
  _count: facility._count
    ? { floors: facility._count.floors, spaces: facility._count.ParkingSpace }
    : undefined,
  availability: availability ?? null,
});

const statusCounts = (spaces: Array<{ status: string }>) => {
  const counts: Record<string, number> = {
    AVAILABLE: 0,
    OCCUPIED: 0,
    RESERVED: 0,
    RESERVED_HELD: 0,
    MAINTENANCE: 0,
  };

  for (const space of spaces) {
    if (counts[space.status] === undefined) counts[space.status] = 0;
    counts[space.status] += 1;
  }

  return {
    totalSpaces: spaces.length,
    available: counts.AVAILABLE,
    occupied: counts.OCCUPIED,
    reserved: counts.RESERVED + counts.RESERVED_HELD,
    maintenance: counts.MAINTENANCE,
  };
};

/**
 * @route GET /api/parking
 * @desc List active parking facilities with live availability
 * @access Public
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const facilities = await prisma.parkingFacility.findMany({
      where: { status: "ACTIVE" },
      select: publicFacilitySelect,
      orderBy: { name: "asc" },
    });

    const availability = await getAvailabilityForFacilities(facilities.map((f) => f.id));

    res.json({
      success: true,
      data: facilities.map((facility) =>
        serializeFacility(facility, availability.get(facility.id) ?? null)
      ),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/parking/map
 * @desc City parking map: active facilities with coordinates and live availability
 * @access Public
 */
router.get(
  "/map",
  [
    query("city").optional().isString().trim().isLength({ max: 100 }),
    query("parkingType").optional().isIn(PARKING_TYPES).withMessage("Invalid parking type"),
    query("north").optional().isFloat({ min: -90, max: 90 }).withMessage("north must be between -90 and 90"),
    query("south").optional().isFloat({ min: -90, max: 90 }).withMessage("south must be between -90 and 90"),
    query("east").optional().isFloat({ min: -180, max: 180 }).withMessage("east must be between -180 and 180"),
    query("west").optional().isFloat({ min: -180, max: 180 }).withMessage("west must be between -180 and 180"),
    query("limit").optional().isInt({ min: 1, max: 500 }).withMessage("limit must be between 1 and 500"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const city = asString(req.query.city);
      const parkingType = asString(req.query.parkingType);
      const north = asString(req.query.north);
      const south = asString(req.query.south);
      const east = asString(req.query.east);
      const west = asString(req.query.west);
      const limit = asString(req.query.limit);

      const hasNorthSouth = north !== undefined || south !== undefined;
      const hasEastWest = east !== undefined || west !== undefined;

      if (hasNorthSouth && (north === undefined || south === undefined)) {
        return next(createError(400, "north and south must be provided together"));
      }
      if (hasEastWest && (east === undefined || west === undefined)) {
        return next(createError(400, "east and west must be provided together"));
      }
      if (hasNorthSouth && Number(north) < Number(south)) {
        return next(createError(400, "north must be greater than or equal to south"));
      }
      if (hasEastWest && Number(east) < Number(west)) {
        return next(createError(400, "east must be greater than or equal to west"));
      }

      const where: any = { status: "ACTIVE" };

      if (typeof city === "string" && city.trim()) {
        where.city = { equals: city.trim(), mode: "insensitive" };
      }
      if (typeof parkingType === "string" && parkingType) {
        where.parkingType = parkingType;
      }
      if (hasNorthSouth) {
        where.latitude = { gte: Number(south), lte: Number(north) };
      }
      if (hasEastWest) {
        where.longitude = { gte: Number(west), lte: Number(east) };
      }

      const facilities = await prisma.parkingFacility.findMany({
        where,
        select: publicFacilitySelect,
        orderBy: { name: "asc" },
        take: limit ? Number(limit) : 200,
      });

      const availability = await getAvailabilityForFacilities(facilities.map((f) => f.id));

      const data = facilities
        .map((facility) => serializeFacility(facility, availability.get(facility.id) ?? null))
        .filter((facility) => facility.latitude !== null && facility.longitude !== null);

      res.json({
        success: true,
        data,
        meta: {
          count: data.length,
          filters: {
            city: city ?? null,
            parkingType: parkingType ?? null,
            bounds:
              hasNorthSouth && hasEastWest
                ? {
                    north: Number(north),
                    south: Number(south),
                    east: Number(east),
                    west: Number(west),
                  }
                : null,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/parking/:id
 * @desc Facility details with live availability, floors and pricing rules
 * @access Public
 */
router.get(
  "/:id",
  [param("id").isUUID().withMessage("Invalid facility ID")],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = String(req.params.id);

      const facility = await prisma.parkingFacility.findUnique({
        where: { id: facilityId },
        select: publicFacilitySelect,
      });

      if (!facility) {
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }

      const [availability, floors, pricingRules] = await Promise.all([
        getFacilityAvailability(facilityId),
        prisma.parkingFloor.findMany({
          where: { facilityId },
          orderBy: { level: "asc" },
          select: {
            id: true,
            name: true,
            floorName: true,
            level: true,
            totalSpaces: true,
            status: true,
            _count: { select: { spaces: true, zones: true } },
          },
        }),
        prisma.pricingRule.findMany({
          where: { facilityId },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      res.json({
        success: true,
        data: {
          ...serializeFacility(facility, availability),
          floors,
          pricingRules,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/parking/:id/floors
 * @desc Indoor map: floors, zones and space status layout
 * @access Public
 */
router.get(
  "/:id/floors",
  [param("id").isUUID().withMessage("Invalid facility ID")],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = String(req.params.id);

      const facility = await prisma.parkingFacility.findUnique({
        where: { id: facilityId },
        select: { id: true, name: true, totalSpaces: true },
      });

      if (!facility) {
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }

      const floors = await prisma.parkingFloor.findMany({
        where: { facilityId },
        orderBy: { level: "asc" },
        select: {
          id: true,
          name: true,
          floorName: true,
          level: true,
          totalSpaces: true,
          status: true,
          zones: {
            orderBy: { zoneCode: "asc" },
            select: {
              id: true,
              name: true,
              zoneCode: true,
              zoneType: true,
              totalSpaces: true,
              covered: true,
              status: true,
              spaces: {
                orderBy: { spaceNumber: "asc" },
                select: {
                  id: true,
                  spaceNumber: true,
                  spaceType: true,
                  status: true,
                  pricePerHour: true,
                  pricePerDay: true,
                },
              },
            },
          },
          spaces: {
            orderBy: { spaceNumber: "asc" },
            select: {
              id: true,
              spaceNumber: true,
              spaceType: true,
              status: true,
              zoneId: true,
            },
          },
        },
      });

      const data = floors.map((floor) => {
        const floorCounts = statusCounts(floor.spaces);

        return {
          id: floor.id,
          name: floor.name,
          floorName: floor.floorName,
          level: floor.level,
          status: floor.status,
          totalSpaces: floorCounts.totalSpaces,
          availability: floorCounts,
          zones: floor.zones.map((zone) => ({
            id: zone.id,
            name: zone.name,
            zoneCode: zone.zoneCode,
            zoneType: zone.zoneType,
            covered: zone.covered,
            status: zone.status,
            totalSpaces: zone.spaces.length,
            availability: statusCounts(zone.spaces),
            spaces: zone.spaces,
          })),
          unzonedSpaces: floor.spaces
            .filter((space) => !space.zoneId)
            .map(({ id, spaceNumber, spaceType, status }) => ({
              id,
              spaceNumber,
              spaceType,
              status,
            })),
        };
      });

      res.json({
        success: true,
        data: {
          facilityId: facility.id,
          facilityName: facility.name,
          floors: data,
          availability: await getFacilityAvailability(facilityId),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/parking/:id/spaces
 * @desc List spaces of a facility with filters and pagination
 * @access Public
 */
router.get(
  "/:id/spaces",
  [
    param("id").isUUID().withMessage("Invalid facility ID"),
    query("status").optional().isIn(SPACE_STATUSES).withMessage("Invalid space status"),
    query("floorId").optional().isUUID().withMessage("Invalid floor ID"),
    query("zoneId").optional().isUUID().withMessage("Invalid zone ID"),
    query("spaceType").optional().isString().trim().isLength({ max: 50 }),
    query("page").optional().isInt({ min: 1 }).withMessage("page must be >= 1"),
    query("limit").optional().isInt({ min: 1, max: 500 }).withMessage("limit must be between 1 and 500"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = String(req.params.id);
      const status = asString(req.query.status);
      const floorId = asString(req.query.floorId);
      const zoneId = asString(req.query.zoneId);
      const spaceType = asString(req.query.spaceType);

      const facility = await prisma.parkingFacility.findUnique({
        where: { id: facilityId },
        select: { id: true },
      });

      if (!facility) {
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }

      const page = Number(asString(req.query.page)) || 1;
      const limit = Number(asString(req.query.limit)) || 100;

      const where: any = { facilityId };
      if (status) where.status = status;
      if (floorId) where.floorId = floorId;
      if (zoneId) where.zoneId = zoneId;
      if (spaceType) where.spaceType = spaceType;

      const [total, spaces] = await Promise.all([
        prisma.parkingSpace.count({ where }),
        prisma.parkingSpace.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ floor: { level: "asc" } }, { zoneName: "asc" }, { spaceNumber: "asc" }],
          select: {
            id: true,
            spaceNumber: true,
            spaceType: true,
            status: true,
            level: true,
            zoneName: true,
            pricePerHour: true,
            pricePerDay: true,
            maxStayDuration: true,
            floorId: true,
            zoneId: true,
            floor: { select: { id: true, name: true, floorName: true, level: true } },
            zone: { select: { id: true, name: true, zoneCode: true, zoneType: true } },
          },
        }),
      ]);

      res.json({
        success: true,
        data: spaces,
        meta: {
          facilityId,
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/parking/:id/availability
 * @desc Real-time availability derived from ParkingSpace and ParkingSession data
 * @access Public
 */
router.get(
  "/:id/availability",
  [param("id").isUUID().withMessage("Invalid facility ID")],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = String(req.params.id);

      const facility = await prisma.parkingFacility.findUnique({
        where: { id: facilityId },
        select: { id: true, name: true },
      });

      if (!facility) {
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }

      const availability = await getFacilityAvailability(facilityId);

      const spaces = await prisma.parkingSpace.findMany({
        where: { facilityId },
        select: {
          id: true,
          spaceNumber: true,
          spaceType: true,
          status: true,
          pricePerHour: true,
          pricePerDay: true,
          zone: { select: { id: true, name: true, zoneCode: true } },
          floor: { select: { id: true, name: true, level: true } },
        },
        orderBy: [{ floor: { level: "asc" } }, { zoneName: "asc" }, { spaceNumber: "asc" }],
      });

      res.json({
        success: true,
        data: {
          facilityId: availability.facilityId,
          ...availability,
          spaces,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/parking/:id/map
 * @desc Indoor layout: zones with their spaces and the facility coordinates
 * @access Public
 */
router.get(
  "/:id/map",
  [param("id").isUUID().withMessage("Invalid facility ID")],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = String(req.params.id);

      const facility = await prisma.parkingFacility.findUnique({
        where: { id: facilityId },
        select: publicFacilitySelect,
      });

      if (!facility) {
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }

      const zones = await prisma.parkingZone.findMany({
        where: { floor: { facilityId } },
        orderBy: [{ floor: { level: "asc" } }, { zoneCode: "asc" }],
        select: {
          id: true,
          name: true,
          zoneCode: true,
          zoneType: true,
          covered: true,
          status: true,
          totalSpaces: true,
          floor: { select: { id: true, name: true, floorName: true, level: true } },
          spaces: {
            orderBy: { spaceNumber: "asc" },
            select: {
              id: true,
              spaceNumber: true,
              spaceType: true,
              status: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: {
          facility: serializeFacility(facility, await getFacilityAvailability(facilityId)),
          zones: zones.map((zone) => ({
            ...zone,
            totalSpaces: zone.spaces.length,
            availability: statusCounts(zone.spaces),
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
