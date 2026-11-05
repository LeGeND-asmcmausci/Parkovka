import { clamp, dayKey, hoursBetween, percent, sleep, uid } from '@/lib/utils';
import type {
  AppNotification,
  AuditLog,
  AuthSession,
  Camera,
  CheckInInput,
  CheckOutInput,
  CheckOutResult,
  CreateFacilityInput,
  DashboardStats,
  Facility,
  FacilitySearchParams,
  FacilityWithAvailability,
  Floor,
  Incident,
  LocalizedText,
  ParkingSession,
  ParkingSpace,
  Payment,
  PaymentMethod,
  PricingRule,
  Reservation,
  Review,
  Role,
  SpaceStatus,
  User,
  Vehicle,
  Zone,
} from '@/lib/types';
import { ApiError } from './errors';
import { buildSeed, type FixtureState, type SystemSettings } from './fixtures';

const STORAGE_KEY = 'parkovka.fixture-state.v1';
let state: FixtureState | null = null;

function db() {
  if (state) return state;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FixtureState;
      if (parsed.facilities?.length && parsed.pricingRules?.length) {
        state = parsed;
        return state;
      }
    }
  } catch {
    // Ignore corrupted fixture state and rebuild it.
  }
  state = buildSeed();
  persist();
  return state;
}

function persist() {
  if (!state) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private mode; the in-memory state still works.
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

async function latency() {
  await sleep(120 + Math.random() * 160);
}

function nowIso() {
  return new Date().toISOString();
}

function tokenFor(userId: string) {
  return `mock.${userId}.${Date.now().toString(36)}`;
}

function tokenUserId(token: string) {
  const [prefix, userId] = token.split('.');
  return prefix === 'mock' && userId ? userId : null;
}

function currentUserFromToken(token: string): User {
  const userId = tokenUserId(token);
  const user = db().users.find((item) => item.id === userId);
  if (!user) throw new ApiError('UNAUTHORIZED', 'Session expired', 401);
  return user;
}

function makeSession(user: User): AuthSession {
  return {
    user,
    accessToken: tokenFor(user.id),
    refreshToken: tokenFor(user.id),
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
}

function audit(actor: string, actorRole: Role, action: string, entity: string, entityId: string) {
  const log: AuditLog = {
    id: uid('aud'),
    actor,
    actorRole,
    action,
    entity,
    entityId,
    at: nowIso(),
    ip: '10.0.4.21',
  };
  db().auditLogs.unshift(log);
  db().auditLogs = db().auditLogs.slice(0, 120);
}

function notify(notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) {
  db().notifications.unshift({
    ...notification,
    id: uid('ntf'),
    read: false,
    createdAt: nowIso(),
  });
}

const l = (uz: string, ru: string, en: string): LocalizedText => ({ uz, ru, en });

function availability(facility: Facility): FacilityWithAvailability {
  const spaces = db().spaces.filter((space) => space.facilityId === facility.id);
  const count = (status: SpaceStatus) => spaces.filter((space) => space.status === status).length;
  return {
    ...clone(facility),
    totalSpaces: spaces.length || facility.totalSpaces,
    availableSpaces: count('AVAILABLE'),
    occupiedSpaces: count('OCCUPIED'),
    reservedSpaces: count('RESERVED'),
  };
}

function recalculateTotals(facilityId: string) {
  const data = db();
  const facility = data.facilities.find((item) => item.id === facilityId);
  if (!facility) return;
  facility.totalSpaces = data.spaces.filter((space) => space.facilityId === facilityId).length;
  data.floors
    .filter((floor) => floor.facilityId === facilityId)
    .forEach((floor) => {
      floor.totalSpaces = data.spaces.filter((space) => space.floorId === floor.id).length;
    });
}

function reservationAmount(facility: Facility, zone: Zone | undefined, hours: number) {
  const multiplier = zone?.rateMultiplier ?? 1;
  const raw = Math.ceil(hours) * facility.hourlyRate * multiplier;
  return Math.round(Math.min(facility.dailyCap, raw) + facility.reservationFee);
}

function isToday(value: string) {
  return dayKey(value) === dayKey(new Date());
}

function isFuture(value: string) {
  return new Date(value).getTime() > Date.now();
}

function releaseSpace(spaceId: string) {
  const space = db().spaces.find((item) => item.id === spaceId);
  if (!space) return;
  if (space.status === 'RESERVED' || space.status === 'OCCUPIED') {
    space.status = 'AVAILABLE';
    space.updatedAt = nowIso();
  }
}

// ---------- Auth ----------

export async function mockLogin(email: string, password: string): Promise<AuthSession> {
  await latency();
  const user = db().users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || db().passwords[user.email] !== password) {
    throw new ApiError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }
  if (user.status === 'SUSPENDED') {
    throw new ApiError('FORBIDDEN', 'Account suspended', 403);
  }
  return clone(makeSession(user));
}

export async function mockRegister(input: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}): Promise<AuthSession> {
  await latency();
  const email = input.email.trim().toLowerCase();
  if (db().users.some((user) => user.email.toLowerCase() === email)) {
    throw new ApiError('EMAIL_TAKEN', 'Email already registered', 409);
  }
  const user: User = {
    id: uid('usr'),
    fullName: input.fullName.trim(),
    email,
    phone: input.phone,
    role: 'USER',
    status: 'ACTIVE',
    createdAt: nowIso(),
  };
  db().users.push(user);
  db().passwords[email] = input.password;
  notify({
    userId: user.id,
    title: l('Xush kelibsiz!', 'Добро пожаловать!', 'Welcome!'),
    body: l(
      'Parkovka hisobingiz tayyor. Birinchi parking joyingizni band qiling.',
      'Ваш аккаунт Parkovka готов. Забронируйте первое место.',
      'Your Parkovka account is ready. Book your first space.',
    ),
    kind: 'SYSTEM',
    href: '/search',
  });
  audit(user.fullName, 'USER', 'registered account', 'user', user.email);
  persist();
  return clone(makeSession(user));
}

