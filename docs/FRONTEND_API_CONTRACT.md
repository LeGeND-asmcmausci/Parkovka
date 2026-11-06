# Smart Parking Management System — Frontend API Contract

This document is the contract between the backend (`/backend`) and the frontend
(`/src`, built by Qoder). It is verified against the current backend source, not
against earlier drafts.

- **API base URL:** `http://localhost:3001/api`
- **Socket.IO origin:** `http://localhost:3001` (default path `/socket.io`)
- **Health check:** `GET http://localhost:3001/health` (note: **not** under `/api`)
- **API version:** v1
- **Authentication:** `Authorization: Bearer <accessToken>`
- **Port:** `PORT` from `backend/.env`, default `3001`

Frontend integration note: set `VITE_API_URL=http://localhost:3001/api` (and
optionally `VITE_SOCKET_URL=http://localhost:3001`). When `VITE_API_URL` is empty
the frontend runs on fixtures and never calls this API.

---

## 1. Conventions

### 1.1 Response envelope

Every successful response:

```json
{ "success": true, "data": <payload>, "message": "optional string", "meta": { } }
```

`meta` is only present on paginated/filterable endpoints (`/parking/map`,
`/parking/:id/spaces`).

Every error response:

```json
{ "success": false, "message": "error description", "errors": [ ], "data": { } }
```

- `errors` — only for validation failures: `[{ "path": "email", "message": "Valid email required" }]`
- `data` — only when the error carries structured details
- `stack` — **never sent**, in any environment (NODE_ENV is irrelevant)

### 1.2 Status codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created (`register`, `POST /api/users`, reservation create) |
| 400 | Validation / business rule failure |
| 401 | Missing, invalid, expired or revoked token |
| 403 | Authenticated but not allowed (role, ownership, suspended account) |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, space unavailable, QR already used) |
| 500 | Internal error (message is always generic) |
| 503 | Payment provider not configured / test mode misconfigured |

### 1.3 Rules that affect the client

- **Roles:** `ADMIN`, `GUARD`, `USER`. Roles always come from the database; the
  token's `role` claim is informational only.
- **Guard endpoints accept `GUARD` only.** `ADMIN` receives `403`.
- **Money:** integer values. Reservation/session prices are stored in
  `priceCents` / `amountCents` (integer UZS × 100); facility `hourlyRate`,
  `dailyRate`, `pricePerHour`, `pricePerDay` are plain integer UZS.
- **Coordinates:** `latitude` / `longitude` are WGS84 decimal degrees as JSON
  **numbers**, never strings. Both `coordinates: { latitude, longitude }` and the
  flat fields are returned.
- **`parkingType`:** `SURFACE | UNDERGROUND | MULTI_LEVEL | STREET`.
- **`space.status`:** `AVAILABLE | RESERVED | OCCUPIED | MAINTENANCE | RESERVED_HELD`.

### 1.4 CORS

The backend allows exactly one origin: `CORS_ORIGIN` from `backend/.env`
(default `http://localhost:5173`) with `credentials: true`.

```http
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Credentials: true
Vary: Origin
```

Any other origin (for example `http://localhost:5174`) is rejected by the
browser. If Vite picks another port, change `CORS_ORIGIN` in `backend/.env`.

---

## 2. Endpoint index (28 routes)

| # | Method | Endpoint | Auth |
|---|---|---|---|
| 1 | POST | `/api/auth/register` | Public |
| 2 | POST | `/api/auth/login` | Public |
| 3 | POST | `/api/auth/refresh` | Public (refresh token) |
| 4 | POST | `/api/auth/logout` | Access token |
| 5 | GET | `/api/auth/me` | Access token |
| 6 | POST | `/api/users` | **ADMIN** (new) |
| 7 | GET | `/api/users/me` | Access token |
| 8 | PATCH | `/api/users/profile` | Access token |
| 9 | GET | `/api/users` | ADMIN |
| 10 | GET | `/api/parking` | Public |
| 11 | GET | `/api/parking/map` | Public |
| 12 | GET | `/api/parking/:id` | Public |
| 13 | GET | `/api/parking/:id/floors` | Public |
| 14 | GET | `/api/parking/:id/spaces` | Public |
| 15 | GET | `/api/parking/:id/availability` | Public |
| 16 | GET | `/api/parking/:id/map` | Public |
| 17 | POST | `/api/reservations` | Access token |
| 18 | GET | `/api/reservations` | Access token |
| 19 | GET | `/api/reservations/:id` | Access token (owner/ADMIN) |
| 20 | POST | `/api/reservations/:id/cancel` | Access token (owner/ADMIN) |
| 21 | POST | `/api/guard/entry` | GUARD |
| 22 | POST | `/api/guard/exit` | GUARD |
| 23 | POST | `/api/guard/verify-qr` | GUARD |
| 24 | GET | `/api/guard/sessions` | GUARD |
| 25 | POST | `/api/payments` | Access token |
| 26 | GET | `/api/payments` | Access token |
| 27 | POST | `/api/payments/click/callback` | Provider signature |
| 28 | POST | `/api/payments/payme/callback` | Provider signature |
| — | GET | `/health` | Public |

