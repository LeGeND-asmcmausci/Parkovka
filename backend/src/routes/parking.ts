import { Router, Request, Response, NextFunction } from "express";
import { body, param, validationResult } from "express-validator";
import { validate } from "../middleware/validation";
import { authenticate, authorize } from "../utils/jwt";
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
import { createError, ErrorCodes, ErrorMessages } from "../utils/http-error";

const router = Router();

// Helper: validate request results
const validate = (req: Request, res: NextFunction, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

/**
 * @route GET /api/parking
 * @desc List parking facilities
 * @access Public
 */
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilities = await prisma.parkingFacility.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          description: true,
          city: true,
          country: true,
          hourlyRate: true,
          dailyRate: true,
          status: true,
          _count: {
            select: { floors: true, spaces: true },
          },
        },
        orderBy: { name: "asc" },
      });
      
      res.json({
        success: true,
        data: facilities,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/parking/:id
 * @desc Get parking facility details
 * @access Public
 */
router.get(
  "/:id",
  [
    param("id").isUUID().withMessage("Invalid facility ID"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.params.id;
      
      const facility = await prisma.parkingFacility.findUnique({
        where: { id: facilityId },
        include: {
          floors: {
            include: {
              zones: {
                include: {
                  spaces: {
                    select: {
                      id: true,
                      spaceNumber: true,
                      spaceType: true,
                      status: true,
                    },
                  },
                },
              },
            },
          },
          pricingRules: true,
        },
      });
      
      if (!facility) {
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }
      
      res.json({
        success: true,
        data: facility,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/parking/:id/availability
 * @desc Get real-time availability for a facility
 * @access Public
 */
router.get(
  "/:id/availability",
  [
    param("id").isUUID().withMessage("Invalid facility ID"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.params.id;
      
      // Check if facility exists
      const facility = await prisma.parkingFacility.findUnique({
        where: { id: facilityId },
      });
      
      if (!facility) {
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }
      
      // Get all spaces with their current status
      const spaces = await prisma.parkingSpace.findMany({
        where: { facilityId },
        select: {
          id: true,
          spaceNumber: true,
          spaceType: true,
          status: true,
          pricePerHour: true,
          pricePerDay: true,
          zone: {
            select: {
              name: true,
              zoneCode: true,
            },
          },
          floor: {
            select: {
              name: true,
              level: true,
            },
          },
        },
        orderBy: { floor: { level: 1 }, zone: { zoneCode: 1 } },
      });
      
      // Calculate availability
      const available = spaces.filter(s => s.status === "AVAILABLE").length;
      const occupied = spaces.filter(s => s.status === "OCCUPIED").length;
      const reserved = spaces.filter(s => s.status === "RESERVED").length;
      const maintenance = spaces.filter(s => s.status === "MAINTENANCE").length;
      
      res.json({
        success: true,
        data: {
          facilityId,
          totalSpaces: spaces.length,
          available,
          occupied,
          reserved,
          maintenance,
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
 * @desc Get parking facility map data
 * @access Public
 */
router.get(
  "/:id/map",
  [
    param("id").isUUID().withMessage("Invalid facility ID"),
  ],
  validate,
  async (req: Request, res: Response, NextFunction) => {
    try {
      const facilityId = req.params.id;
      
      const facility = await prisma.parkingFacility.findUnique({
        where: { id: facilityId },
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
        },
      });
      
      if (!facility) {
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }
      
      // Get zone layout
      const zones = await prisma.ParkingZone.findMany({
        where: { floor: { facilityId } },
        include: {
          floor: true,
          spaces: {
            select: {
              id: true,
              spaceNumber: true,
              spaceType: true,
              status: true,
            },
          },
        },
        orderBy: { floor: { level: 1 }, zoneCode: 1 },
      });
      
      res.json({
        success: true,
        data: {
          facility,
          zones,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;