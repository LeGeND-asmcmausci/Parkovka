import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { io } from "socket.io-client";

const prisma = new PrismaClient();
const BASE = process.env.VERIFY_BASE_URL || "http://localhost:3001";
const PASSWORD = "Verify123!";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const api = async (path, options = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
};

const cleanup = async () => {
  const facilities = await prisma.parkingFacility.findMany({
    where: { name: { startsWith: "VERIFY-" } },
    select: { id: true },
  });
  const ids = facilities.map((f) => f.id);

  if (ids.length) {
    await prisma.qrCodeTicket.deleteMany({
      where: { parkingSession: { facilityId: { in: ids } } },
    });
    await prisma.payment.deleteMany({
      where: {
        OR: [
          { parkingSession: { facilityId: { in: ids } } },
          { reservation: { facilityId: { in: ids } } },
        ],
      },
    });
    await prisma.plateRecognition.deleteMany({
      where: { session: { facilityId: { in: ids } } },
    });
    await prisma.parkingSession.deleteMany({ where: { facilityId: { in: ids } } });
    await prisma.reservation.deleteMany({ where: { facilityId: { in: ids } } });
    await prisma.parkingSpace.deleteMany({ where: { facilityId: { in: ids } } });
    await prisma.parkingZone.deleteMany({ where: { floor: { facilityId: { in: ids } } } });
    await prisma.parkingFloor.deleteMany({ where: { facilityId: { in: ids } } });
    await prisma.pricingRule.deleteMany({ where: { facilityId: { in: ids } } });
    await prisma.guardAssignment.deleteMany({ where: { facilityId: { in: ids } } });
    await prisma.parkingFacility.deleteMany({ where: { id: { in: ids } } });
  }

  const users = await prisma.user.findMany({
    where: { email: { startsWith: "verify-" } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length) {
    await prisma.qrCodeTicket.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.activityLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  await prisma.vehicle.deleteMany({ where: { plateNumber: { startsWith: "VERIFY" } } });
};

const seed = async () => {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const facility = await prisma.parkingFacility.create({
    data: {
      name: "VERIFY-Central Parking",
      description: "Verification facility",
      address: "1 Test Street",
      city: "Tashkent",
      country: "Uzbekistan",
      latitude: 41.3111,
      longitude: 69.2797,
      totalSpaces: 4,
      hourlyRate: 5000,
      dailyRate: 40000,
      openingHours: "08:00-22:00",
      parkingType: "MULTI_LEVEL",
    },
  });

  const floor = await prisma.parkingFloor.create({
    data: {
      facilityId: facility.id,
      name: "Ground",
      floorName: "Ground",
      level: 0,
      totalSpaces: 4,
    },
  });

  const zone = await prisma.parkingZone.create({
    data: {
      floorId: floor.id,
      name: "Zone A",
      zoneCode: "A",
      zoneType: "regular",
      totalSpaces: 4,
    },
  });

  const spaces = [];
  for (let i = 1; i <= 4; i += 1) {
    spaces.push(
      await prisma.parkingSpace.create({
        data: {
          facilityId: facility.id,
          floorId: floor.id,
          zoneId: zone.id,
          spaceNumber: `A-${i}`,
          level: 0,
          zoneName: "A",
          spaceType: "regular",
          status: i === 4 ? "MAINTENANCE" : "AVAILABLE",
          pricePerHour: 5000,
          pricePerDay: 40000,
          maxStayDuration: 0,
        },
      })
    );
  }

  const user = await prisma.user.create({
    data: {
      name: "Verify User",
      email: "verify-user@example.com",
      passwordHash,
      role: "USER",
    },
  });

  const guard = await prisma.user.create({
    data: {
      name: "Verify Guard",
      email: "verify-guard@example.com",
      passwordHash,
      role: "GUARD",
    },
  });

  await prisma.guardAssignment.create({
    data: { guardId: guard.id, facilityId: facility.id },
  });

  return { facility, floor, zone, spaces, user, guard };
};

const login = async (email) => {
  const res = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return res.body?.data?.accessToken || res.body?.data?.tokens?.accessToken || null;
};

const main = async () => {
  await cleanup();
  const { facility, spaces } = await seed();

  const userToken = await login("verify-user@example.com");
  const guardToken = await login("verify-guard@example.com");
  check("login returns access token", Boolean(userToken) && Boolean(guardToken));

  // ---- Socket.IO: subscribe before mutating ----
  const socket = io(BASE, {
    auth: { token: userToken },
    transports: ["websocket"],
    reconnection: false,
  });

  const events = { availability: [], space: [] };
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("socket connect timeout")), 8000);
    socket.on("connect", () => {
      clearTimeout(timer);
      socket.emit("join:facility", facility.id);
      setTimeout(resolve, 300);
    });
    socket.on("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  check("socket connects with JWT", socket.connected);

  socket.on("parking:availability", (payload) => events.availability.push(payload));
  socket.on("parking:space_updated", (payload) => events.space.push(payload));

  // ---- Map endpoints ----
  const map = await api("/api/parking/map");
  const mapFacility = map.body?.data?.find((f) => f.id === facility.id);
  check("GET /api/parking/map returns facility", map.status === 200 && Boolean(mapFacility));
  check(
    "map coordinates are numbers",
    typeof mapFacility?.latitude === "number" && typeof mapFacility?.longitude === "number",
    `${mapFacility?.latitude}, ${mapFacility?.longitude}`
  );
  check(
    "map exposes openingHours and parkingType",
    mapFacility?.openingHours === "08:00-22:00" && mapFacility?.parkingType === "MULTI_LEVEL"
  );
  check(
    "map availability derived from spaces",
    mapFacility?.availability?.totalSpaces === 4 &&
      mapFacility?.availability?.available === 3 &&
      mapFacility?.availability?.maintenance === 1,
    JSON.stringify(mapFacility?.availability)
  );

  const bounds = await api(
    "/api/parking/map?north=41.5&south=41.0&east=69.5&west=69.0"
  );
  check(
    "map bounds filter includes facility",
    bounds.status === 200 && bounds.body.data.some((f) => f.id === facility.id)
  );

  const outside = await api("/api/parking/map?north=10&south=9&east=10&west=9");
  check(
    "map bounds filter excludes facility",
    outside.status === 200 && !outside.body.data.some((f) => f.id === facility.id)
  );

  const badBounds = await api("/api/parking/map?north=10&south=20");
  check("invalid bounds rejected", badBounds.status === 400, `status ${badBounds.status}`);

  const badId = await api("/api/parking/not-a-uuid");
  check("invalid facility id rejected", badId.status === 400, `status ${badId.status}`);

  const detail = await api(`/api/parking/${facility.id}`);
  check(
    "GET /api/parking/:id returns floors and pricing",
    detail.status === 200 &&
      detail.body.data.floors.length === 1 &&
      Array.isArray(detail.body.data.pricingRules)
  );

  const floors = await api(`/api/parking/${facility.id}/floors`);
  check(
    "GET /api/parking/:id/floors returns zones and spaces",
    floors.status === 200 &&
      floors.body.data.floors[0].zones[0].spaces.length === 4 &&
      floors.body.data.floors[0].availability.available === 3
  );

  const spacesRes = await api(`/api/parking/${facility.id}/spaces?status=AVAILABLE`);
  check(
    "GET /api/parking/:id/spaces filters by status",
    spacesRes.status === 200 && spacesRes.body.meta.total === 3
  );

  const availability = await api(`/api/parking/${facility.id}/availability`);
  check(
    "GET /api/parking/:id/availability counts",
    availability.status === 200 &&
      availability.body.data.available === 3 &&
      availability.body.data.occupied === 0 &&
      availability.body.data.maintenance === 1
  );

  // ---- Reservation flow (transaction + events) ----
  const start = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const end = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

  const reservation = await api("/api/reservations", {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({
      facilityId: facility.id,
      spaceId: spaces[0].id,
      startTime: start,
      endTime: end,
    }),
  });
  check(
    "POST /api/reservations creates reservation",
    reservation.status === 201 && Boolean(reservation.body?.data?.reservation?.id),
    `status ${reservation.status}`
  );

  const afterReserve = await api(`/api/parking/${facility.id}/availability`);
  check(
    "availability reflects reservation",
    afterReserve.body.data.available === 2 && afterReserve.body.data.reserved === 1,
    JSON.stringify({
      available: afterReserve.body.data.available,
      reserved: afterReserve.body.data.reserved,
    })
  );

  const conflict = await api("/api/reservations", {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({
      facilityId: facility.id,
      spaceId: spaces[0].id,
      startTime: start,
      endTime: end,
    }),
  });
  check("overlapping reservation rejected", conflict.status === 409, `status ${conflict.status}`);

  await new Promise((r) => setTimeout(r, 500));
  check(
    "socket received parking:availability",
    events.availability.some((e) => e.facilityId === facility.id && e.available === 2),
    `${events.availability.length} event(s)`
  );
  check(
    "socket received parking:space_updated",
    events.space.some((e) => e.spaceId === spaces[0].id && e.status === "RESERVED"),
    `${events.space.length} event(s)`
  );

  const cancel = await api(`/api/reservations/${reservation.body.data.reservation.id}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
  });
  check("POST /api/reservations/:id/cancel", cancel.status === 200, `status ${cancel.status}`);

  const afterCancel = await api(`/api/parking/${facility.id}/availability`);
  check(
    "availability restored after cancel",
    afterCancel.body.data.available === 3 && afterCancel.body.data.reserved === 0
  );

  // ---- Guard walk-in flow ----
  const entry = await api("/api/guard/entry", {
    method: "POST",
    headers: { Authorization: `Bearer ${guardToken}` },
    body: JSON.stringify({ facilityId: facility.id, licensePlate: "VERIFY01" }),
  });
  check(
    "POST /api/guard/entry assigns a space",
    entry.status === 200 && Boolean(entry.body?.data?.qrToken),
    `status ${entry.status}`
  );

  const afterEntry = await api(`/api/parking/${facility.id}/availability`);
  check(
    "availability reflects check-in",
    afterEntry.body.data.occupied === 1 && afterEntry.body.data.available === 2,
    JSON.stringify({
      occupied: afterEntry.body.data.occupied,
      available: afterEntry.body.data.available,
    })
  );

  const verify = await api("/api/guard/verify-qr", {
    method: "POST",
    headers: { Authorization: `Bearer ${guardToken}` },
    body: JSON.stringify({ qrToken: entry.body.data.qrToken }),
  });
  check("POST /api/guard/verify-qr validates ticket", verify.status === 200 && verify.body.data.valid === true);

  const exit = await api("/api/guard/exit", {
    method: "POST",
    headers: { Authorization: `Bearer ${guardToken}` },
    body: JSON.stringify({ qrToken: entry.body.data.qrToken }),
  });
  check(
    "POST /api/guard/exit completes session",
    exit.status === 200 && exit.body.data.session.status === "COMPLETED",
    `status ${exit.status}`
  );

  const afterExit = await api(`/api/parking/${facility.id}/availability`);
  check(
    "availability reflects check-out",
    afterExit.body.data.occupied === 0 && afterExit.body.data.available === 3,
    JSON.stringify({
      occupied: afterExit.body.data.occupied,
      available: afterExit.body.data.available,
    })
  );

  const replay = await api("/api/guard/exit", {
    method: "POST",
    headers: { Authorization: `Bearer ${guardToken}` },
    body: JSON.stringify({ qrToken: entry.body.data.qrToken }),
  });
  check("QR replay rejected", replay.status === 409, `status ${replay.status}`);

  const unauth = await api("/api/guard/entry", {
    method: "POST",
    body: JSON.stringify({ facilityId: facility.id, licensePlate: "VERIFY02" }),
  });
  check("guard endpoint requires auth", unauth.status === 401, `status ${unauth.status}`);

  const userForbidden = await api("/api/guard/entry", {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({ facilityId: facility.id, licensePlate: "VERIFY03" }),
  });
  check("guard endpoint rejects USER role", userForbidden.status === 403, `status ${userForbidden.status}`);

  socket.close();
  await cleanup();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("FAILED:", failed.map((f) => f.name).join("; "));
    process.exitCode = 1;
  }
};

main()
  .catch(async (error) => {
    console.error("VERIFY ERROR:", error);
    try {
      await cleanup();
    } catch {}
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