---

## 3. Authentication

### 3.1 Token model

| Token | Lifetime (default) | Claim payload | Usage |
|---|---|---|---|
| Access | `JWT_EXPIRES_IN` = `15m` | `{ sub, email, role, typ: "access" }` | `Authorization: Bearer …` on protected routes |
| Refresh | `REFRESH_TOKEN_EXPIRES_IN` = `30d` | `{ sub, jti, typ: "refresh" }` | Only at `POST /api/auth/refresh` |

- Access tokens are rejected at `/api/auth/refresh`; refresh tokens are rejected
  on every protected route and in the Socket.IO handshake (`typ` is enforced).
- Refresh tokens are stored (SHA-256 hash) in the `RefreshToken` table.
- `authenticate` reloads the user from the database on every request, so a role
  change or suspension applies immediately.

### 3.2 POST /api/auth/register

Public self-signup. **Always creates a `USER`.** Any `role` field in the body is
ignored (not validated, never applied); `ADMIN`/`GUARD` accounts are created only
through `POST /api/users` by an admin.

**Request**

```json
{ "name": "Ali Valiyev", "email": "ali@example.com", "password": "secret123" }
```

**Response 201**

```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "name": "Ali Valiyev", "email": "ali@example.com", "role": "USER" },
    "tokens": { "accessToken": "jwt", "refreshToken": "jwt" }
  },
  "message": "User registered successfully"
}
```

**Errors:** `400` validation, `409` `{ "success": false, "message": "Resource conflict" }` when the email exists.

### 3.3 POST /api/auth/login

```json
{ "email": "ali@example.com", "password": "secret123" }
```

**Response 200** — same shape as register (`data.user`, `data.tokens`),
`message: "Login successful"`.

**Errors:** `401` invalid credentials (identical message for unknown email and
wrong password), `403` when the account status is not `ACTIVE`.

### 3.4 POST /api/auth/refresh

Sends a **refresh** token, receives a rotated pair. The presented refresh token is
revoked in the same transaction (replay returns `401`). `email`, `role` and the
account status are read from the database, never copied from the token.

**Request** (either form)

```http
POST /api/auth/refresh
Authorization: Bearer <refreshToken>
```

```json
{ "refreshToken": "jwt" }
```

**Response 200**

```json
{ "success": true, "data": { "accessToken": "jwt", "refreshToken": "jwt" } }
```

**Errors:** `401` missing/invalid/expired/revoked/replayed refresh token, or an
access token was sent; `403` account is not `ACTIVE`.

### 3.5 POST /api/auth/logout

Requires a valid access token.

```json
{ "refreshToken": "jwt (optional)" }
```

- With `refreshToken`: revokes that single session.
- Without it: revokes **all** active refresh tokens of the user.

**Response 200**

```json
{ "success": true, "message": "Logged out successfully" }
```

The access token itself remains valid for its remaining lifetime (≤ 15 minutes);
revocation applies to refresh tokens, so no new pair can be minted.

### 3.6 GET /api/auth/me

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Ali Valiyev",
    "email": "ali@example.com",
    "role": "USER",
    "phone": null,
    "licensePlate": null,
    "status": "ACTIVE",
    "createdAt": "ISO datetime",
    "updatedAt": "ISO datetime"
  }
}
```

---

## 4. User endpoints

### 4.1 POST /api/users — ADMIN only (new)

Creates staff (or any) accounts. This is the only way to obtain `ADMIN`/`GUARD`.

**Request**

```json
{
  "name": "Guard One",
  "email": "guard@example.com",
  "password": "secret123",
  "role": "GUARD",
  "phone": "+998901112233",
  "licensePlate": "01A123BC"
}
```

`name`, `email`, `password` (min 6), `role` (`ADMIN|GUARD|USER`) required;
`phone`, `licensePlate` optional.

**Response 201**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Guard One",
      "email": "guard@example.com",
      "role": "GUARD",
      "status": "ACTIVE",
      "createdAt": "ISO datetime"
    }
  },
  "message": "User created successfully"
}
```

