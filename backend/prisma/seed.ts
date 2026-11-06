/**
 * Local development seed for the Smart Parking backend.
 *
 * - Idempotent: every record uses a deterministic id/email and is upserted.
 * - Never destructive: no deleteMany, no truncation, no production run.
 * - Refuses to run when NODE_ENV=production.
 *
 * Credentials below are local-only test accounts; override the passwords with
 * SEED_ADMIN_PASSWORD / SEED_GUARD_PASSWORD / SEED_USER_PASSWORD.
 */

import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FACILITY_ID = "11111111-1111-4111-8111-111111111111";

interface SeedZone {
  id: string;
  name: string;
  zoneCode: string;
  zoneType: string;
  totalSpaces: number;
  spaceCount: number;
}

interface SeedFloor {
  id: string;
  name: string;
  level: number;
  floorName: string;
  zones: SeedZone[];
}

const FLOORS: SeedFloor[] = [
  {
    id: "22222222-2222-4222-8222-222222222201",
    name: "Ground floor",
    level: 0,
    floorName: "Ground",
    zones: [
      {
        id: "33333333-3333-4333-8333-333333333301",
        name: "Zone A",
        zoneCode: "A",
        zoneType: "regular",
        totalSpaces: 4,
        spaceCount: 4,
      },
      {
        id: "33333333-3333-4333-8333-333333333302",
        name: "Zone B (EV)",
        zoneCode: "B",
        zoneType: "EV",
        totalSpaces: 2,
        spaceCount: 2,
      },
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222202",
    name: "Level 1",
    level: 1,
    floorName: "Level 1",
    zones: [
      {
        id: "33333333-3333-4333-8333-333333333303",
        name: "Zone C",
        zoneCode: "C",
        zoneType: "regular",
        totalSpaces: 4,
        spaceCount: 4,
      },
      {
        id: "33333333-3333-4333-8333-333333333304",
        name: "Zone D (VIP)",
        zoneCode: "D",
        zoneType: "VIP",
        totalSpaces: 2,
        spaceCount: 2,
      },
    ],
  },
];

const spaceId = (zoneIndex: number, spaceIndex: number): string =>
  `44444444-4444-4444-8444-${String(zoneIndex * 100 + spaceIndex).padStart(12, "0")}`;

interface SeedUser {
  email: string;
  name: string;
  role: "ADMIN" | "GUARD" | "USER";
  passwordEnv: string;
  defaultPassword: string;
}

const USERS: SeedUser[] = [
  {
    email: "admin@parkovka.local",
    name: "Seed Admin",
    role: "ADMIN",
    passwordEnv: "SEED_ADMIN_PASSWORD",
    defaultPassword: "Admin123!",
  },
  {
    email: "guard@parkovka.local",
    name: "Seed Guard",
    role: "GUARD",
    passwordEnv: "SEED_GUARD_PASSWORD",
    defaultPassword: "Guard123!",
  },
  {
    email: "user@parkovka.local",
    name: "Seed User",
    role: "USER",
    passwordEnv: "SEED_USER_PASSWORD",
    defaultPassword: "User123!",
  },
];

export const seed = async () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a production database (NODE_ENV=production)");
  }

  const totalSpaces = FLOORS.reduce(
    (sum, floor) => sum + floor.zones.reduce((zoneSum, zone) => zoneSum + zone.spaceCount, 0),
    0
  );

  const facility = await prisma.parkingFacility.upsert({
    where: { id: FACILITY_ID },
    update: {
      name: "Parkovka Markaziy",
      totalSpaces,
      status: "ACTIVE",
    },
    create: {
      id: FACILITY_ID,
      name: "Parkovka Markaziy",
      description: "Seed parking facility for local development",
      address: "Amir Temur ko'chasi 1",
      city: "Tashkent",
      country: "Uzbekistan",
      latitude: "41.311081",
      longitude: "69.240562",
      totalSpaces,
      covered: true,
      status: "ACTIVE",
      hourlyRate: 2000,
      dailyRate: 20000,
      currency: "UZS",
      timezone: "Asia/Tashkent",
      openingHours: "24/7",
      parkingType: "MULTI_LEVEL",
    },
  });

  const bp = Number(process.env.SEED_BCRYPT_ROUNDS) || 10;

  for (const user of USERS) {
    const password = process.env[user.passwordEnv] || user.defaultPassword;
    const passwordHash = await bcrypt.hash(password, bp);

    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, status: "ACTIVE" },
      create: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
        status: "ACTIVE",
      },
    });
  }

  let spaceTotal = 0;

  for (const [floorIndex, floor] of FLOORS.entries()) {
    const floorSpaces = floor.zones.reduce((sum, zone) => sum + zone.spaceCount, 0);

    await prisma.parkingFloor.upsert({
      where: { id: floor.id },
      update: { name: floor.name, level: floor.level, floorName: floor.floorName, totalSpaces: floorSpaces },
      create: {
        id: floor.id,
        facilityId: facility.id,
        name: floor.name,
        level: floor.level,
        floorName: floor.floorName,
        totalSpaces: floorSpaces,
        status: "ACTIVE",
      },
    });

    for (const [zoneIndex, zone] of floor.zones.entries()) {
      await prisma.parkingZone.upsert({
        where: { id: zone.id },
        update: { name: zone.name, zoneType: zone.zoneType, totalSpaces: zone.totalSpaces },
        create: {
          id: zone.id,
          floorId: floor.id,
          name: zone.name,
          zoneCode: zone.zoneCode,
          zoneType: zone.zoneType,
          totalSpaces: zone.totalSpaces,
          covered: floor.level === 0,
          status: "ACTIVE",
        },
      });

      for (let index = 1; index <= zone.spaceCount; index += 1) {
        const id = spaceId(floorIndex * 2 + zoneIndex, index);
        const spaceNumber = `${zone.zoneCode}-${String(index).padStart(2, "0")}`;
        const pricePerHour = zone.zoneType === "VIP" ? 5000 : zone.zoneType === "EV" ? 3000 : 2000;

        await prisma.parkingSpace.upsert({
          where: { id },
          update: {
            spaceNumber,
            zoneName: zone.zoneCode,
            status: "AVAILABLE",
            pricePerHour,
          },
          create: {
            id,
            zoneId: zone.id,
            floorId: floor.id,
            facilityId: facility.id,
            spaceNumber,
            level: floor.level,
            zoneName: zone.zoneCode,
            spaceType: zone.zoneType === "EV" ? "EV" : zone.zoneType === "VIP" ? "VIP" : "regular",
            status: "AVAILABLE",
            pricePerHour,
            pricePerDay: pricePerHour * 10,
            maxStayDuration: 0,
          },
        });

        spaceTotal += 1;
      }
    }
  }

  const [users, floors, zones, spaces] = await Promise.all([
    prisma.user.count(),
    prisma.parkingFloor.count({ where: { facilityId: facility.id } }),
    prisma.parkingZone.count(),
    prisma.parkingSpace.count({ where: { facilityId: facility.id } }),
  ]);

  return {
    facilityId: facility.id,
    facilityName: facility.name,
    seededSpaces: spaceTotal,
    totals: { users, floors, zones, spaces },
    accounts: USERS.map((user) => ({
      email: user.email,
      role: user.role,
      password: process.env[user.passwordEnv] || user.defaultPassword,
    })),
  };
};

if (require.main === module) {
  seed()
    .then((summary) => {
      // eslint-disable-next-line no-console
      console.log("Seed completed:", JSON.stringify(summary, null, 2));
      // eslint-disable-next-line no-console
      console.log("These accounts and passwords are for LOCAL DEVELOPMENT only.");
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("Seed failed:", error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export default seed;
