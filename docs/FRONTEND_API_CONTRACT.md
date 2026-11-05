# Smart Parking Management System - Frontend API Contract

## Overview
This document describes the API contract between the backend (Codebuff) and frontend (Qoder) for the Smart Parking Management System.

**Base URL:** `http://localhost:3001/api`
**API Version:** v1
**Authentication:** JWT Bearer token in `Authorization: Bearer <token>` header

---

## Authentication Endpoints

### POST /api/auth/register
**Description:** Register a new user account
**Authentication:** Public
**Request Body:**
```json
{
  "name": "string (required)",
  "email": "string (valid email, required)",
  "password": "string (minimum 6 characters, required)",
  "role": "enum: ADMIN, GUARD, USER (optional, defaults to USER)"
}
```
**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "string",
      "email": "string",
      "role": "enum",
      "status": "ACTIVE"
    },
    "tokens": {
      "accessToken": "string (JWT)",
      "refreshToken": "string"
    }
  },
  "message": "User registered successfully"
}
```

### POST /api/auth/login
**Description:** Login user and obtain tokens
**Authentication:** Public
**Request Body:**
```json
{
  "email": "string (valid email, required)",
  "password": "string (required)"
}
```
**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "string",
      "email": "string",
      "role": "enum",
      "status": "ACTIVE"
    },
    "tokens": {
      "accessToken": "string (JWT)",
      "refreshToken": "string"
    }
  },
  "message": "Login successful"
}
```

### POST /api/auth/refresh
**Description:** Refresh access token using refresh token
**Authentication:** Public
**Request Headers:**
```http
Authorization: Bearer <refresh_token>
```
**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "string (JWT)",
    "refreshToken": "string"
  }
}
```

### POST /api/auth/logout
**Description:** Logout and revoke refresh token
**Authentication:** Private (requires access token)
**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### GET /api/auth/me
**Description:** Get current user profile
**Authentication:** Private
**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "email": "string",
    "role": "enum",
    "phone": "string (nullable)",
    "licensePlate": "string (nullable)",
    "status": "enum (ACTIVE/INACTIVE/SUSPENDED)",
    "createdAt": "ISO datetime",
    "updatedAt": "ISO datetime"
  }
}
```

---

## User Endpoints

### GET /api/users/me
**Description:** Get current user profile (alias for auth/me)
**Authentication:** Private

### PATCH /api/users/profile
**Description:** Update user profile
**Authentication:** Private
**Request Body:**
```json
{
  "name": "string (optional)",
  "phone": "string (optional)",
  "licensePlate": "string (optional)"
}
```

### GET /api/users
**Description:** List all users (admin only)
**Authentication:** Private - Admin only
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "email": "string",
      "role": "enum",
      "status": "enum",
      "createdAt": "ISO datetime"
    }
  ]
}
```

---

## Parking Facility Endpoints

### GET /api/parking
**Description:** List all active parking facilities
**Authentication:** Public
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string (nullable)",
      "city": "string (default: Tashkent)",
      "country": "string (default: Uzbekistan)",
      "hourlyRate": "integer (UZS)",
      "dailyRate": "integer (UZS)",
      "status": "enum",
      "_count": {
        "floors": number,
        "spaces": number
      }
    }
  ]
}
```