**Errors:** `400` validation, `403` caller is not ADMIN, `409` email exists.

### 4.2 GET /api/users/me

Identical payload to `GET /api/auth/me`.

### 4.3 PATCH /api/users/profile

```json
{ "name": "New name", "phone": "+998901112233", "licensePlate": "01A123BC" }
```

All fields optional (empty strings are ignored).

**Response 200**

```json
{
  "success": true,
  "data": {
    "id": "uuid", "name": "New name", "email": "ali@example.com", "role": "USER",
    "phone": "+998901112233", "licensePlate": "01A123BC", "status": "ACTIVE"
  },
  "message": "Profile updated successfully"
}
```

### 4.4 GET /api/users — ADMIN only

```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "string", "email": "string", "role": "ADMIN", "status": "ACTIVE", "createdAt": "ISO datetime" }
  ]
}
```

Ordered by `createdAt` descending.

---

## 5. Parking endpoints (all public)

Only `ACTIVE` facilities are returned. No private user data is exposed.

### 5.1 Availability object

Used by `/parking`, `/parking/map`, `/parking/:id`, `/parking/:id/floors`,
`/parking/:id/availability`, `/parking/:id/map`.

```json
{
  "facilityId": "uuid",
  "totalSpaces": 12,
  "available": 8,
  "occupied": 2,
  "reserved": 1,
  "maintenance": 0,
  "reservedHeld": 0,
  "activeSessions": 2,
  "activeReservations": 1,
  "occupancyRate": 25,
  "calculatedAt": "ISO datetime"
}
```

`reserved` already includes `reservedHeld`; `totalSpaces` is the sum of space
statuses; `occupancyRate` is a percentage with one decimal.

