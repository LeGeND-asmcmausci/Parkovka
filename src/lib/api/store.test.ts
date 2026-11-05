import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import {
  mockCancelReservation,
  mockCheckIn,
  mockCheckOut,
  mockCreateReservation,
  mockFacilities,
  mockFloors,
  mockLogin,
  mockPayments,
  mockSpaceAvailability,
  mockSpaces,
  mockUpdateProfile,
  mockZones,
  resetFixtures,
} from '@/lib/api/store';

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

async function bookingTarget() {
  const facilities = await mockFacilities();
  const facility = facilities.find((item) => item.id === 'fac_markaziy');
  if (!facility) throw new Error('Fixture facility missing');
  const floors = await mockFloors(facility.id);
  const zones = await mockZones(floors[0].id);
  const spaces = await mockSpaces({ zoneId: zones[0].id, status: 'AVAILABLE' });
  return { facility, zone: zones[0], space: spaces[0] };
}

describe('fixture api', () => {
  beforeEach(() => {
    resetFixtures();
  });

  it('logs in a demo user and rejects a wrong password', async () => {
    const session = await mockLogin('demo@parkovka.uz', 'parkovka');
    expect(session.user.role).toBe('USER');
    expect(session.accessToken).toContain('mock.usr_demo');

    await expect(mockLogin('demo@parkovka.uz', 'wrong-password')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('creates a reservation, reserves the space, and releases it on cancel', async () => {
    const session = await mockLogin('demo@parkovka.uz', 'parkovka');
    const { facility, zone, space } = await bookingTarget();

    const reservation = await mockCreateReservation(
      {
        facilityId: facility.id,
        floorId: space.floorId,
        zoneId: zone.id,
        spaceId: space.id,
        startsAt: hoursFromNow(1),
        endsAt: hoursFromNow(3),
        vehicleId: 'veh_demo_1',
        paymentMethod: 'CASH',
      },
      session.user.id,
    );

    expect(reservation.status).toBe('CONFIRMED');
    expect(reservation.paymentStatus).toBe('UNPAID');
    expect(reservation.reference).toMatch(/^RSV-\d{4}$/);
    expect(reservation.qrToken).toMatch(/^PVK-[A-Z0-9]{8}$/);
    expect(reservation.spaceId).toBe(space.id);
    expect(reservation.totalAmount).toBeGreaterThan(0);
    await expect(mockSpaceAvailability(space.id)).resolves.toEqual({ available: false });

    const cancelled = await mockCancelReservation(reservation.id, session.user.id);
    expect(cancelled.status).toBe('CANCELLED');
    await expect(mockSpaceAvailability(space.id)).resolves.toEqual({ available: true });
  });

  it('refuses to book a space that is not available', async () => {
    const session = await mockLogin('demo@parkovka.uz', 'parkovka');
    const { facility, zone, space } = await bookingTarget();
    await mockCreateReservation(
      {
        facilityId: facility.id,
        floorId: space.floorId,
        zoneId: zone.id,
        spaceId: space.id,
        startsAt: hoursFromNow(1),
        endsAt: hoursFromNow(2),
        vehicleId: 'veh_demo_1',
        paymentMethod: 'CASH',
      },
      session.user.id,
    );

    await expect(
      mockCreateReservation(
        {
          facilityId: facility.id,
          floorId: space.floorId,
          zoneId: zone.id,
          spaceId: space.id,
          startsAt: hoursFromNow(4),
          endsAt: hoursFromNow(5),
          vehicleId: 'veh_demo_2',
          paymentMethod: 'CASH',
        },
        session.user.id,
      ),
    ).rejects.toMatchObject({ code: 'SPACE_UNAVAILABLE' });
  });

  it('checks a reservation in and creates exactly one payment on checkout', async () => {
    const session = await mockLogin('demo@parkovka.uz', 'parkovka');
    const { facility, zone, space } = await bookingTarget();
    const reservation = await mockCreateReservation(
      {
        facilityId: facility.id,
        floorId: space.floorId,
        zoneId: zone.id,
        spaceId: space.id,
        startsAt: hoursFromNow(1),
        endsAt: hoursFromNow(3),
        vehicleId: 'veh_demo_1',
        paymentMethod: 'CASH',
      },
      session.user.id,
    );

    const parking = await mockCheckIn({
      facilityId: facility.id,
      plate: '01 Z 999 ZZ',
      reservationId: reservation.id,
      guardId: 'usr_guard',
    });
    expect(parking.status).toBe('ACTIVE');
    expect(parking.paid).toBe(false);

    const result = await mockCheckOut(parking.id, {
      pay: true,
      method: 'CASH',
      guardId: 'usr_guard',
    });
    expect(result.session.status).toBe('COMPLETED');
    expect(result.payment?.amount).toBe(reservation.totalAmount);

    const payments = await mockPayments({ facilityId: facility.id });
    expect(payments.filter((payment) => payment.sessionId === parking.id)).toHaveLength(1);

    await expect(mockCheckOut(parking.id, { pay: true, method: 'CASH' })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('moves the password when a profile email changes', async () => {
    const session = await mockLogin('demo@parkovka.uz', 'parkovka');
    await mockUpdateProfile(session.user.id, { email: 'new-demo@parkovka.uz' });

    await expect(mockLogin('new-demo@parkovka.uz', 'parkovka')).resolves.toMatchObject({
      user: { id: session.user.id },
    });
    await expect(mockLogin('demo@parkovka.uz', 'parkovka')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });
});
