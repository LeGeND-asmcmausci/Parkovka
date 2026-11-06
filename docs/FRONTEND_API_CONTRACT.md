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

All map endpoints are **public** (no JWT) and never expose private user data
(no names, emails, plate numbers or session ownership).

### Conventions

- **Coordinates:** `latitude` / `longitude` are WGS84 decimal degrees returned as
  JSON **numbers** (e.g. `41.311081`), never strings. Both `coordinates: { latitude, longitude }`
  and flat `latitude` / `longitude` are provided for map libraries.
- **Money:** integer UZS. No floating point.
- **`openingHours`:** free-form string, e.g. `"24/7"` or `"08:00-22:00"`.
- **`parkingType`:** `SURFACE | UNDERGROUND | MULTI_LEVEL | STREET`.
- **Availability** is always computed from real `ParkingSpace` status rows plus live
  `ParkingSession` / `Reservation` counts. No hardcoded values.
- Only `ACTIVE` facilities appear in map/list responses.

Availability object (used by several endpoints):

```json
{
  "facilityId": "uuid",
  "totalSpaces": 120,
  "available": 74,
  "occupied": 38,
  "reserved": 6,
  "maintenance": 2,
  "reservedHeld": 0,
  "activeSessions": 38,
  "activeReservations": 6,
  "occupancyRate": 36.7,
  "calculatedAt": "ISO datetime"
}
```

`reserved` already includes `reservedHeld`. `occupancyRate` is a percentage with one decimal.

---

### GET /api/parking
**Description:** List active facilities with live availability.
**Authentication:** Public
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Central Parking",
      "description": "string | null",
      "address": "1 Amir Temur Avenue",
      "city": "Tashkent",
      "country": "Uzbekistan",
      "coordinates": { "latitude": 41.311081, "longitude": 69.279737 },
      "latitude": 41.311081,
      "longitude": 69.279737,
      "openingHours": "24/7",
      "parkingType": "MULTI_LEVEL",
      "covered": true,
      "status": "ACTIVE",
      "pricing": { "hourlyRate": 5000, "dailyRate": 40000, "currency": "UZS" },
      "currency": "UZS",
      "timezone": "Asia/Tashkent",
      "totalSpaces": 120,
      "floorCount": 3,
      "spaceCount": 120,
      "_count": { "floors": 3, "spaces": 120 },
      "availability": { "available": 74, "occupied": 38, "reserved": 6, "maintenance": 2 }
    }
  ]
}
```

### GET /api/parking/map
**Description:** City map data. Active facilities with coordinates and live availability.
**Authentication:** Public
**Query params (all optional):**

| Param | Type | Rules |
|---|---|---|
| `city` | string | case-insensitive match, max 100 chars |
| `parkingType` | enum | `SURFACE`, `UNDERGROUND`, `MULTI_LEVEL`, `STREET` |
| `north` | number | -90..90, requires `south` |
| `south` | number | -90..90, requires `north` |
| `east` | number | -180..180, requires `west` |
| `west` | number | -180..180, requires `east` |
| `limit` | integer | 1..500, default 200 |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Central Parking",
      "address": "1 Amir Temur Avenue",
      "city": "Tashkent",
      "coordinates": { "latitude": 41.311081, "longitude": 69.279737 },
      "openingHours": "24/7",
      "parkingType": "MULTI_LEVEL",
      "pricing": { "hourlyRate": 5000, "dailyRate": 40000, "currency": "UZS" },
      "availability": {
        "totalSpaces": 120,
        "available": 74,
        "occupied": 38,
        "reserved": 6,
        "maintenance": 2,
        "activeSessions": 38,
        "activeReservations": 6,
        "occupancyRate": 36.7
      }
    }
  ],
  "meta": {
    "count": 1,
    "filters": {
      "city": "Tashkent",
      "parkingType": null,
      "bounds": { "north": 41.5, "south": 41.0, "east": 69.5, "west": 69.0 }
    }
  }
}
```

**Errors:**
- `400` — invalid coordinate/type/limit, `north < south`, `east < west`, or only one of a bound pair supplied.

**Example:** `GET /api/parking/map?city=Tashkent&north=41.5&south=41.0&east=69.5&west=69.0`