### 5.2 GET /api/parking

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Parkovka Markaziy",
      "description": "string | null",
      "address": "Amir Temur ko'chasi 1",
      "city": "Tashkent",
      "country": "Uzbekistan",
      "coordinates": { "latitude": 41.311081, "longitude": 69.240562 },
      "latitude": 41.311081,
      "longitude": 69.240562,
      "openingHours": "24/7",
      "parkingType": "MULTI_LEVEL",
      "covered": true,
      "status": "ACTIVE",
      "pricing": { "hourlyRate": 2000, "dailyRate": 20000, "currency": "UZS" },
      "currency": "UZS",
      "timezone": "Asia/Tashkent",
      "totalSpaces": 12,
      "floorCount": 2,
      "spaceCount": 12,
      "_count": { "floors": 2, "spaces": 12 },
      "availability": { "facilityId": "uuid", "totalSpaces": 12, "available": 12 }
    }
  ]
}
```

Sorted by `name` ascending.

### 5.3 GET /api/parking/map

City map data. `availability` is always present.

| Query | Type | Rules |
|---|---|---|
| `city` | string | case-insensitive, max 100 |
| `parkingType` | enum | `SURFACE`, `UNDERGROUND`, `MULTI_LEVEL`, `STREET` |
| `north`, `south` | number | −90..90, must be sent together, `north >= south` |
| `east`, `west` | number | −180..180, must be sent together, `east >= west` |
| `limit` | integer | 1..500, default 200 |

**Response 200**

```json
{
  "success": true,
  "data": [ { "id": "uuid", "name": "…", "coordinates": { "latitude": 41.311081, "longitude": 69.240562 }, "pricing": { }, "availability": { } } ],
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

Facilities without coordinates are filtered out of `data` (and `meta.count`
reflects the filtered array).

**Errors:** `400` invalid type/limit/coordinate, only one bound of a pair,
`north < south`, `east < west`.

### 5.4 GET /api/parking/:id

Facility detail + floor summaries + pricing rules.

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Parkovka Markaziy",
    "coordinates": { "latitude": 41.311081, "longitude": 69.240562 },
    "pricing": { "hourlyRate": 2000, "dailyRate": 20000, "currency": "UZS" },
    "availability": { "totalSpaces": 12, "available": 12 },
    "floors": [
      {
        "id": "uuid", "name": "Ground floor", "floorName": "Ground", "level": 0,
        "totalSpaces": 6, "status": "ACTIVE",
        "_count": { "spaces": 6, "zones": 2 }
      }
    ],
    "pricingRules": []
  }
}
```

`pricingRules` are raw `PricingRule` rows (empty when none are configured).
**Errors:** `400` invalid UUID, `404` not found.

### 5.5 GET /api/parking/:id/floors

Indoor layout: floors → zones → spaces.

```json
{
  "success": true,
  "data": {
    "facilityId": "uuid",
    "facilityName": "Parkovka Markaziy",
    "floors": [
      {
        "id": "uuid", "name": "Ground floor", "floorName": "Ground", "level": 0,
        "status": "ACTIVE", "totalSpaces": 6,
        "availability": { "totalSpaces": 6, "available": 6, "occupied": 0, "reserved": 0, "maintenance": 0 },
        "zones": [
          {
            "id": "uuid", "name": "Zone A", "zoneCode": "A", "zoneType": "regular",
            "covered": true, "status": "ACTIVE", "totalSpaces": 4,
            "availability": { "totalSpaces": 4, "available": 4, "occupied": 0, "reserved": 0, "maintenance": 0 },
            "spaces": [
              { "id": "uuid", "spaceNumber": "A-01", "spaceType": "regular", "status": "AVAILABLE", "pricePerHour": 2000, "pricePerDay": 20000 }
            ]
          }
        ],
        "unzonedSpaces": [ { "id": "uuid", "spaceNumber": "G-01", "spaceType": "regular", "status": "AVAILABLE" } ]
      }
    ],
    "availability": { "facilityId": "uuid", "totalSpaces": 12, "available": 12 }
  }
}
```

`zones[].totalSpaces` is the real number of spaces in the zone (not the stored
counter).

### 5.6 GET /api/parking/:id/spaces

Paginated flat list.

| Query | Rules |
|---|---|
| `status` | `AVAILABLE`, `RESERVED`, `OCCUPIED`, `MAINTENANCE`, `RESERVED_HELD` |
| `floorId` | UUID |
| `zoneId` | UUID |
| `spaceType` | string, max 50 |
| `page` | ≥ 1, default 1 |
| `limit` | 1..500, default 100 |

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid", "spaceNumber": "A-01", "spaceType": "regular", "status": "AVAILABLE",
      "level": 0, "zoneName": "A", "pricePerHour": 2000, "pricePerDay": 20000,
      "maxStayDuration": 0, "floorId": "uuid", "zoneId": "uuid",
      "floor": { "id": "uuid", "name": "Ground floor", "floorName": "Ground", "level": 0 },
      "zone": { "id": "uuid", "name": "Zone A", "zoneCode": "A", "zoneType": "regular" }
    }
  ],
  "meta": { "facilityId": "uuid", "page": 1, "limit": 100, "total": 12, "totalPages": 1 }
}
```

### 5.7 GET /api/parking/:id/availability

Availability snapshot plus every space of the facility.

```json
{
  "success": true,
  "data": {
    "facilityId": "uuid",
    "totalSpaces": 12, "available": 12, "occupied": 0, "reserved": 0,
    "maintenance": 0, "reservedHeld": 0, "activeSessions": 0, "activeReservations": 0,
    "occupancyRate": 0, "calculatedAt": "ISO datetime",
    "spaces": [
      {
        "id": "uuid", "spaceNumber": "A-01", "spaceType": "regular", "status": "AVAILABLE",
        "pricePerHour": 2000, "pricePerDay": 20000,
        "zone": { "id": "uuid", "name": "Zone A", "zoneCode": "A" },
        "floor": { "id": "uuid", "name": "Ground floor", "level": 0 }
      }
    ]
  }
}
```

### 5.8 GET /api/parking/:id/map

Zones with their spaces (compatibility endpoint for older clients).

```json
{
  "success": true,
  "data": {
    "facility": { "id": "uuid", "name": "Parkovka Markaziy", "coordinates": { "latitude": 41.311081, "longitude": 69.240562 }, "availability": { } },
    "zones": [
      {
        "id": "uuid", "name": "Zone A", "zoneCode": "A", "zoneType": "regular",
        "covered": true, "status": "ACTIVE", "totalSpaces": 4,
        "floor": { "id": "uuid", "name": "Ground floor", "floorName": "Ground", "level": 0 },
        "availability": { "totalSpaces": 4, "available": 4, "occupied": 0, "reserved": 0, "maintenance": 0 },
        "spaces": [ { "id": "uuid", "spaceNumber": "A-01", "spaceType": "regular", "status": "AVAILABLE" } ]
      }
    ]
  }
}
```

