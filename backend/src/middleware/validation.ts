import { Request, Response, NextFunction } from "express";
import { body, param, query, validationResult } from "express-validator";

/**
 * Express validator result handler
 */
export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e: any) => ({
        path: e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

/**
 * Common validation rules
 */
export const validateRegister = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("role").optional().isIn(["ADMIN", "GUARD", "USER"]),
];

export const validateLogin = [
  body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password required"),
];

export const validateReservationCreate = [
  body("facilityId").isUUID().withMessage("Invalid facility ID"),
  body("spaceId").isUUID().withMessage("Invalid space ID"),
  body("startTime").isISO8601().withMessage("Valid start time required"),
  body("endTime").isISO8601().withMessage("Valid end time required"),
  body("vehicleId").optional().isUUID(),
];

export const validateParkingSpaceId = [
  param("id").isUUID().withMessage("Invalid parking space ID"),
];

export const validateReservationId = [
  param("id").isUUID().withMessage("Invalid reservation ID"),
];

export const validateQrToken = [
  body("qrToken").trim().notEmpty().withMessage("QR token required"),
];

export const validatePaymentInit = [
  body("reservationId").optional().isUUID().withMessage("Invalid reservation ID"),
  body("sessionId").optional().isUUID().withMessage("Invalid session ID"),
  body("amount").optional().isInt({ min: 1 }).withMessage("Amount must be positive"),
  body("paymentMethod").isIn(["CLICK", "PAYME", "CASH"]).withMessage("Invalid payment method"),
];

export const validateGuardEntry = [
  body("facilityId").optional().isUUID().withMessage("Invalid facility ID"),
  body("vehicleId").optional().isUUID().withMessage("Invalid vehicle ID"),
  body("licensePlate").optional().trim(),
  body("zoneId").optional().isUUID().withMessage("Invalid zone ID"),
];

export const validateGuardExit = [
  body("qrToken").optional().trim(),
  body("licensePlate").optional().trim(),
  body("spaceId").optional().isUUID().withMessage("Invalid space ID"),
  body("plateSearch").optional().trim(),
];

export const validateAuthMe = [];