### GET /api/parking/:id
**Description:** Get parking facility details with map data
**Authentication:** Public
**URL Params:** `id` (UUID, required)
**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "address": "string",
    "latitude": "decimal",
    "longitude": "decimal",
    "floors": [...],
    "pricingRules": [...]
  }
}
```

### GET /api/parking/:id/availability
**Description:** Get real-time parking space availability
**Authentication:** Public
**URL Params:** `id` (UUID, required)
**Response (200):**
```json
{
  "success": true,
  "data": {
    "facilityId": "uuid",
    "totalSpaces": number,
    "available": number,
    "occupied": number,
    "reserved": number,
    "maintenance": number,
    "spaces": [
      {
        "id": "uuid",
        "spaceNumber": "string",
        "spaceType": "enum (regular/disabled/EV/VIP)",
        "status": "enum",
        "zone": {
          "name": "string",
          "zoneCode": "string"
        },
        "floor": {
          "name": "string",
          "level": number
        },
        "pricePerHour": "integer (UZS)",
        "pricePerDay": "integer (UZS)"
      }
    ]
  }
}
```

### GET /api/parking/:id/map
**Description:** Get parking facility map/layout data
**Authentication:** Public
**URL Params:** `id` (UUID, required)
**Response (200):** Facility map with zone layout

---

## Reservation Endpoints

### POST /api/reservations
**Description:** Create advance reservation
**Authentication:** Private (USER or GUARD)
**URL Params:** None
**Request Body:**
```json
{
  "facilityId": "uuid (required)",
  "spaceId": "uuid (required)",
  "startTime": "ISO datetime string (required)",
  "endTime": "ISO datetime string (required)",
  "vehicleId": "uuid (optional)"
}
```
**Response (201):**
```json
{
  "success": true,
  "data": {
    "reservation": {
      "id": "uuid",
      "user": { "id": "uuid", "name": "string", "email": "string" },
      "space": {
        "id": "uuid",
        "spaceNumber": "string",
        "zone": { "name": "string", "zoneCode": "string" },
        "floor": { "name": "string", "level": number }
      },
      "startTime": "ISO datetime",
      "endTime": "ISO datetime",
      "status": "CONFIRMED",
      "paymentStatus": "PENDING",
      "priceCents": integer,
      "currency": "UZS"
    },
    "qrToken": "string (cryptographically secure token for entry)",
    "message": "Reservation created successfully"
  }
}
```

### GET /api/reservations
**Description:** List user's reservations
**Authentication:** Private
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "space": {
        "id": "uuid",
        "spaceNumber": "string",
        "zone": { "zoneCode": "string" },
        "floor": { "level": number }
      },
      "startTime": "ISO datetime",
      "endTime": "ISO datetime",
      "status": "enum",
      "paymentStatus": "enum",
      "createdAt": "ISO datetime"
    }
  ]
}
```

### GET /api/reservations/:id
**Description:** Get reservation details
**Authentication:** Private (owner or admin)
**URL Params:** `id` (UUID, required)
**Response (200):** Full reservation object

### POST /api/reservations/:id/cancel
**Description:** Cancel a reservation
**Authentication:** Private (owner or admin)
**URL Params:** `id` (UUID, required)
**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "CANCELLED",
    "canceledAt": "ISO datetime"
  },
  "message": "Reservation cancelled successfully"
}
```

---

## Guard Endpoints

### POST /api/guard/entry
**Description:** Guard vehicle entry (walk-in or recognized)
**Authentication:** Private - GUARD only
**Request Body:**
```json
{
  "facilityId": "uuid (optional)",
  "vehicleId": "uuid (optional)",
  "licensePlate": "string (optional)",
  "zoneId": "uuid (optional)"
}
```
**Response (200):**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "vehicle": { "plateNumber": "string" },
      "space": {
        "id": "uuid",
        "spaceNumber": "string",
        "zone": { "zoneCode": "string" },
        "floor": { "level": number }
      },
      "entryTime": "ISO datetime",
      "expectedExit": "ISO datetime",
      "status": "ACTIVE",
      "basePriceCents": integer,
      "finalPriceCents": integer
    },
    "qrToken": "string",
    "estimatedPrice": integer,
    "estimatedExit": "ISO datetime",
    "message": "Vehicle entry recorded successfully"
  }
}
```

### POST /api/guard/exit
**Description:** Guard vehicle exit
**Authentication:** Private - GUARD only
**Request Body (one of):**
```json
// Option 1: QR token
{ "qrToken": "string" }

// Option 2: License plate
{ "licensePlate": "string" }

// Option 3: Space ID
{ "spaceId": "uuid" }

// Option 4: Plate search
{ "plateSearch": "string" }
```
**Response (200):**
```json
{
  "success": true,
  "data": {
    "session": { ... },
    "finalPriceCents": integer,
    "durationMinutes": integer,
    "exitQrToken": "string",
    "message": "Vehicle exit recorded successfully"
  }
}
```

### POST /api/guard/verify-qr
**Description:** Verify QR code validity
**Authentication:** Private - GUARD only
**Request Body:**
```json
{ "qrToken": "string" }
```
**Response (200):**
```json
{
  "success": true,
  "data": {
    "valid": boolean,
    "purpose": "entry|exit|reservation",
    "parkingSessionId": "uuid (nullable)",
    "expiresAt": "ISO datetime"
  }
}
```