---

## 6. Reservation endpoints

### 6.1 POST /api/reservations

Any authenticated user (USER, GUARD or ADMIN). Runs in a row-locked transaction.

```json
{
  "facilityId": "uuid (required)",
  "spaceId": "uuid (required)",
  "startTime": "ISO datetime (required)",
  "endTime": "ISO datetime (required)",
  "vehicleId": "uuid (optional)"
}
```

`vehicleId` is validated but **not persisted** — reservations have no vehicle
column in the current schema.

**Response 201**

```json
{
  "success": true,
  "data": {
    "reservation": {
      "id": "uuid",
      "userId": "uuid",
      "spaceId": "uuid",
      "facilityId": "uuid",
      "startTime": "ISO datetime",
      "endTime": "ISO datetime",
      "reservedAt": "ISO datetime",
      "status": "CONFIRMED",
      "paymentStatus": "PENDING",
      "priceCents": 400000,
      "currency": "UZS",
      "createdAt": "ISO datetime",
      "updatedAt": "ISO datetime",
      "space": { "id": "uuid", "spaceNumber": "A-01", "spaceType": "regular", "zoneName": "A", "level": 0 }
    },
    "qrToken": "64-char hex (one-time reservation QR)"
  },
  "message": "Reservation created successfully"
}
```

**Rules / errors**

| Case | Status / message |
|---|---|
| invalid body (UUID, ISO date) | `400` validation |
| `endTime <= startTime` | `400` "End time must be after start time" |
| `startTime` in the past | `400` "Start time must be in the future" |
| start > 30 days ahead | `400` "Reservations may only be made 30 days ahead" |
| facility missing | `404` |
| facility not `ACTIVE` | `400` "Facility is not accepting reservations" |
| space missing / not in facility | `404` |
| space not `AVAILABLE`/`RESERVED_HELD`, or overlapping confirmed reservation | `409` "Reservation conflict - space may already be booked" |

Side effects: space becomes `RESERVED`; a `QrCodeTicket` (`purpose:
"reservation"`, `expiresAt = endTime`) is created; Socket.IO emits
`parking:space_updated` + `parking:availability`.

### 6.2 GET /api/reservations

Current user's reservations, newest first, with `space` (id, spaceNumber,
spaceType, zoneName, level) and `facility` (id, name, address, city).

### 6.3 GET /api/reservations/:id

Full reservation (same includes as above). Owner or `ADMIN` only, otherwise
`403`. Unknown id → `404`.

### 6.4 POST /api/reservations/:id/cancel

Owner or `ADMIN`. No request body.

**Response 200**

```json
{
  "success": true,
  "data": { "id": "uuid", "status": "CANCELLED", "canceledAt": "ISO datetime" },
  "message": "Reservation cancelled successfully"
}
```

**Errors:** `400` already `CANCELLED`/`COMPLETED`/`EXPIRED`; `400` paid
reservation cancelled less than 2 hours before `startTime`; `403` not the owner;
`404` unknown id.

Side effects: the space becomes `AVAILABLE` (or stays `OCCUPIED` if a session is
active, `RESERVED` if another confirmed reservation exists); Socket.IO events are
emitted.

---

## 7. Guard endpoints (`GUARD` only — `ADMIN` gets `403`)

### 7.1 POST /api/guard/entry — walk-in check-in

```json
{
  "facilityId": "uuid (optional if zoneId is given)",
  "zoneId": "uuid (optional)",
  "vehicleId": "uuid (optional)",
  "licensePlate": "01A123BC (optional)"
}
```

Either `vehicleId` or `licensePlate` is required; either `facilityId` or `zoneId`
is required. With `licensePlate` a vehicle is created if it does not exist.
A space is picked with `FOR UPDATE SKIP LOCKED` (first `AVAILABLE`, by floor then
space number), so two guards can never take the same space.

**Response 200**

```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid", "userId": null, "vehicleId": "uuid", "spaceId": "uuid",
      "facilityId": "uuid", "entryTime": "ISO datetime", "expectedExit": "ISO datetime",
      "durationMinutes": null, "actualExitTime": null,
      "basePriceCents": 800000, "finalPriceCents": 800000, "currency": "UZS",
      "status": "ACTIVE", "createdAt": "ISO datetime", "updatedAt": "ISO datetime"
    },
    "qrToken": "64-char hex (exit/entry ticket, expires in 2h)",
    "space": { "id": "uuid", "spaceNumber": "A-01", "zone": "A", "floor": 0 },
    "estimatedPrice": 800000,
    "estimatedExit": "ISO datetime"
  },
  "message": "Vehicle entry recorded successfully"
}
```