export async function mockMe(token: string): Promise<User> {
  await latency();
  return clone(currentUserFromToken(token));
}

export async function mockUpdateProfile(
  userId: string,
  patch: Partial<Pick<User, 'fullName' | 'phone' | 'email'>>,
): Promise<User> {
  await latency();
  const user = db().users.find((item) => item.id === userId);
  if (!user) throw new ApiError('NOT_FOUND', 'User not found', 404);
  const previousEmail = user.email;
  Object.assign(user, patch);
  if (patch.email && patch.email !== previousEmail) {
    const oldPassword = db().passwords[previousEmail];
    if (oldPassword) {
      db().passwords[patch.email] = oldPassword;
      delete db().passwords[previousEmail];
    }
  }
  persist();
  return clone(user);
}

// ---------- Facilities ----------

export async function mockFacilities(params: FacilitySearchParams = {}): Promise<FacilityWithAvailability[]> {
  await latency();
  const query = params.query?.trim().toLowerCase();
  let items = db()
    .facilities.map(availability)
    .filter((facility) => {
      if (params.city && params.city !== 'all' && facility.city !== params.city) return false;
      if (params.type && params.type !== 'ALL' && facility.type !== params.type) return false;
      if (params.maxPrice && facility.hourlyRate > params.maxPrice) return false;
      if (params.availability === 'available' && facility.availableSpaces === 0) return false;
      if (query) {
        const haystack = [
          ...Object.values(facility.name),
          ...Object.values(facility.address),
          ...Object.values(facility.district),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

  switch (params.sort) {
    case 'price-asc':
      items = items.sort((a, b) => a.hourlyRate - b.hourlyRate);
      break;
    case 'price-desc':
      items = items.sort((a, b) => b.hourlyRate - a.hourlyRate);
      break;
    case 'rating':
      items = items.sort((a, b) => b.rating - a.rating);
      break;
    case 'availability':
      items = items.sort((a, b) => b.availableSpaces - a.availableSpaces);
      break;
    default:
      items = items.sort((a, b) => b.rating * b.availableSpaces - a.rating * a.availableSpaces);
  }
  return clone(items);
}

export async function mockFacility(idOrSlug: string): Promise<FacilityWithAvailability> {
  await latency();
  const facility = db().facilities.find((item) => item.id === idOrSlug || item.slug === idOrSlug);
  if (!facility) throw new ApiError('NOT_FOUND', 'Facility not found', 404);
  return clone(availability(facility));
}

export async function mockFloors(facilityId: string): Promise<Floor[]> {
  await latency();
  return clone(
    db()
      .floors.filter((floor) => floor.facilityId === facilityId)
      .sort((a, b) => a.level - b.level),
  );
}

export async function mockZones(floorId: string): Promise<Zone[]> {
  await latency();
  return clone(db().zones.filter((zone) => zone.floorId === floorId));
}

export async function mockSpaces(filters: {
  facilityId?: string;
  floorId?: string;
  zoneId?: string;
  status?: SpaceStatus;
} = {}): Promise<ParkingSpace[]> {
  await latency();
  return clone(
    db().spaces.filter((space) => {
      if (filters.facilityId && space.facilityId !== filters.facilityId) return false;
      if (filters.floorId && space.floorId !== filters.floorId) return false;
      if (filters.zoneId && space.zoneId !== filters.zoneId) return false;
      if (filters.status && space.status !== filters.status) return false;
      return true;
    }),
  );
}

export async function mockSpaceAvailability(spaceId: string): Promise<{ available: boolean }> {
  await latency();
  const space = db().spaces.find((item) => item.id === spaceId);
  if (!space) throw new ApiError('NOT_FOUND', 'Space not found', 404);
  return { available: space.status === 'AVAILABLE' };
}

export async function mockCreateFacility(input: CreateFacilityInput): Promise<Facility> {
  await latency();
  const id = uid('fac');
  const slug = input.name.en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const facility: Facility = {
    id,
    slug,
    name: input.name,
    description: input.description,
    address: input.address,
    city: input.city,
    district: input.district,
    lat: 41.2995,
    lng: 69.2401,
    type: input.type,
    image: input.image ?? '/images/facility-markaziy.jpg',
    open24h: input.type === 'AIRPORT',
    openTime: '08:00',
    closeTime: '23:00',
    amenities: ['cctv', 'security', 'covered'],
    rules: [
      l('Tezlik chegarasi 10 km/soat.', 'Ограничение скорости 10 км/ч.', 'Speed limit 10 km/h.'),
    ],
    hourlyRate: input.hourlyRate,
    dailyCap: input.dailyCap,
    reservationFee: 2000,
    rating: 0,
    reviewCount: 0,
    totalSpaces: 0,
    phone: '+998 71 200 00 00',
    status: 'ACTIVE',
  };
  db().facilities.push(facility);

  const floor: Floor = {
    id: `${id}_f1`,
    facilityId: id,
    name: 'P1',
    level: 1,
    totalSpaces: 0,
    status: 'ACTIVE',
  };
  const zone: Zone = {
    id: `${floor.id}_z1`,
    facilityId: id,
    floorId: floor.id,
    name: 'A',
    type: 'STANDARD',
    rateMultiplier: 1,
  };
  db().floors.push(floor);
  db().zones.push(zone);

  const capacity = clamp(Math.round(input.capacity), 1, 90);
  for (let index = 0; index < capacity; index += 1) {
    const column = index % 9;
    const row = Math.floor(index / 9);
    db().spaces.push({
      id: `${zone.id}_s${index + 1}`,
      code: `P1-A${String(index + 1).padStart(2, '0')}`,
      facilityId: id,
      floorId: floor.id,
      zoneId: zone.id,
      x: 74 + column * 96,
      y: 52 + row * 148,
      w: 84,
      h: 92,
      status: 'AVAILABLE',
      type: 'STANDARD',
      sensor: true,
      updatedAt: nowIso(),
    });
  }
  recalculateTotals(id);
  audit('Nigora Abdullayeva', 'ADMIN', 'created facility', 'facility', facility.name.en);
  persist();
  return clone(facility);
}

export async function mockUpdateFacility(id: string, patch: Partial<Facility>): Promise<Facility> {
  await latency();
  const facility = db().facilities.find((item) => item.id === id);
  if (!facility) throw new ApiError('NOT_FOUND', 'Facility not found', 404);
  Object.assign(facility, patch, { id: facility.id });
  audit('Nigora Abdullayeva', 'ADMIN', 'updated facility', 'facility', facility.name.en);
  persist();
  return clone(facility);
}

export async function mockDeleteFacility(id: string): Promise<void> {
  await latency();
  if (db().sessions.some((session) => session.facilityId === id && session.status === 'ACTIVE')) {
    throw new ApiError('VALIDATION', 'Facility has active sessions', 409);
  }
  if (
    db().reservations.some(
      (reservation) =>
        reservation.facilityId === id &&
        (reservation.status === 'CONFIRMED' || reservation.status === 'ACTIVE'),
    )
  ) {
    throw new ApiError('VALIDATION', 'Facility has active reservations', 409);
  }
  const data = db();
  const facility = data.facilities.find((item) => item.id === id);
  data.facilities = data.facilities.filter((item) => item.id !== id);
  data.floors = data.floors.filter((item) => item.facilityId !== id);
  data.zones = data.zones.filter((item) => item.facilityId !== id);
  data.spaces = data.spaces.filter((item) => item.facilityId !== id);
  data.cameras = data.cameras.filter((item) => item.facilityId !== id);
  audit('Nigora Abdullayeva', 'ADMIN', 'deleted facility', 'facility', facility?.name.en ?? id);
  persist();
}

export async function mockUpdateSpaceStatus(spaceId: string, status: SpaceStatus): Promise<ParkingSpace> {
  await latency();
  const space = db().spaces.find((item) => item.id === spaceId);
  if (!space) throw new ApiError('NOT_FOUND', 'Space not found', 404);
  if (
    (status === 'BLOCKED' || status === 'MAINTENANCE') &&
    db().sessions.some((session) => session.spaceId === spaceId && session.status === 'ACTIVE')
  ) {
    throw new ApiError('VALIDATION', 'Space has an active session', 409);
  }
  space.status = status;
  space.updatedAt = nowIso();
  audit('Nigora Abdullayeva', 'ADMIN', `set space ${status.toLowerCase()}`, 'space', space.code);
  persist();
  return clone(space);
}

export async function mockAddFloor(facilityId: string): Promise<Floor> {
  await latency();
  const existing = db().floors.filter((floor) => floor.facilityId === facilityId);
  const level = existing.length + 1;
  const floor: Floor = {
    id: uid(`${facilityId}_f`),
    facilityId,
    name: `P${level}`,
    level,
    totalSpaces: 0,
    status: 'ACTIVE',
  };
  db().floors.push(floor);
  const zone: Zone = {
    id: `${floor.id}_z1`,
    facilityId,
    floorId: floor.id,
    name: 'A',
    type: 'STANDARD',
    rateMultiplier: 1,
  };
  db().zones.push(zone);
  for (let index = 0; index < 9; index += 1) {
    db().spaces.push({
      id: `${zone.id}_s${index + 1}`,
      code: `${floor.name}-A${String(index + 1).padStart(2, '0')}`,
      facilityId,
      floorId: floor.id,
      zoneId: zone.id,
      x: 74 + index * 96,
      y: 52,
      w: 84,
      h: 92,
      status: 'AVAILABLE',
      type: 'STANDARD',
      sensor: true,
      updatedAt: nowIso(),
    });
  }
  recalculateTotals(facilityId);
  audit('Nigora Abdullayeva', 'ADMIN', 'added floor', 'floor', floor.name);
  persist();
  return clone(floor);
}

export async function mockAddZone(floorId: string): Promise<Zone> {
  await latency();
  const floor = db().floors.find((item) => item.id === floorId);
  if (!floor) throw new ApiError('NOT_FOUND', 'Floor not found', 404);
  const existing = db().zones.filter((zone) => zone.floorId === floorId);
  const index = existing.length;
  const zone: Zone = {
    id: uid(`${floorId}_z`),
    facilityId: floor.facilityId,
    floorId,
    name: String.fromCharCode(65 + index),
    type: index === 1 ? 'EV' : index >= 2 ? 'VIP' : 'STANDARD',
    rateMultiplier: index === 1 ? 1.2 : index >= 2 ? 1.5 : 1,
  };
  db().zones.push(zone);
  for (let spaceIndex = 0; spaceIndex < 9; spaceIndex += 1) {
    db().spaces.push({
      id: `${zone.id}_s${spaceIndex + 1}`,
      code: `${floor.name}-${zone.name}${String(spaceIndex + 1).padStart(2, '0')}`,
      facilityId: floor.facilityId,
      floorId,
      zoneId: zone.id,
      x: 74 + spaceIndex * 96,
      y: 52 + index * 148,
      w: 84,
      h: 92,
      status: 'AVAILABLE',
      type: zone.type,
      sensor: true,
      updatedAt: nowIso(),
    });
  }
  recalculateTotals(floor.facilityId);
  audit('Nigora Abdullayeva', 'ADMIN', 'added zone', 'zone', `${floor.name}-${zone.name}`);
  persist();
  return clone(zone);
}

export async function mockAddSpace(zoneId: string): Promise<ParkingSpace> {
  await latency();
  const zone = db().zones.find((item) => item.id === zoneId);
  if (!zone) throw new ApiError('NOT_FOUND', 'Zone not found', 404);
  const floor = db().floors.find((item) => item.id === zone.floorId);
  const zoneSpaces = db().spaces.filter((space) => space.zoneId === zoneId);
  const index = zoneSpaces.length;
  const column = index % 9;
  const row = Math.floor(index / 9);
  const space: ParkingSpace = {
    id: uid(`${zoneId}_s`),
    code: `${floor?.name ?? 'P1'}-${zone.name}${String(index + 1).padStart(2, '0')}`,
    facilityId: zone.facilityId,
    floorId: zone.floorId,
    zoneId,
    x: 74 + column * 96,
    y: 52 + row * 148,
    w: 84,
    h: 92,
    status: 'AVAILABLE',
    type: zone.type,
    sensor: true,
    updatedAt: nowIso(),
  };
  db().spaces.push(space);
  recalculateTotals(zone.facilityId);
  audit('Nigora Abdullayeva', 'ADMIN', 'added space', 'space', space.code);
  persist();
  return clone(space);
}

// ---------- Reservations ----------

export async function mockReservations(filters: {
  userId?: string;
  facilityId?: string;
} = {}): Promise<Reservation[]> {
  await latency();
  return clone(
    db()
      .reservations.filter((reservation) => {
        if (filters.userId && reservation.userId !== filters.userId) return false;
        if (filters.facilityId && reservation.facilityId !== filters.facilityId) return false;
        return true;
      })
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
  );
}

export async function mockReservation(id: string): Promise<Reservation> {
  await latency();
  const reservation = db().reservations.find((item) => item.id === id);
  if (!reservation) throw new ApiError('NOT_FOUND', 'Reservation not found', 404);
  return clone(reservation);
}

export async function mockCreateReservation(
  input: {
    facilityId: string;
    floorId: string;
    zoneId: string;
    spaceId: string;
    startsAt: string;
    endsAt: string;
    vehicleId: string;
    paymentMethod: PaymentMethod;
  },
  userId: string,
): Promise<Reservation> {
  await latency();
  const data = db();
  const user = data.users.find((item) => item.id === userId);
  if (!user) throw new ApiError('UNAUTHORIZED', 'User not found', 401);
  const facility = data.facilities.find((item) => item.id === input.facilityId);
  const space = data.spaces.find((item) => item.id === input.spaceId);
  const zone = data.zones.find((item) => item.id === input.zoneId);
  const vehicle = data.vehicles.find(
    (item) => item.id === input.vehicleId && item.userId === userId,
  );
  if (!facility || !space || !zone) throw new ApiError('NOT_FOUND', 'Booking target not found', 404);
  if (!vehicle) throw new ApiError('VALIDATION', 'Vehicle not found for this user', 422);
  if (space.status !== 'AVAILABLE') {
    throw new ApiError('SPACE_UNAVAILABLE', 'Selected space is not available', 409);
  }
  const start = new Date(input.startsAt).getTime();
  const end = new Date(input.endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    throw new ApiError('VALIDATION', 'Invalid booking time range', 422);
  }
  const hours = hoursBetween(input.startsAt, input.endsAt);
  if (hours > 168) throw new ApiError('VALIDATION', 'Booking is too long', 422);

  const totalAmount = reservationAmount(facility, zone, hours);
  const reference = `RSV-${String(9100 + data.reservations.length + 1)}`;
  const qrToken = `PVK-${Array.from({ length: 8 }, () =>
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)],
  ).join('')}`;
  const reservation: Reservation = {
    id: uid('res'),
    reference,
    userId,
    facilityId: facility.id,
    floorId: space.floorId,
    zoneId: space.zoneId,
    spaceId: space.id,
    spaceCode: space.code,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: 'CONFIRMED',
    vehicleId: vehicle.id,
    vehiclePlate: vehicle.plate,
    totalAmount,
    paidAmount: input.paymentMethod === 'CASH' ? 0 : totalAmount,
    paymentStatus: input.paymentMethod === 'CASH' ? 'UNPAID' : 'PAID',
    qrToken,
    createdAt: nowIso(),
  };
  data.reservations.push(reservation);
  space.status = 'RESERVED';
  space.updatedAt = nowIso();

  if (input.paymentMethod !== 'CASH') {
    data.payments.unshift({
      id: uid('pay'),
      reference: `PAY-${Date.now().toString().slice(-6)}`,
      userId,
      reservationId: reservation.id,
      facilityId: facility.id,
      amount: totalAmount,
      method: input.paymentMethod,
      status: 'PAID',
      createdAt: nowIso(),
      paidAt: nowIso(),
    });
  }

  notify({
    userId,
    title: l('Bron tasdiqlandi', 'Бронь подтверждена', 'Reservation confirmed'),
    body: l(
      `${facility.name.uz}, ${space.code} joyi band qilindi.`,
      `${facility.name.ru}, место ${space.code} забронировано.`,
      `${facility.name.en}, space ${space.code} booked.`,
    ),
    kind: 'RESERVATION',
    href: '/app/reservations',
  });
  audit(user.fullName, 'USER', 'created reservation', 'reservation', reference);
  persist();
  return clone(reservation);
}

export async function mockCancelReservation(id: string, userId: string): Promise<Reservation> {
  await latency();
  const data = db();
  const reservation = data.reservations.find((item) => item.id === id);
  if (!reservation) throw new ApiError('NOT_FOUND', 'Reservation not found', 404);
  if (reservation.userId !== userId) throw new ApiError('FORBIDDEN', 'Not your reservation', 403);
  if (reservation.status === 'ACTIVE') {
    throw new ApiError('VALIDATION', 'Active reservation cannot be cancelled', 409);
  }
  if (reservation.status !== 'CONFIRMED' && reservation.status !== 'PENDING') {
    throw new ApiError('VALIDATION', 'Reservation cannot be cancelled', 409);
  }
  if (!isFuture(reservation.startsAt)) {
    throw new ApiError('VALIDATION', 'Reservation has already started', 409);
  }
  reservation.status = 'CANCELLED';
  if (reservation.paymentStatus === 'PAID') {
    reservation.paymentStatus = 'REFUNDED';
    data.payments
      .filter((payment) => payment.reservationId === reservation.id)
      .forEach((payment) => {
        payment.status = 'REFUNDED';
      });
  }
  releaseSpace(reservation.spaceId);
  notify({
    userId,
    title: l('Bron bekor qilindi', 'Бронь отменена', 'Reservation cancelled'),
    body: l(
      `${reservation.reference} broni bekor qilindi.`,
      `Бронь ${reservation.reference} отменена.`,
      `Reservation ${reservation.reference} was cancelled.`,
    ),
    kind: 'RESERVATION',
    href: '/app/reservations',
  });
  audit('Dilshod Karimov', 'USER', 'cancelled reservation', 'reservation', reservation.reference);
  persist();
  return clone(reservation);
}

export async function mockFindReservationByCode(code: string): Promise<Reservation> {
  await latency();
  const normalized = code.trim().toUpperCase().replace(/\s+/g, '');
  const reservation = db().reservations.find(
    (item) =>
      item.qrToken.toUpperCase() === normalized || item.reference.toUpperCase() === normalized,
  );
  if (!reservation) throw new ApiError('NOT_FOUND', 'Ticket not found', 404);
  if (reservation.status === 'CANCELLED' || reservation.status === 'EXPIRED') {
    throw new ApiError('VALIDATION', 'Ticket is no longer valid', 409);
  }
  return clone(reservation);
}

// ---------- Vehicles ----------

export async function mockVehicles(userId: string): Promise<Vehicle[]> {
  await latency();
  return clone(db().vehicles.filter((vehicle) => vehicle.userId === userId));
}

export async function mockCreateVehicle(
  userId: string,
  input: Omit<Vehicle, 'id' | 'userId' | 'isDefault'>,
): Promise<Vehicle> {
  await latency();
  const existing = db().vehicles.filter((vehicle) => vehicle.userId === userId);
  if (existing.some((vehicle) => vehicle.plate.toUpperCase() === input.plate.toUpperCase())) {
    throw new ApiError('VALIDATION', 'Vehicle with this plate already exists', 409);
  }
  const vehicle: Vehicle = {
    ...input,
    id: uid('veh'),
    userId,
    isDefault: existing.length === 0,
  };
  db().vehicles.push(vehicle);
  persist();
  return clone(vehicle);
}

export async function mockUpdateVehicle(
  userId: string,
  vehicleId: string,
  patch: Partial<Vehicle>,
): Promise<Vehicle> {
  await latency();
  const vehicle = db().vehicles.find((item) => item.id === vehicleId && item.userId === userId);
  if (!vehicle) throw new ApiError('NOT_FOUND', 'Vehicle not found', 404);
  if (patch.isDefault) {
    db()
      .vehicles.filter((item) => item.userId === userId)
      .forEach((item) => {
        item.isDefault = item.id === vehicleId;
      });
  }
  Object.assign(vehicle, patch, { id: vehicle.id, userId: vehicle.userId });
  persist();
  return clone(vehicle);
}

export async function mockDeleteVehicle(userId: string, vehicleId: string): Promise<void> {
  await latency();
  const activeReservation = db().reservations.some(
    (reservation) =>
      reservation.vehicleId === vehicleId &&
      (reservation.status === 'CONFIRMED' || reservation.status === 'ACTIVE'),
  );
  if (activeReservation) {
    throw new ApiError('VALIDATION', 'Vehicle is used by an active reservation', 409);
  }
  const vehicle = db().vehicles.find((item) => item.id === vehicleId && item.userId === userId);
  if (!vehicle) throw new ApiError('NOT_FOUND', 'Vehicle not found', 404);
  db().vehicles = db().vehicles.filter((item) => item.id !== vehicleId);
  if (vehicle.isDefault) {
    const next = db().vehicles.find((item) => item.userId === userId);
    if (next) next.isDefault = true;
  }
  persist();
}

// ---------- Sessions ----------

export async function mockSessions(filters: {
  facilityId?: string;
  userId?: string;
  status?: ParkingSession['status'];
} = {}): Promise<ParkingSession[]> {
  await latency();
  return clone(
    db()
      .sessions.filter((session) => {
        if (filters.facilityId && session.facilityId !== filters.facilityId) return false;
        if (filters.userId && session.userId !== filters.userId) return false;
        if (filters.status && session.status !== filters.status) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.exitAt ?? b.entryAt).getTime() - new Date(a.exitAt ?? a.entryAt).getTime(),
      ),
  );
}

export async function mockLookupEntry(query: string): Promise<{
  reservation?: Reservation;
  activeSession?: ParkingSession;
  vehiclePlate: string;
}> {
  await latency();
  const normalized = query.trim().toUpperCase().replace(/\s+/g, ' ');
  const reservation = db().reservations.find(
    (item) =>
      item.qrToken.toUpperCase() === normalized ||
      item.reference.toUpperCase() === normalized ||
      item.vehiclePlate.toUpperCase() === normalized,
  );
  const activeSession = db().sessions.find(
    (item) => item.status === 'ACTIVE' && item.vehiclePlate.toUpperCase() === normalized,
  );
  return clone({ reservation, activeSession, vehiclePlate: normalized });
}

export async function mockCheckIn(input: CheckInInput): Promise<ParkingSession> {
  await latency();
  const data = db();
  const facility = data.facilities.find((item) => item.id === input.facilityId);
  if (!facility) throw new ApiError('NOT_FOUND', 'Facility not found', 404);
  const plate = input.plate.trim().toUpperCase();

  if (data.sessions.some((session) => session.status === 'ACTIVE' && session.vehiclePlate === plate)) {
    throw new ApiError('VALIDATION', 'Vehicle is already inside', 409);
  }

  let space: ParkingSpace | undefined;
  let reservation: Reservation | undefined;
  let userId: string | undefined;
  let amount = 0;

  if (input.reservationId) {
    reservation = data.reservations.find((item) => item.id === input.reservationId);
    if (!reservation) throw new ApiError('NOT_FOUND', 'Reservation not found', 404);
    if (reservation.status !== 'CONFIRMED' && reservation.status !== 'PENDING') {
      throw new ApiError('VALIDATION', 'Reservation is not valid for entry', 409);
    }
    space = data.spaces.find((item) => item.id === reservation?.spaceId);
    userId = reservation.userId;
    amount = reservation.totalAmount;
    reservation.status = 'ACTIVE';
  } else {
    space = data.spaces.find((item) => item.id === input.spaceId);
  }

  if (!space) throw new ApiError('VALIDATION', 'Space not found', 422);
  if (space.status !== 'AVAILABLE' && space.status !== 'RESERVED') {
    throw new ApiError('SPACE_UNAVAILABLE', 'Space is not available', 409);
  }

  space.status = 'OCCUPIED';
  space.updatedAt = nowIso();
  const session: ParkingSession = {
    id: uid('ses'),
    reference: `SES-${String(5100 + data.sessions.length + 1)}`,
    facilityId: facility.id,
    floorId: space.floorId,
    zoneId: space.zoneId,
    spaceId: space.id,
    spaceCode: space.code,
    userId,
    vehiclePlate: plate || reservation?.vehiclePlate || 'N/A',
    entryAt: nowIso(),
    status: 'ACTIVE',
    amount,
    paid: reservation ? reservation.paymentStatus === 'PAID' : false,
    reservationId: reservation?.id,
    entryGuardId: input.guardId,
  };
  data.sessions.unshift(session);

  if (userId) {
    notify({
      userId,
      title: l('Kirish qayd etildi', 'Въезд зафиксирован', 'Entry recorded'),
      body: l(
        `${facility.name.uz}, ${space.code} joyiga kirdingiz.`,
        `${facility.name.ru}, вы въехали на место ${space.code}.`,
        `You entered ${facility.name.en}, space ${space.code}.`,
      ),
      kind: 'ENTRY',
      href: '/app/active',
    });
  }
  audit(input.guardId ? 'Bekzod Rahimov' : 'System', 'GUARD', 'recorded vehicle entry', 'session', session.reference);
  persist();
  return clone(session);
}

export async function mockCheckOut(
  sessionId: string,
  input: CheckOutInput,
): Promise<CheckOutResult> {
  await latency();
  const data = db();
  const session = data.sessions.find((item) => item.id === sessionId);
  if (!session) throw new ApiError('NOT_FOUND', 'Session not found', 404);
  if (session.status !== 'ACTIVE') throw new ApiError('VALIDATION', 'Session is already closed', 409);
  const facility = data.facilities.find((item) => item.id === session.facilityId);
  if (!facility) throw new ApiError('NOT_FOUND', 'Facility not found', 404);
  const reservation = session.reservationId
    ? data.reservations.find((item) => item.id === session.reservationId)
    : undefined;
  const hours = Math.max(0.25, hoursBetween(session.entryAt, nowIso()));
  const computed = reservation
    ? reservation.totalAmount
    : Math.round(
        Math.min(facility.dailyCap, Math.ceil(hours) * facility.hourlyRate) + facility.reservationFee,
      );

  const wasPaid = session.paid;

  session.exitAt = nowIso();
  session.status = 'COMPLETED';
  session.amount = computed;
  session.paid = input.pay ? true : session.paid;
  session.exitGuardId = input.guardId;

  let payment: Payment | undefined;
  if (input.pay && !wasPaid) {
    payment = {
      id: uid('pay'),
      reference: `PAY-${Date.now().toString().slice(-6)}`,
      userId: session.userId ?? 'usr_demo',
      sessionId: session.id,
      reservationId: session.reservationId,
      facilityId: session.facilityId,
      amount: computed,
      method: input.method,
      status: 'PAID',
      createdAt: nowIso(),
      paidAt: nowIso(),
    };
    data.payments.unshift(payment);
  }

  if (reservation) {
    reservation.status = 'COMPLETED';
  }
  releaseSpace(session.spaceId);

  if (session.userId) {
    notify({
      userId: session.userId,
      title: l('Chiqish qayd etildi', 'Выезд зафиксирован', 'Exit recorded'),
      body: l(
        `${facility.name.uz}. Yakuniy summa: ${computed.toLocaleString('uz-UZ')} so‘m.`,
        `${facility.name.ru}. Итоговая сумма: ${computed.toLocaleString('ru-RU')} сум.`,
        `${facility.name.en}. Final amount: ${computed.toLocaleString('en-US')} UZS.`,
      ),
      kind: 'EXIT',
      href: '/app/payments',
    });
  }
  audit(input.guardId ? 'Bekzod Rahimov' : 'System', 'GUARD', 'recorded vehicle exit', 'session', session.reference);
  persist();
  return clone({ session, payment });
}

// ---------- Payments, reviews, notifications ----------

export async function mockPayments(filters: {
  userId?: string;
  facilityId?: string;
} = {}): Promise<Payment[]> {
  await latency();
  return clone(
    db()
      .payments.filter((payment) => {
        if (filters.userId && payment.userId !== filters.userId) return false;
        if (filters.facilityId && payment.facilityId !== filters.facilityId) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  );
}

export async function mockReviews(facilityId: string): Promise<Review[]> {
  await latency();
  return clone(
    db()
      .reviews.filter((review) => review.facilityId === facilityId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  );
}

export async function mockUserReviews(userId: string): Promise<Review[]> {
  await latency();
  return clone(db().reviews.filter((review) => review.userId === userId));
}

export async function mockCreateReview(input: {
  facilityId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
}): Promise<Review> {
  await latency();
  if (input.rating < 1 || input.rating > 5) {
    throw new ApiError('VALIDATION', 'Rating must be between 1 and 5', 422);
  }
  const review: Review = {
    id: uid('rev'),
    facilityId: input.facilityId,
    userId: input.userId,
    userName: input.userName,
    rating: input.rating,
    comment: input.comment.trim(),
    createdAt: nowIso(),
  };
  db().reviews.unshift(review);
  const facility = db().facilities.find((item) => item.id === input.facilityId);
  if (facility) {
    const reviews = db().reviews.filter((item) => item.facilityId === input.facilityId);
    facility.rating =
      Math.round((reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length) * 10) / 10;
    facility.reviewCount += 1;
  }
  persist();
  return clone(review);
}

export async function mockNotifications(userId?: string, role?: Role): Promise<AppNotification[]> {
  await latency();
  return clone(
    db()
      .notifications.filter((notification) => {
        if (notification.userId) return notification.userId === userId;
        if (notification.role) return notification.role === role;
        return false;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  );
}

export async function mockMarkNotificationRead(id: string): Promise<void> {
  await latency();
  const notification = db().notifications.find((item) => item.id === id);
  if (notification) {
    notification.read = true;
    persist();
  }
}

export async function mockMarkAllNotificationsRead(userId?: string, role?: Role): Promise<void> {
  await latency();
  db()
    .notifications.filter((notification) =>
      notification.userId ? notification.userId === userId : notification.role === role,
    )
    .forEach((notification) => {
      notification.read = true;
    });
  persist();
}

// ---------- Admin ----------

export async function mockUsers(role?: Role): Promise<User[]> {
  await latency();
  return clone(db().users.filter((user) => (role ? user.role === role : true)));
}

export async function mockCreateUser(input: {
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  facilityIds?: string[];
}): Promise<User> {
  await latency();
  const email = input.email.trim().toLowerCase();
  if (db().users.some((user) => user.email.toLowerCase() === email)) {
    throw new ApiError('EMAIL_TAKEN', 'Email already registered', 409);
  }
  const user: User = {
    id: uid('usr'),
    fullName: input.fullName,
    email,
    phone: input.phone,
    role: input.role,
    status: 'ACTIVE',
    facilityIds: input.facilityIds,
    createdAt: nowIso(),
  };
  db().users.push(user);
  db().passwords[email] = 'parkovka';
  audit('Nigora Abdullayeva', 'ADMIN', 'created user', 'user', user.email);
  persist();
  return clone(user);
}

export async function mockUpdateUser(id: string, patch: Partial<User>): Promise<User> {
  await latency();
  const user = db().users.find((item) => item.id === id);
  if (!user) throw new ApiError('NOT_FOUND', 'User not found', 404);
  Object.assign(user, patch, { id: user.id });
  audit('Nigora Abdullayeva', 'ADMIN', 'updated user', 'user', user.email);
  persist();
  return clone(user);
}

export async function mockCameras(facilityId?: string): Promise<Camera[]> {
  await latency();
  return clone(
    db().cameras.filter((camera) => (facilityId ? camera.facilityId === facilityId : true)),
  );
}

export async function mockToggleCamera(id: string): Promise<Camera> {
  await latency();
  const camera = db().cameras.find((item) => item.id === id);
  if (!camera) throw new ApiError('NOT_FOUND', 'Camera not found', 404);
  camera.status = camera.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
  camera.lastSeen = nowIso();
  persist();
  return clone(camera);
}

export async function mockIncidents(facilityId?: string): Promise<Incident[]> {
  await latency();
  return clone(
    db()
      .incidents.filter((incident) => (facilityId ? incident.facilityId === facilityId : true))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  );
}

export async function mockCreateIncident(input: {
  facilityId: string;
  type: Incident['type'];
  severity: Incident['severity'];
  description: string;
  plate?: string;
  reportedBy: string;
}): Promise<Incident> {
  await latency();
  const incident: Incident = {
    id: uid('inc'),
    ...input,
    createdAt: nowIso(),
    status: 'OPEN',
  };
  db().incidents.unshift(incident);
  notify({
    role: 'ADMIN',
    title: l('Yangi hodisa', 'Новый инцидент', 'New incident'),
    body: l(input.description, input.description, input.description),
    kind: 'INCIDENT',
    href: '/admin/reports',
  });
  audit(input.reportedBy, 'GUARD', 'reported incident', 'incident', incident.id);
  persist();
  return clone(incident);
}

export async function mockResolveIncident(id: string): Promise<Incident> {
  await latency();
  const incident = db().incidents.find((item) => item.id === id);
  if (!incident) throw new ApiError('NOT_FOUND', 'Incident not found', 404);
  incident.status = 'RESOLVED';
  audit('Nigora Abdullayeva', 'ADMIN', 'resolved incident', 'incident', incident.id);
  persist();
  return clone(incident);
}

export async function mockPricingRules(): Promise<PricingRule[]> {
  await latency();
  return clone(db().pricingRules);
}

export async function mockUpdatePricingRule(
  id: string,
  patch: Partial<PricingRule>,
): Promise<PricingRule> {
  await latency();
  const rule = db().pricingRules.find((item) => item.id === id);
  if (!rule) throw new ApiError('NOT_FOUND', 'Pricing rule not found', 404);
  Object.assign(rule, patch, { id: rule.id });
  audit('Nigora Abdullayeva', 'ADMIN', 'updated pricing rule', 'pricing', rule.id);
  persist();
  return clone(rule);
}

export async function mockAuditLogs(): Promise<AuditLog[]> {
  await latency();
  return clone(db().auditLogs);
}

export async function mockSettings(): Promise<SystemSettings> {
  await latency();
  return clone(db().settings);
}

export async function mockUpdateSettings(patch: Partial<SystemSettings>): Promise<SystemSettings> {
  await latency();
  Object.assign(db().settings, patch);
  audit('Nigora Abdullayeva', 'ADMIN', 'updated system settings', 'settings', 'global');
  persist();
  return clone(db().settings);
}

export async function mockDashboardStats(facilityId?: string, days = 7): Promise<DashboardStats> {
  await latency();
  const data = db();
  const spaces = data.spaces.filter((space) => (facilityId ? space.facilityId === facilityId : true));
  const facilities = data.facilities.filter((facility) =>
    facilityId ? facility.id === facilityId : true,
  );
  const reservations = data.reservations.filter(
    (reservation) => !facilityId || reservation.facilityId === facilityId,
  );
  const payments = data.payments.filter((payment) => !facilityId || payment.facilityId === facilityId);
  const sessions = data.sessions.filter((session) => !facilityId || session.facilityId === facilityId);

  const totalSpaces = spaces.length;
  const available = spaces.filter((space) => space.status === 'AVAILABLE').length;
  const occupied = spaces.filter((space) => space.status === 'OCCUPIED').length;
  const reserved = spaces.filter((space) => space.status === 'RESERVED').length;
  const blocked = spaces.filter((space) => space.status === 'BLOCKED').length;
  const maintenance = spaces.filter((space) => space.status === 'MAINTENANCE').length;
  const activeSessions = sessions.filter((session) => session.status === 'ACTIVE').length;
  const todayReservations = reservations.filter((reservation) => isToday(reservation.startsAt)).length;
  const todayRevenue = payments
    .filter(
      (payment) =>
        payment.status === 'PAID' && payment.paidAt !== undefined && isToday(payment.paidAt),
    )
    .reduce((sum, payment) => sum + payment.amount, 0);

  const revenueSeries = Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    const key = dayKey(date);
    const revenue = payments
      .filter(
        (payment) =>
          payment.status === 'PAID' && payment.paidAt && dayKey(payment.paidAt) === key,
      )
      .reduce((sum, payment) => sum + payment.amount, 0);
    const bookings = reservations.filter((reservation) => dayKey(reservation.startsAt) === key).length;
    return { date: key, revenue, bookings };
  });

  const hourLabels = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
  const curve = [0.52, 0.76, 0.94, 0.82, 0.88, 1, 0.68, 0.32];
  const base = percent(occupied + reserved, totalSpaces);
  const occupancySeries = hourLabels.map((hour, index) => ({
    hour,
    occupancy: Math.round(clamp(base * curve[index], 3, 99)),
  }));

  const methodTotals = new Map<PaymentMethod, number>();
  payments
    .filter((payment) => payment.status === 'PAID')
    .forEach((payment) => {
      methodTotals.set(payment.method, (methodTotals.get(payment.method) ?? 0) + payment.amount);
    });
  const paymentDistribution = [...methodTotals.entries()].map(([method, amount]) => ({
    method,
    amount,
  }));

  const facilityPerformance = facilities.map((facility) => {
    const facilitySpaces = data.spaces.filter((space) => space.facilityId === facility.id);
    const facilityOccupied = facilitySpaces.filter(
      (space) => space.status === 'OCCUPIED' || space.status === 'RESERVED',
    ).length;
    const facilityRevenue = data.payments
      .filter((payment) => payment.facilityId === facility.id && payment.status === 'PAID')
      .reduce((sum, payment) => sum + payment.amount, 0);
    const facilityReservations = data.reservations.filter(
      (reservation) => reservation.facilityId === facility.id && isToday(reservation.startsAt),
    ).length;
    return {
      facilityId: facility.id,
      name: facility.name,
      occupancy: percent(facilityOccupied, facilitySpaces.length),
      revenue: facilityRevenue,
      reservations: facilityReservations,
    };
  });

  return {
    totalSpaces,
    available,
    occupied,
    reserved,
    blocked,
    maintenance,
    activeSessions,
    todayReservations,
    todayRevenue,
    occupancyRate: percent(occupied + reserved, totalSpaces),
    revenueSeries,
    occupancySeries,
    paymentDistribution,
    facilityPerformance,
  };
}

export async function mockGuardSummary(facilityIds?: string[]) {
  await latency();
  const data = db();
  const inScope = (facilityId: string) =>
    !facilityIds || facilityIds.length === 0 || facilityIds.includes(facilityId);
  const todaySessions = data.sessions.filter(
    (session) => inScope(session.facilityId) && isToday(session.entryAt),
  );
  const entriesToday = todaySessions.length;
  const exitsToday = todaySessions.filter((session) => session.status === 'COMPLETED').length;
  const revenueToday = data.payments
    .filter(
      (payment) =>
        payment.status === 'PAID' && inScope(payment.facilityId) && payment.paidAt && isToday(payment.paidAt),
    )
    .reduce((sum, payment) => sum + payment.amount, 0);
  const activeSessions = data.sessions.filter(
    (session) => session.status === 'ACTIVE' && inScope(session.facilityId),
  ).length;
  const freeSpaces = data.spaces.filter(
    (space) => space.status === 'AVAILABLE' && inScope(space.facilityId),
  ).length;
  const openIncidents = data.incidents.filter(
    (incident) => incident.status === 'OPEN' && inScope(incident.facilityId),
  ).length;
  return { entriesToday, exitsToday, revenueToday, activeSessions, freeSpaces, openIncidents };
}

export function resetFixtures() {
  state = buildSeed();
  persist();
}
