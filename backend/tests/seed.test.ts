import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/utils/db";
import { seed } from "../prisma/seed";

const FACILITY_ID = "11111111-1111-4111-8111-111111111111";

let firstRun: Awaited<ReturnType<typeof seed>>;

beforeAll(async () => {
  firstRun = await seed();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("prisma seed", () => {
  it("creates the demo facility, floors, zones and spaces", async () => {
    const facility = await prisma.parkingFacility.findUnique({
      where: { id: FACILITY_ID },
      include: { floors: { include: { zones: { include: { spaces: true } } } } },
    });

    expect(facility).not.toBeNull();
    expect(facility?.name).toBe("Parkovka Markaziy");
    expect(facility?.floors.length).toBe(2);
    expect(facility?.floors.length).toBe(2);

    const zones = facility?.floors.flatMap((floor) => floor.zones) ?? [];
    const spaces = zones.flatMap((zone) => zone.spaces);

    expect(zones.length).toBe(4);
    expect(spaces.length).toBe(12);
    expect(spaces.length).toBe(facility?.totalSpaces);
    expect(firstRun.seededSpaces).toBe(12);
    expect(firstRun.totals.floors).toBe(2);
  });

  it("creates local-only ADMIN and GUARD accounts", async () => {
    const admin = await prisma.user.findUnique({ where: { email: "admin@parkovka.local" } });
    const guard = await prisma.user.findUnique({ where: { email: "guard@parkovka.local" } });
    const user = await prisma.user.findUnique({ where: { email: "user@parkovka.local" } });

    expect(admin?.role).toBe("ADMIN");
    expect(guard?.role).toBe("GUARD");
    expect(user?.role).toBe("USER");
  });

  it("is idempotent: a second run creates no duplicates", async () => {
    const before = {
      facility: await prisma.parkingFacility.count({ where: { id: FACILITY_ID } }),
      floors: await prisma.parkingFloor.count({ where: { facilityId: FACILITY_ID } }),
      zones: await prisma.parkingZone.count({
        where: { floor: { facilityId: FACILITY_ID } },
      }),
      spaces: await prisma.parkingSpace.count({ where: { facilityId: FACILITY_ID } }),
      users: await prisma.user.count({
        where: { email: { in: ["admin@parkovka.local", "guard@parkovka.local", "user@parkovka.local"] } },
      }),
    };

    const secondRun = await seed();

    const after = {
      facility: await prisma.parkingFacility.count({ where: { id: FACILITY_ID } }),
      floors: await prisma.parkingFloor.count({ where: { facilityId: FACILITY_ID } }),
      zones: await prisma.parkingZone.count({
        where: { floor: { facilityId: FACILITY_ID } },
      }),
      spaces: await prisma.parkingSpace.count({ where: { facilityId: FACILITY_ID } }),
      users: await prisma.user.count({
        where: { email: { in: ["admin@parkovka.local", "guard@parkovka.local", "user@parkovka.local"] } },
      }),
    };

    expect(after).toEqual(before);
    expect(secondRun.totals.spaces).toBe(12);
  });

  it("refuses to run in production", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await expect(seed()).rejects.toThrow(/production/i);
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });
});