`basePriceCents` is `pricePerHour × 4 hours × 100`. The space becomes `OCCUPIED`.

**Errors:** `400` missing vehicle/plate or facility/zone, facility not `ACTIVE`;
`404` unknown facility/zone/vehicle; `409` "No available parking space in this
facility".

### 7.2 POST /api/guard/exit — check-out

One of:

```json
{ "qrToken": "string" }
{ "licensePlate": "string" }
{ "plateSearch": "string" }
{ "spaceId": "uuid" }
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "session": { "id": "uuid", "status": "COMPLETED", "actualExitTime": "ISO datetime", "durationMinutes": 95, "finalPriceCents": 600000 },
    "finalPriceCents": 600000,
    "durationMinutes": 95,
    "space": { "id": "uuid", "spaceNumber": "A-01", "status": "AVAILABLE" }
  },
  "message": "Vehicle exit recorded successfully"
}
```

There is **no** `exitQrToken` in the response.

**Errors:** `400` no identifier, unknown QR, QR not linked to a session
(a reservation QR cannot be used here), revoked QR; `403` revoked ticket;
`409` QR already used (`"QR code already used"`) or expired; `404` no active
session for the plate/space.

Pricing: `ceil(durationMinutes / 60)` hours × `pricePerHour` (daily rate beyond
24h, daily cap applied, minimum one hour). The QR ticket is marked `USED`; the
space becomes `AVAILABLE` or `RESERVED` if a future confirmed reservation exists.

### 7.3 POST /api/guard/verify-qr

Read-only validation; the ticket is **not** consumed.

```json
{ "qrToken": "string" }
```

```json
{
  "success": true,
  "data": {
    "valid": true,
    "purpose": "entry | exit | reservation",
    "parkingSessionId": "uuid | null",
    "sessionStatus": "ACTIVE | COMPLETED | CANCELLED | EXPIRED | null",
    "facilityId": "uuid | null",
    "expiresAt": "ISO datetime"
  },
  "message": "QR code verified successfully"
}
```

**Errors:** `400` unknown token, `403` revoked, `409` used or expired.

### 7.4 GET /api/guard/sessions