### GET /api/parking/:id
**Description:** Facility detail with live availability, floor summaries and pricing rules.
**Authentication:** Public
**URL Params:** `id` (UUID, required)
**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Central Parking",
    "address": "1 Amir Temur Avenue",
    "coordinates": { "latitude": 41.311081, "longitude": 69.279737 },
    "openingHours": "24/7",
    "parkingType": "MULTI_LEVEL",
    "pricing": { "hourlyRate": 5000, "dailyRate": 40000, "currency": "UZS" },
    "availability": { "totalSpaces": 120, "available": 74, "occupied": 38, "reserved": 6 },
    "floors": [
      {
        "id": "uuid",
        "name": "Ground",
        "floorName": "Ground",
        "level": 0,
        "totalSpaces": 40,
        "status": "ACTIVE",
        "_count": { "spaces": 40, "zones": 2 }
      }
    ],
    "pricingRules": []
  }
}
```
**Errors:** `400` invalid UUID, `404` not found.

### GET /api/parking/:id/floors
**Description:** Indoor map layout — floors, zones and their spaces with live status.
**Authentication:** Public
**Response (200):**
```json
{
  "success": true,
  "data": {
    "facilityId": "uuid",
    "facilityName": "Central Parking",
    "floors": [
      {
        "id": "uuid",
        "name": "Ground",
        "floorName": "Ground",
        "level": 0,
        "status": "ACTIVE",
        "totalSpaces": 40,
        "availability": { "totalSpaces": 40, "available": 24, "occupied": 12, "reserved": 2, "maintenance": 2 },
        "zones": [
          {
            "id": "uuid",
            "name": "Zone A",
            "zoneCode": "A",
            "zoneType": "regular",
            "covered": false,
            "status": "ACTIVE",
            "totalSpaces": 20,
            "availability": { "totalSpaces": 20, "available": 12, "occupied": 7, "reserved": 1, "maintenance": 0 },
            "spaces": [
              {
                "id": "uuid",
                "spaceNumber": "A-1",
                "spaceType": "regular",
                "status": "AVAILABLE",
                "pricePerHour": 5000,
                "pricePerDay": 40000
              }
            ]
          }
        ],
        "unzonedSpaces": [
          { "id": "uuid", "spaceNumber": "G-1", "spaceType": "regular", "status": "AVAILABLE" }
        ]
      }
    ],
    "availability": { "totalSpaces": 120, "available": 74, "occupied": 38, "reserved": 6 }
  }
}
```

`space.status` is `AVAILABLE | RESERVED | OCCUPIED | MAINTENANCE | RESERVED_HELD`.
`unzonedSpaces` lists spaces with no zone (ground-level/legacy rows).

### GET /api/parking/:id/spaces
**Description:** Flat, paginated space list with filters.
**Authentication:** Public
**Query params:** `status`, `floorId` (UUID), `zoneId` (UUID), `spaceType`, `page` (>=1, default 1), `limit` (1..500, default 100)
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "spaceNumber": "A-1",
      "spaceType": "regular",
      "status": "AVAILABLE",
      "level": 0,
      "zoneName": "A",
      "pricePerHour": 5000,
      "pricePerDay": 40000,
      "maxStayDuration": 0,
      "floorId": "uuid",
      "zoneId": "uuid",
      "floor": { "id": "uuid", "name": "Ground", "floorName": "Ground", "level": 0 },
      "zone": { "id": "uuid", "name": "Zone A", "zoneCode": "A", "zoneType": "regular" }
    }
  ],
  "meta": { "facilityId": "uuid", "page": 1, "limit": 100, "total": 120, "totalPages": 2 }
}
```

### GET /api/parking/:id/availability
**Description:** Availability snapshot plus every space of the facility.
**Authentication:** Public
**Response (200):** the availability object (above) merged with `spaces[]`
(`id`, `spaceNumber`, `spaceType`, `status`, `pricePerHour`, `pricePerDay`, `zone`, `floor`).

### GET /api/parking/:id/map
**Description:** Indoor layout by zone (compatibility endpoint used by older clients).
**Authentication:** Public
**Response (200):**
```json
{
  "success": true,
  "data": {
    "facility": { "id": "uuid", "name": "Central Parking", "coordinates": { "latitude": 41.311081, "longitude": 69.279737 }, "availability": {} },
    "zones": [
      {
        "id": "uuid",
        "name": "Zone A",
        "zoneCode": "A",
        "zoneType": "regular",
        "floor": { "id": "uuid", "name": "Ground", "level": 0 },
        "totalSpaces": 20,
        "availability": { "totalSpaces": 20, "available": 12, "occupied": 7, "reserved": 1, "maintenance": 0 },
        "spaces": [{ "id": "uuid", "spaceNumber": "A-1", "spaceType": "regular", "status": "AVAILABLE" }]
      }
    ]
  }
}
```

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

### Connection and authentication

```js
import { io } from "socket.io-client";

const socket = io(API_ORIGIN, {
  auth: { token: accessToken }, // optional
  transports: ["websocket"],
});
```

- The server verifies the JWT from `auth.token` or an `Authorization: Bearer <token>` header.
- **Anonymous connections are allowed read-only** because map data is public.
- An invalid or expired token fails the handshake (`connect_error`).
- Authenticated sockets also join `user:{userId}` (and `staff` for GUARD/ADMIN).
- Every socket automatically joins the public `map` room.

**Clients cannot publish state changes.** Availability events are emitted by the server
only after a database transaction commits, so clients cannot forge or duplicate them.
There are no client -> server events other than room subscription.

### Client -> server

#### `join:facility` / `leave:facility`
Payload: facility UUID as a bare string.
```js
socket.emit("join:facility", "facility-uuid");
```
Invalid IDs are ignored; `join:facility` replies with an `error` event.

### Server -> client

#### `parking:availability`
Full availability snapshot, emitted after reservation create/cancel, guard check-in and check-out.
```json
{
  "facilityId": "uuid",
  "totalSpaces": 120,
  "available": 74,
  "occupied": 38,
  "reserved": 6,
  "maintenance": 2,
  "reservedHeld": 0,
  "activeSessions": 38,
  "activeReservations": 6,
  "occupancyRate": 36.7,
  "calculatedAt": "ISO datetime",
  "timestamp": "ISO datetime"
}
```

#### `parking:space_updated`
Single space status change, emitted alongside `parking:availability`.
```json
{
  "facilityId": "uuid",
  "spaceId": "uuid",
  "spaceNumber": "A-1",
  "status": "OCCUPIED",
  "previousStatus": "AVAILABLE",
  "floorId": "uuid",
  "zoneId": "uuid | null",
  "reason": "CHECK_IN",
  "timestamp": "ISO datetime"
}
```

`reason` is one of `RESERVATION_CREATED`, `RESERVATION_CANCELLED`, `CHECK_IN`, `CHECK_OUT`, `STATUS_CHANGED`.

A socket in both the `map` room and `facility:{id}` room receives each event exactly once.

### Rooms
- `map` — every connection (public map listeners)
- `facility:{facilityId}` — joined explicitly via `join:facility`
- `user:{userId}` — authenticated user
- `staff` — GUARD/ADMIN connections

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