### GET /api/guard/sessions
**Description:** Get guard's active sessions
**Authentication:** Private - GUARD only

---

## Payment Endpoints

### POST /api/payments
**Description:** Initiate payment for reservation or session
**Authentication:** Private (USER or ADMIN)
**Request Body:**
```json
{
  "reservationId": "uuid (optional)",
  "sessionId": "uuid (optional)",
  "amount": "integer (UZS, optional - defaults to reservation/session price)",
  "paymentMethod": "enum: CLICK, PAYME, CASH (required)",
  "description": "string (optional)"
}
```
**Response (200):**
```json
{
  "success": true,
  "data": {
    "paymentId": "uuid",
    "amount": integer,
    "currency": "UZS",
    "paymentMethod": "enum",
    "status": "PENDING",
    "providerUrl": "string (payment provider redirect URL)"
  },
  "message": "Payment initiation started"
}
```

### POST /api/payments/click/callback
**Description:** Click payment provider callback
**Authentication:** Public (payment provider callback endpoint)
**Request Body:**
```json
{
  "transactionId": "string (required)",
  "status": "enum: success|failure (required)",
  "amount": "integer (optional)",
  "signature": "string (optional)"
}
```

### POST /api/payments/payme/callback
**Description:** Payme payment provider callback
**Authentication:** Public (payment provider callback endpoint)
**Request Body:**
```json
{
  "merchantTxId": "string (required)",
  "status": "enum: success|failure (required)",
  "amount": "integer (optional)",
  "sign": "string (optional)"
}
```

### GET /api/payments
**Description:** List user's payments
**Authentication:** Private

---

## Socket.IO Events

### Events (client -> server)

#### `parking.space.updated`
Emitted when a parking space status changes.
```json
{
  "facilityId": "uuid",
  "spaceId": "uuid",
  "status": "AVAILABLE|OCCUPIED|RESERVED|MAINTENANCE"
}
```

#### `parking.availability.updated`
Emitted when availability changes for a facility.
```json
{
  "facilityId": "uuid",
  "available": number,
  "occupied": number,
  "reserved": number
}
```

#### `reservation.created`
Emitted when a new reservation is created.
```json
{
  "reservationId": "uuid",
  "facilityId": "uuid"
}
```

#### `reservation.cancelled`
Emitted when a reservation is cancelled.
```json
{
  "reservationId": "uuid",
  "facilityId": "uuid"
}
```

#### `session.started`
Emitted when a parking session starts (walk-in).
```json
{
  "sessionId": "uuid",
  "facilityId": "uuid"
}
```

#### `session.completed`
Emitted when a parking session ends.
```json
{
  "sessionId": "uuid",
  "facilityId": "uuid"
}
```

#### `payment.completed`
Emitted when a payment is completed.
```json
{
  "paymentId": "uuid",
  "facilityId": "uuid"
}
```

#### `notification.created`
Emitted when a new notification is created for a user.
```json
{
  "userId": "uuid",
  "title": "string",
  "message": "string"
}
```

### Rooms
- `user:{userId}` - User-specific room
- `facility:{facilityId}` - Facility-specific room
- `guard:all` - General guard room
- `user:availability` - General availability room

---

## Error Response Format

All API errors follow this format:
```json
{
  "success": false,
  "message": "error description string",
  "errors": [...], // optional, validation errors
  "data": {...} // optional, error details
}
```

**HTTP Status Codes:**
- 400 - Bad Request (validation failed)
- 401 - Unauthorized (missing/invalid token)
- 403 - Forbidden (insufficient permissions)
- 404 - Not Found
- 409 - Conflict (duplicate resource, overlapping reservation)
- 422 - Unprocessable Entity
- 500 - Internal Server Error

**Error Messages Key:**
- `VALIDATION_FAILED` - Request validation failed
- `UNAUTHORIZED_ACCESS` - Missing or invalid authentication token
- `FORBIDDEN_ACCESS` - Insufficient permissions for this resource
- `NOT_FOUND` - Requested resource not found
- `CONFLICT` - Resource conflict (e.g., duplicate, overlapping)
- `RESERVATION_CONFLICT` - Space already booked/reserved
- `QR_CODE_INVALID` - Invalid or expired QR code
- `QR_CODE_USED` - QR code already used (one-time)
- `PAYMENT_FAILED` - Payment processing failed