Active sessions (`status = ACTIVE`), newest entry first. Optional
`?facilityId=<uuid>`.

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid", "entryTime": "ISO datetime", "status": "ACTIVE",
      "basePriceCents": 800000, "finalPriceCents": 800000,
      "space": { "id": "uuid", "spaceNumber": "A-01", "level": 0, "zoneName": "A" },
      "vehicle": { "id": "uuid", "plateNumber": "01A123BC" },
      "facility": { "id": "uuid", "name": "Parkovka Markaziy" }
    }
  ]
}
```

---

## 8. Payments

### 8.1 POST /api/payments — initiate

```json
{
  "reservationId": "uuid (either this or sessionId)",
  "sessionId": "uuid",
  "amount": "integer UZS × 100 (optional, defaults to priceCents/finalPriceCents)",
  "paymentMethod": "CLICK | PAYME | CASH (required)",
  "description": "string (optional)"
}
```

```json
{
  "success": true,
  "data": {
    "paymentId": "uuid",
    "amount": 400000,
    "currency": "UZS",
    "paymentMethod": "CLICK",
    "status": "PENDING",
    "providerUrl": "/api/payments/CLICK/init"
  },
  "message": "Payment initiation started"
}
```

`providerUrl` is a **placeholder**; no provider redirect is implemented yet. The
frontend must not navigate to it.

**Errors:** `400` no target, price ≤ 0, reservation already paid; `403`
reservation belongs to another user (ADMIN allowed); `404` target not found.

### 8.2 Provider callback authentication (both callbacks)

Callbacks fail closed — an unsigned or wrongly signed request can never change a
payment.

| Configuration | Required authentication |
|---|---|
| `CLICK_SECRET_KEY` set | Click `sign_string` (see below) |
| `PAYME_SECRET_KEY` set | `Authorization: Basic base64("Paycom:<PAYME_SECRET_KEY>")` |
| No provider key, `PAYMENT_TEST_MODE=true`, `PAYMENT_TEST_SECRET` set | `x-test-signature: sha256=<HMAC-SHA256(rawBody, PAYMENT_TEST_SECRET)>` |
| No provider key, test mode off | `503`, callback refused |
| `NODE_ENV=production` with `PAYMENT_TEST_MODE=true` | `503`, test mode never works in production |

The provider key always wins: when it is configured, the HMAC test signature is
not accepted. There is no flag that disables verification.

**Idempotency:** the payment row is locked (`SELECT … FOR UPDATE`) inside the
transaction. The first valid callback writes `paidAt`, `providerTxId`, `provider`,
sets the payment `COMPLETED` and updates its reservation (`paymentStatus`) or
session (`status`, `finalPriceCents`). Repeated or concurrent callbacks return
success without touching the record again.

### 8.3 POST /api/payments/click/callback

Click Prepare/Complete protocol.

```json
{
  "click_trans_id": "555",
  "service_id": "12345",
  "merchant_trans_id": "<our paymentId>",
  "amount": 4000,
  "action": 1,
  "sign_time": "2026-11-06 10:00:00",
  "sign_string": "md5 hex"
}
```

- `action: 0` — prepare; `action: 1` — complete (default when omitted).
- `amount` is in **UZS** (`amountCents / 100`).
- `sign_string = md5(click_trans_id + service_id + secret_key + merchant_trans_id + amount + action + sign_time)`.

**Responses**

| Case | HTTP | Body |
|---|---|---|
| signature ok, `action: 0` | 200 | `{ "success": true, "error": 0, "error_note": "Success", "data": { "paymentId", "status", "action": 0 } }` |
| completed | 200 | `{ "success": true, "error": 0, "error_note": "Success", "data": { "paymentId", "status": "COMPLETED", "action": 1, "idempotent": false } }` |
| repeated callback | 200 | same with `"error_note": "Already paid"`, `"idempotent": true` |
| missing/invalid signature | 401 | `{ "success": false, "error": -1, "error_note": "…" }` |
| amount mismatch | 400 | `error: -2` |
| payment is refunded | 409 | `error: -4` |
| unknown payment | 404 | `error: -5` |
| missing ids | 400 | `error: -8` |
| provider not configured | 503 | `error: -1` |

### 8.4 POST /api/payments/payme/callback

Payme JSON-RPC (amounts in **tiyin**, i.e. `amountCents`).

```json
{
  "jsonrpc": "2.0",
  "id": "rpc-1",
  "method": "PerformTransaction",
  "params": {
    "id": "payme-transaction-id",
    "time": 1793000000000,
    "amount": 400000,
    "account": { "payment_id": "<our paymentId>" }
  }
}
```

Supported methods: `CheckPerformTransaction`, `CreateTransaction`,
`PerformTransaction`, `CancelTransaction`.

| Method | Result | Notes |
|---|---|---|
| `CheckPerformTransaction` | `{ result: { allow: true } }` | `allow: false` if already completed; `-31001` wrong amount; `-31050` unknown payment |
| `CreateTransaction` | `{ result: { create_time, transaction, state: 1 } }` | `state: 2` if already completed; `-31008` when another transaction id exists |
| `PerformTransaction` | `{ result: { perform_time, transaction, state: 2 } }` | idempotent: repeated call returns the same `perform_time` |
| `CancelTransaction` | `{ result: { cancel_time, transaction, state: -2 } }` | `-31007` for a completed payment |

**Error codes:** `-32504` authentication failed (HTTP 401 when auth is missing or
wrong), `-31050` payment not found, `-31001` incorrect amount, `-31008` state
conflict, `-31007` cannot cancel a completed transaction, `-32600` invalid
transaction id, `-32601` unknown method. Protocol errors are returned with HTTP
200 and an `error` object, as Payme expects.

### 8.5 GET /api/payments

Current user's payments, newest first, with `reservation`
(`id, status, startTime`) and `parkingSession` (`id, status, entryTime`).
`data` is an array of raw `Payment` rows plus those includes.

---

## 9. Socket.IO

### 9.1 Connection

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:3001", {
  auth: { token: accessToken }, // optional
  transports: ["websocket"],
});
```

- Origin must be `CORS_ORIGIN` (`http://localhost:5173` by default).
- The token is read from `auth.token` or the `Authorization: Bearer …` header.
- Only **access** tokens are accepted; a refresh token fails the handshake.
- Anonymous sockets are allowed read-only (map data is public).
- Invalid/expired token → `connect_error` with
  `"Invalid or expired authentication token"`.

### 9.2 Rooms

| Room | Joined by |
|---|---|
| `map` | every connection (automatic) |
| `facility:{facilityId}` | `join:facility` |
| `user:{userId}` | authenticated sockets |
| `staff` | `GUARD` and `ADMIN` sockets |

A socket in both `map` and `facility:{id}` receives each event exactly once.

### 9.3 Client → server

Only room subscription; clients cannot publish state changes.

```js
socket.emit("join:facility", "<facility-uuid>");
socket.emit("leave:facility", "<facility-uuid>");
```

Non-UUID values are rejected; `join:facility` answers with
`socket.emit("error", { message: "Invalid facility ID" })`.

### 9.4 Server → client

#### `parking:availability`

Full snapshot after reservation create/cancel and guard check-in/check-out.

```json
{
  "facilityId": "uuid",
  "totalSpaces": 12, "available": 8, "occupied": 2, "reserved": 1,
  "maintenance": 0, "reservedHeld": 0, "activeSessions": 2, "activeReservations": 1,
  "occupancyRate": 25, "calculatedAt": "ISO datetime", "timestamp": "ISO datetime"
}
```

#### `parking:space_updated`

```json
{
  "facilityId": "uuid",
  "spaceId": "uuid",
  "spaceNumber": "A-01",
  "status": "OCCUPIED",
  "previousStatus": "AVAILABLE",
  "floorId": "uuid",
  "zoneId": "uuid | null",
  "reason": "CHECK_IN",
  "timestamp": "ISO datetime"
}
```

`reason`: `RESERVATION_CREATED | RESERVATION_CANCELLED | CHECK_IN | CHECK_OUT | STATUS_CHANGED`.

Both events are emitted **after** the database transaction commits.

---

## 10. Environment variables relevant to the client

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default 3001) |
| `CORS_ORIGIN` | Single allowed browser origin (default `http://localhost:5173`) |
| `JWT_EXPIRES_IN` | Access token lifetime (default `15m`) |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token lifetime (default `30d`) |
| `CLICK_SERVICE_ID`, `CLICK_SECRET_KEY` | Click signature verification |
| `PAYME_SECRET_KEY` | Payme Basic auth |
| `PAYMENT_TEST_MODE`, `PAYMENT_TEST_SECRET` | Signed HMAC test mode (never in production) |

### Local seed data (`npm run db:seed`)

| Account | Password | Role |
|---|---|---|
| `admin@parkovka.local` | `Admin123!` | ADMIN |
| `guard@parkovka.local` | `Guard123!` | GUARD |
| `user@parkovka.local` | `User123!` | USER |

Seed content: 1 facility (`Parkovka Markaziy`), 2 floors, 4 zones, 12 spaces.
The seed refuses to run when `NODE_ENV=production` and is idempotent.

---

## 11. Known limitations (present in the backend today)

1. `POST /api/reservations` accepts `vehicleId` but does not store it.
2. `providerUrl` from `POST /api/payments` is a placeholder; Click/Payme redirect
   integration is not implemented.
3. There is no guard endpoint that checks a **reservation** QR in at entry — QR
   tickets with `purpose: "reservation"` are not linked to a session, so
   `POST /api/guard/exit` rejects them with `400`.
4. `POST /api/payments` does not verify ownership of `sessionId` (only
   reservations are ownership-checked).
5. Logout revokes refresh tokens immediately; the access token stays valid until
   it expires (≤ 15 minutes).
6. Redis is not required: refresh-token revocation is stored in PostgreSQL.
7. `GET /api/payments` returns raw payment rows (no pagination).

---

## 12. What changed versus the previous version of this document

- `POST /api/auth/register`: `role` is ignored, always `USER`; staff accounts are
  created through the new `POST /api/users` (ADMIN only).
- `POST /api/auth/refresh`: rotated tokens, database-sourced `role`/`email`,
  replay protection, access tokens rejected.
- `POST /api/auth/logout`: actually revokes refresh tokens.
- Click/Payme callbacks: real signature/authentication required; old
  unauthenticated `{ transactionId, status }` / `{ merchantTxId, status }` bodies
  are rejected; new response formats documented above.
- Error responses never contain `stack`.
- Guard endpoints are `GUARD`-only (`ADMIN` → `403`).
- `POST /api/guard/exit` response no longer advertises a non-existent
  `exitQrToken`.
