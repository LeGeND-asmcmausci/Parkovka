import type {
  AuthSession,
  CheckInInput,
  CheckOutInput,
  CheckOutResult,
  FacilitySearchParams,
  FacilityWithAvailability,
  Floor,
  ParkingSession,
  ParkingSpace,
  Payment,
  PaymentMethod,
  Reservation,
  Role,
  SpaceStatus,
  User,
  Zone,
} from '@/lib/types';
import { ApiError } from './errors';
import { apiRequest } from './client';

/**
 * Adapter for the backend documented in docs/FRONTEND_API_CONTRACT.md.
 *
 * It only calls endpoints that exist in the backend. Features the backend does
 * not expose reject with NOT_SUPPORTED instead of guessing a route.
 */

interface BackendUser {
  id: string;
  name?: string | null;
  email: string;
  role: Role;
  status?: string | null;
  phone?: string | null;
  licensePlate?: string | null;
  createdAt?: string;
}

interface BackendAuthData {
  user: BackendUser;
  tokens: { accessToken: string; refreshToken: string };
}

interface BackendFacilitySummary {
  id: string;
  name: string;
  description?: string | null;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  hourlyRate?: number | null;
  dailyRate?: number | null;
  totalSpaces?: number | null;
  status?: string | null;
  _count?: { floors?: number; spaces?: number } | null;
}

interface BackendSpace {
  id: string;
  spaceNumber: string;
  spaceType?: string | null;
  status?: string | null;
  zoneId?: string | null;
  floorId?: string | null;
  facilityId?: string | null;
  zone?: { id?: string; name?: string; zoneCode?: string; zoneType?: string | null } | null;
  floor?: { id?: string; name?: string; floorName?: string; level?: number } | null;
}

interface BackendZone {
  id: string;
  name?: string | null;
  zoneCode?: string | null;
  zoneType?: string | null;
  totalSpaces?: number | null;
  floorId?: string | null;
  spaces?: BackendSpace[] | null;
}

interface BackendFloor {
  id: string;
  facilityId?: string | null;
  name?: string | null;
  floorName?: string | null;
  level?: number | null;
  totalSpaces?: number | null;
  status?: string | null;
  zones?: BackendZone[] | null;
}

interface BackendFacilityDetail extends BackendFacilitySummary {
  floors?: BackendFloor[] | null;
}

interface BackendReservationSpace {
  id: string;
  spaceNumber: string;
  floorId?: string | null;
  zoneId?: string | null;
  facilityId?: string | null;
}

interface BackendReservation {
  id: string;
  userId: string;
  facilityId: string;
  spaceId: string;
  startTime: string;
  endTime: string;
  status: string;
  paymentStatus: string;
  priceCents?: number | null;
  createdAt?: string;
  space?: BackendReservationSpace | null;
}

interface BackendReservationResponse {
  reservation: BackendReservation;
  qrToken?: string;
}

interface BackendSession {
  id: string;
  userId?: string | null;
  spaceId: string;
  facilityId: string;
  entryTime: string;
  expectedExit?: string | null;
  actualExitTime?: string | null;
  basePriceCents?: number | null;
  finalPriceCents?: number | null;
  status?: string | null;
  space?: BackendSpace | null;
  vehicle?: { plateNumber?: string } | null;
}

interface BackendEntryResponse {
  session: BackendSession;
  qrToken?: string;
  space?: { id?: string; spaceNumber?: string } | null;
}

interface BackendExitResponse {
  session: BackendSession;
  finalPriceCents?: number;
  durationMinutes?: number;
  exitQrToken?: string;
}

interface BackendPayment {
  id: string;
  userId?: string | null;
  reservationId?: string | null;
  parkingSessionId?: string | null;
  amountCents: number;
  paymentMethod: string;
  status: string;
  createdAt?: string;
  paidAt?: string | null;
}

interface BackendInitiatedPayment {
  paymentId: string;
  amount: number;
  paymentMethod: string;
  status: string;
}

interface SpaceFallback {
  facilityId?: string;
  floorId?: string;
  zoneId?: string;
  spaceId?: string;
  spaceCode?: string;
  guardId?: string;
  amountCents?: number;
  vehicleId?: string;
  vehiclePlate?: string;
  qrToken?: string;
}

interface FacilityBundle {
  facility: FacilityWithAvailability;
  floors: Floor[];
  zones: Zone[];
  spaces: ParkingSpace[];
}

const CACHE_TTL = 30_000;
const bundles = new Map<string, { at: number; bundle: FacilityBundle }>();
const bundleRequests = new Map<string, Promise<FacilityBundle>>();
const slugIndex = new Map<string, string>();
const floorIndex = new Map<string, string>();
const zoneIndex = new Map<string, string>();
const spaceIndex = new Map<string, string>();
const reservationQrTokens = new Map<string, string>();
let listCache: { at: number; items: BackendFacilitySummary[] } | null = null;

export function notSupported(feature: string, hint?: string): Promise<never> {
  const suffix = hint ? ` ${hint}` : '';
  return Promise.reject(
    new ApiError(
      'NOT_SUPPORTED',
      `${feature} is not available in the backend API.${suffix}`,
      501,
    ),
  );
}

function isUuid(value: string | undefined | null): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  );
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
}

function centsToAmount(cents: number | null | undefined): number {
  return Math.round((cents ?? 0) / 100);
}

function localize(value: string | null | undefined) {
  const text = value ?? '';
  return { uz: text, ru: text, en: text };
}

function slugify(value: string, id: string): string {
  const base = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'parking'}-${id.slice(0, 8)}`;
}

function mapUserStatus(value: string | null | undefined): User['status'] {
  if (value === 'INACTIVE') return 'INACTIVE';
  if (value === 'SUSPENDED') return 'SUSPENDED';
  return 'ACTIVE';
}

function mapSpaceStatus(value: string | null | undefined): SpaceStatus {
  if (value === 'RESERVED' || value === 'RESERVED_HELD') return 'RESERVED';
  if (value === 'OCCUPIED') return 'OCCUPIED';
  if (value === 'MAINTENANCE') return 'MAINTENANCE';
  if (value === 'BLOCKED') return 'BLOCKED';
  return 'AVAILABLE';
}

function mapZoneType(value: string | null | undefined): Zone['type'] {
  const normalized = (value ?? '').toLowerCase();
  if (normalized === 'ev') return 'EV';
  if (normalized === 'vip') return 'VIP';
  if (normalized === 'disabled' || normalized === 'accessible') return 'ACCESSIBLE';
  return 'STANDARD';
}

function mapFacilityStatus(value: string | null | undefined): FacilityWithAvailability['status'] {
  if (value === 'MAINTENANCE') return 'MAINTENANCE';
  if (value === 'INACTIVE' || value === 'CLOSED') return 'CLOSED';
  return 'ACTIVE';
}

function mapFloorStatus(value: string | null | undefined): Floor['status'] {
  return value === 'ACTIVE' ? 'ACTIVE' : 'MAINTENANCE';
}

function mapCity(value: string | null | undefined): FacilityWithAvailability['city'] {
  const normalized = (value ?? '').toLowerCase();
  if (normalized.includes('samarqand') || normalized.includes('samarkand')) return 'samarkand';
  if (normalized.includes('buxoro') || normalized.includes('bukhara')) return 'bukhara';
  return 'tashkent';
}

function mapReservationStatus(value: string): Reservation['status'] {
  if (
    value === 'PENDING' ||
    value === 'CONFIRMED' ||
    value === 'ACTIVE' ||
    value === 'COMPLETED' ||
    value === 'CANCELLED' ||
    value === 'EXPIRED' ||
    value === 'NO_SHOW'
  ) {
    return value;
  }
  return 'CONFIRMED';
}

function mapPaymentStatus(value: string): Reservation['paymentStatus'] {
  if (value === 'COMPLETED' || value === 'PAID') return 'PAID';
  if (value === 'REFUNDED') return 'REFUNDED';
  return 'UNPAID';
}

function mapPaymentState(value: string): Payment['status'] {
  if (value === 'COMPLETED' || value === 'PAID') return 'PAID';
  if (value === 'FAILED') return 'FAILED';
  if (value === 'REFUNDED') return 'REFUNDED';
  return 'PENDING';
}

function mapPaymentMethod(value: string): PaymentMethod {
  if (value === 'CLICK' || value === 'PAYME' || value === 'CASH') return value;
  return 'CASH';
}

function deriveReference(prefix: 'RSV' | 'SES' | 'PAY', id: string): string {
  return `${prefix}-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function tokenExpiry(token: string | undefined): number {
  const fallback = Date.now() + 15 * 60_000;
  if (!token) return fallback;
  try {
    const payload = token.split('.')[1];
    if (!payload) return fallback;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(atob(normalized)) as { exp?: number };
    return typeof parsed.exp === 'number' ? parsed.exp * 1000 : fallback;
  } catch {
    return fallback;
  }
}

function readStoredUser(): User | undefined {
  try {
    const raw = window.localStorage.getItem('parkovka.session.v1');
    if (!raw) return undefined;
    return (JSON.parse(raw) as AuthSession).user;
  } catch {
    return undefined;
  }
}

function mapUser(raw: BackendUser, fallback?: Partial<User>): User {
  return {
    id: raw.id,
    fullName: raw.name ?? fallback?.fullName ?? '',
    email: raw.email,
    phone: raw.phone ?? fallback?.phone ?? '',
    role: raw.role,
    status: mapUserStatus(raw.status),
    facilityIds: fallback?.facilityIds,
    createdAt: raw.createdAt ?? fallback?.createdAt ?? new Date().toISOString(),
    notes: fallback?.notes,
  };
}

function mapAuth(data: BackendAuthData): AuthSession {
  return {
    user: mapUser(data.user),
    accessToken: data.tokens.accessToken,
    refreshToken: data.tokens.refreshToken,
    expiresAt: tokenExpiry(data.tokens.accessToken),
  };
}

function registerIndexes(bundle: FacilityBundle) {
  const { facility } = bundle;
  slugIndex.set(facility.slug, facility.id);
  bundle.floors.forEach((floor) => floorIndex.set(floor.id, facility.id));
  bundle.zones.forEach((zone) => zoneIndex.set(zone.id, facility.id));
  bundle.spaces.forEach((space) => spaceIndex.set(space.id, facility.id));
}

function mapFacilityDetail(detail: BackendFacilityDetail): FacilityBundle {
  const floors: Floor[] = [];
  const zones: Zone[] = [];
  const spaces: ParkingSpace[] = [];

  (detail.floors ?? []).forEach((floorRaw, floorIdx) => {
    const floorId = floorRaw.id;
    const level = floorRaw.level ?? floorIdx + 1;
    const floorName = floorRaw.name || floorRaw.floorName || `P${level}`;
    let floorSpaceCount = 0;

    (floorRaw.zones ?? []).forEach((zoneRaw, zoneIdx) => {
      const zoneId = zoneRaw.id;
      const zoneCode = zoneRaw.zoneCode || zoneRaw.name || String.fromCharCode(65 + zoneIdx);
      const zoneType = mapZoneType(zoneRaw.zoneType);
      zones.push({
        id: zoneId,
        facilityId: detail.id,
        floorId,
        name: zoneRaw.name || zoneCode,
        type: zoneType,
        rateMultiplier: 1,
      });

      const zoneSpaces = zoneRaw.spaces ?? [];
      const step = zoneSpaces.length > 1 ? Math.min(96, (920 - 84) / (zoneSpaces.length - 1)) : 96;
      zoneSpaces.forEach((spaceRaw, spaceIdx) => {
        spaces.push({
          id: spaceRaw.id,
          code: spaceRaw.spaceNumber,
          facilityId: detail.id,
          floorId,
          zoneId,
          x: Math.round(74 + spaceIdx * step),
          y: 52 + zoneIdx * 148,
          w: 84,
          h: 92,
          status: mapSpaceStatus(spaceRaw.status),
          type: mapZoneType(spaceRaw.spaceType ?? zoneRaw.zoneType),
          sensor: false,
          updatedAt: new Date().toISOString(),
        });
        floorSpaceCount += 1;
      });
    });

    floors.push({
      id: floorId,
      facilityId: detail.id,
      name: floorName,
      level,
      totalSpaces: floorRaw.totalSpaces ?? floorSpaceCount,
      status: mapFloorStatus(floorRaw.status),
    });
  });

  const count = (status: SpaceStatus) => spaces.filter((space) => space.status === status).length;
  const available = count('AVAILABLE');
  const occupied = count('OCCUPIED');
  const reserved = count('RESERVED');
  const totalSpaces = detail.totalSpaces || spaces.length || detail._count?.spaces || 0;

  const facility: FacilityWithAvailability = {
    id: detail.id,
    slug: slugify(detail.name, detail.id),
    name: localize(detail.name),
    description: localize(detail.description),
    address: localize(detail.address),
    city: mapCity(detail.city),
    district: localize(detail.address || detail.city),
    lat: toNumber(detail.latitude),
    lng: toNumber(detail.longitude),
    type: 'PUBLIC',
    image: '/images/facility-city.jpg',
    open24h: true,
    openTime: '00:00',
    closeTime: '23:59',
    amenities: [],
    rules: [],
    hourlyRate: detail.hourlyRate ?? 0,
    dailyCap: detail.dailyRate ?? 0,
    reservationFee: 0,
    rating: 0,
    reviewCount: 0,
    totalSpaces,
    phone: '',
    status: mapFacilityStatus(detail.status),
    availableSpaces: available,
    occupiedSpaces: occupied,
    reservedSpaces: reserved,
  };

  return { facility, floors, zones, spaces };
}

function mapFacilitySummary(summary: BackendFacilitySummary): FacilityWithAvailability {
  return {
    id: summary.id,
    slug: slugify(summary.name, summary.id),
    name: localize(summary.name),
    description: localize(summary.description),
    address: localize(summary.address),
    city: mapCity(summary.city),
    district: localize(summary.address || summary.city),
    lat: toNumber(summary.latitude),
    lng: toNumber(summary.longitude),
    type: 'PUBLIC',
    image: '/images/facility-city.jpg',
    open24h: true,
    openTime: '00:00',
    closeTime: '23:59',
    amenities: [],
    rules: [],
    hourlyRate: summary.hourlyRate ?? 0,
    dailyCap: summary.dailyRate ?? 0,
    reservationFee: 0,
    rating: 0,
    reviewCount: 0,
    totalSpaces: summary.totalSpaces || summary._count?.spaces || 0,
    phone: '',
    status: mapFacilityStatus(summary.status),
    availableSpaces: 0,
    occupiedSpaces: 0,
    reservedSpaces: 0,
  };
}

async function fetchFacilityList(): Promise<BackendFacilitySummary[]> {
  if (listCache && Date.now() - listCache.at < CACHE_TTL) return listCache.items;
  const items = await apiRequest<BackendFacilitySummary[]>('/parking');
  listCache = { at: Date.now(), items };
  return items;
}

async function getBundle(facilityId: string): Promise<FacilityBundle> {
  const cached = bundles.get(facilityId);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.bundle;

  const pending = bundleRequests.get(facilityId);
  if (pending) return pending;

  const request = (async () => {
    const detail = await apiRequest<BackendFacilityDetail>(`/parking/${facilityId}`);
    const bundle = mapFacilityDetail(detail);
    bundles.set(facilityId, { at: Date.now(), bundle });
    registerIndexes(bundle);
    return bundle;
  })();

  bundleRequests.set(facilityId, request);
  try {
    return await request;
  } finally {
    bundleRequests.delete(facilityId);
  }
}

async function resolveFacilityId(idOrSlug: string): Promise<string> {
  const indexed = slugIndex.get(idOrSlug);
  if (indexed) return indexed;
  if (isUuid(idOrSlug)) return idOrSlug;

  const items = await fetchFacilityList();
  items.forEach((item) => slugIndex.set(slugify(item.name, item.id), item.id));
  const resolved = slugIndex.get(idOrSlug);
  if (!resolved) throw new ApiError('NOT_FOUND', 'Parking facility not found', 404);
  return resolved;
}

async function ensureAllBundles(): Promise<void> {
  const items = await fetchFacilityList();
  await Promise.all(items.map((item) => getBundle(item.id).catch(() => null)));
}

async function findBundleByFloor(floorId: string): Promise<FacilityBundle | null> {
  let facilityId = floorIndex.get(floorId);
  if (!facilityId) {
    await ensureAllBundles();
    facilityId = floorIndex.get(floorId);
  }
  return facilityId ? getBundle(facilityId) : null;
}

async function findBundleByZone(zoneId: string): Promise<FacilityBundle | null> {
  let facilityId = zoneIndex.get(zoneId);
  if (!facilityId) {
    await ensureAllBundles();
    facilityId = zoneIndex.get(zoneId);
  }
  return facilityId ? getBundle(facilityId) : null;
}

async function findBundleBySpace(spaceId: string): Promise<FacilityBundle | null> {
  let facilityId = spaceIndex.get(spaceId);
  if (!facilityId) {
    await ensureAllBundles();
    facilityId = spaceIndex.get(spaceId);
  }
  return facilityId ? getBundle(facilityId) : null;
}

function applyFilters(
  items: FacilityWithAvailability[],
  params: FacilitySearchParams,
): FacilityWithAvailability[] {
  let list = [...items];
  const query = params.query?.trim().toLowerCase();

  if (query) {
    list = list.filter((facility) =>
      [facility.name.uz, facility.address.uz, facility.district.uz, facility.city].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }
  if (params.city) {
    const city = params.city.toLowerCase();
    list = list.filter((facility) => facility.city === city);
  }
  if (params.type && params.type !== 'ALL') {
    list = list.filter((facility) => facility.type === params.type);
  }
  if (params.availability === 'available') {
    list = list.filter((facility) => facility.availableSpaces > 0);
  }
  if (typeof params.maxPrice === 'number') {
    const maxPrice = params.maxPrice;
    list = list.filter((facility) => facility.hourlyRate <= maxPrice);
  }

  switch (params.sort) {
    case 'price-asc':
      return list.sort((a, b) => a.hourlyRate - b.hourlyRate);
    case 'price-desc':
      return list.sort((a, b) => b.hourlyRate - a.hourlyRate);
    case 'rating':
      return list.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    case 'availability':
      return list.sort((a, b) => b.availableSpaces - a.availableSpaces);
    default:
      return list;
  }
}

function mapReservation(raw: BackendReservation, fallback: SpaceFallback = {}): Reservation {
  const space = raw.space;
  const paid = raw.paymentStatus === 'COMPLETED' || raw.paymentStatus === 'PAID';
  return {
    id: raw.id,
    reference: deriveReference('RSV', raw.id),
    userId: raw.userId,
    facilityId: raw.facilityId || fallback.facilityId || '',
    floorId: space?.floorId ?? fallback.floorId ?? '',
    zoneId: space?.zoneId ?? fallback.zoneId ?? '',
    spaceId: raw.spaceId || fallback.spaceId || '',
    spaceCode: space?.spaceNumber ?? fallback.spaceCode ?? '',
    startsAt: raw.startTime,
    endsAt: raw.endTime,
    status: mapReservationStatus(raw.status),
    vehicleId: fallback.vehicleId ?? '',
    vehiclePlate: fallback.vehiclePlate ?? '',
    totalAmount: centsToAmount(raw.priceCents),
    paidAmount: paid ? centsToAmount(raw.priceCents) : 0,
    paymentStatus: mapPaymentStatus(raw.paymentStatus),
    qrToken: reservationQrTokens.get(raw.id) ?? fallback.qrToken ?? '',
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

function mapSession(raw: BackendSession, fallback: SpaceFallback = {}): ParkingSession {
  const space = raw.space;
  const amountCents = raw.finalPriceCents ?? raw.basePriceCents ?? fallback.amountCents ?? 0;
  return {
    id: raw.id,
    reference: deriveReference('SES', raw.id),
    facilityId: raw.facilityId || fallback.facilityId || '',
    floorId: space?.floorId ?? fallback.floorId ?? '',
    zoneId: space?.zoneId ?? fallback.zoneId ?? '',
    spaceId: raw.spaceId || space?.id || fallback.spaceId || '',
    spaceCode: space?.spaceNumber ?? fallback.spaceCode ?? '',
    userId: raw.userId ?? undefined,
    vehiclePlate: raw.vehicle?.plateNumber ?? '',
    entryAt: raw.entryTime,
    exitAt: raw.actualExitTime ?? undefined,
    status: raw.status === 'ACTIVE' ? 'ACTIVE' : 'COMPLETED',
    amount: centsToAmount(amountCents),
    paid: false,
    reservationId: undefined,
    entryGuardId: fallback.guardId,
    exitGuardId: fallback.guardId,
  };
}

function mapPayment(raw: BackendPayment): Payment {
  return {
    id: raw.id,
    reference: deriveReference('PAY', raw.id),
    userId: raw.userId ?? '',
    reservationId: raw.reservationId ?? undefined,
    sessionId: raw.parkingSessionId ?? undefined,
    facilityId: '',
    amount: centsToAmount(raw.amountCents),
    method: mapPaymentMethod(raw.paymentMethod),
    status: mapPaymentState(raw.status),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    paidAt: raw.paidAt ?? undefined,
  };
}

function mapInitiatedPayment(
  raw: BackendInitiatedPayment,
  fallback: SpaceFallback & { userId: string; sessionId: string },
): Payment {
  return {
    id: raw.paymentId,
    reference: deriveReference('PAY', raw.paymentId),
    userId: fallback.userId,
    sessionId: fallback.sessionId,
    facilityId: fallback.facilityId ?? '',
    amount: centsToAmount(raw.amount),
    method: mapPaymentMethod(raw.paymentMethod),
    status: mapPaymentState(raw.status),
    createdAt: new Date().toISOString(),
  };
}

async function fetchGuardSessions(): Promise<BackendSession[]> {
  try {
    return await apiRequest<BackendSession[]>('/guard/sessions');
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      throw new ApiError(
        'NOT_SUPPORTED',
        'GET /api/guard/sessions is guard-only. The backend has no session listing endpoint for users or admins.',
        501,
      );
    }
    throw error;
  }
}

function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/\s+/g, ' ').trim();
}

export const realApi = {
  auth: {
    async login(email: string, password: string): Promise<AuthSession> {
      const data = await apiRequest<BackendAuthData>('/auth/login', {
        method: 'POST',
        body: { email, password },
        skipRefresh: true,
      });
      return mapAuth(data);
    },
    async register(input: {
      fullName: string;
      email: string;
      phone: string;
      password: string;
    }): Promise<AuthSession> {
      const data = await apiRequest<BackendAuthData>('/auth/register', {
        method: 'POST',
        body: { name: input.fullName, email: input.email, password: input.password },
        skipRefresh: true,
      });
      return mapAuth(data);
    },
    async me(_token: string): Promise<User> {
      const data = await apiRequest<BackendUser>('/auth/me');
      return mapUser(data, readStoredUser());
    },
  },

  profile: {
    async update(
      _userId: string,
      patch: Partial<Pick<User, 'fullName' | 'phone' | 'email'>>,
    ): Promise<User> {
      const body: Record<string, string> = {};
      if (patch.fullName !== undefined) body.name = patch.fullName;
      if (patch.phone !== undefined) body.phone = patch.phone;
      // PATCH /api/users/profile does not accept email; changing it is a
      // backend gap reported in docs/FRONTEND_AUDIT_REPORT.md.
      const data = await apiRequest<BackendUser>('/users/profile', { method: 'PATCH', body });
      return mapUser(data, readStoredUser());
    },
  },

  facilities: {
    async list(params: FacilitySearchParams = {}): Promise<FacilityWithAvailability[]> {
      const items = await fetchFacilityList();
      const mapped = await Promise.all(
        items.map(async (item) => {
          try {
            const bundle = await getBundle(item.id);
            return bundle.facility;
          } catch {
            return mapFacilitySummary(item);
          }
        }),
      );
      return applyFilters(mapped, params);
    },
    async get(idOrSlug: string): Promise<FacilityWithAvailability> {
      const facilityId = await resolveFacilityId(idOrSlug);
      const bundle = await getBundle(facilityId);
      return bundle.facility;
    },
    async floors(facilityId: string): Promise<Floor[]> {
      const bundle = await getBundle(facilityId);
      return bundle.floors;
    },
    async zones(floorId: string): Promise<Zone[]> {
      const bundle = await findBundleByFloor(floorId);
      if (!bundle) throw new ApiError('NOT_FOUND', 'Floor not found', 404);
      return bundle.zones.filter((zone) => zone.floorId === floorId);
    },
    async spaces(filters: {
      facilityId?: string;
      floorId?: string;
      zoneId?: string;
      status?: SpaceStatus;
    } = {}): Promise<ParkingSpace[]> {
      let bundle: FacilityBundle | null = null;
      if (filters.facilityId) bundle = await getBundle(filters.facilityId);
      else if (filters.floorId) bundle = await findBundleByFloor(filters.floorId);
      else if (filters.zoneId) bundle = await findBundleByZone(filters.zoneId);
      if (!bundle) return [];

      return bundle.spaces.filter((space) => {
        if (filters.facilityId && space.facilityId !== filters.facilityId) return false;
        if (filters.floorId && space.floorId !== filters.floorId) return false;
        if (filters.zoneId && space.zoneId !== filters.zoneId) return false;
        if (filters.status && space.status !== filters.status) return false;
        return true;
      });
    },
    async availability(spaceId: string): Promise<{ available: boolean }> {
      const bundle = await findBundleBySpace(spaceId);
      if (!bundle) return { available: false };

      const data = await apiRequest<{ spaces?: BackendSpace[] }>(
        `/parking/${bundle.facility.id}/availability`,
      );
      const raw = (data.spaces ?? []).find((space) => space.id === spaceId);
      const available = raw?.status === 'AVAILABLE';
      const cachedSpace = bundle.spaces.find((space) => space.id === spaceId);
      if (cachedSpace && raw) {
        cachedSpace.status = mapSpaceStatus(raw.status);
        cachedSpace.updatedAt = new Date().toISOString();
      }
      return { available };
    },
  },

  reservations: {
    async list(filters: { userId?: string; facilityId?: string } = {}): Promise<Reservation[]> {
      const data = await apiRequest<BackendReservation[]>('/reservations');
      const mapped = data.map((item) => mapReservation(item));
      return filters.facilityId
        ? mapped.filter((reservation) => reservation.facilityId === filters.facilityId)
        : mapped;
    },
    async get(id: string): Promise<Reservation> {
      const data = await apiRequest<BackendReservation>(`/reservations/${id}`);
      return mapReservation(data);
    },
    async create(
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
      _userId: string,
    ): Promise<Reservation> {
      const body: Record<string, unknown> = {
        facilityId: input.facilityId,
        spaceId: input.spaceId,
        startTime: input.startsAt,
        endTime: input.endsAt,
      };
      if (isUuid(input.vehicleId)) body.vehicleId = input.vehicleId;

      const data = await apiRequest<BackendReservationResponse>('/reservations', {
        method: 'POST',
        body,
      });
      if (data.qrToken) reservationQrTokens.set(data.reservation.id, data.qrToken);

      const bundle = await findBundleBySpace(input.spaceId).catch(() => null);
      const spaceCode = bundle?.spaces.find((space) => space.id === input.spaceId)?.code;

      listCache = null;
      bundles.delete(input.facilityId);

      return mapReservation(data.reservation, {
        facilityId: input.facilityId,
        floorId: input.floorId,
        zoneId: input.zoneId,
        spaceId: input.spaceId,
        spaceCode,
        vehicleId: input.vehicleId,
        qrToken: data.qrToken,
      });
    },
    async cancel(id: string): Promise<Reservation> {
      await apiRequest(`/reservations/${id}/cancel`, { method: 'POST' });
      listCache = null;
      return realApi.reservations.get(id);
    },
    async findByCode(code: string): Promise<Reservation> {
      const normalized = code.trim().toUpperCase();
      const data = await apiRequest<BackendReservation[]>('/reservations');
      const match = data.find(
        (item) =>
          item.id === code ||
          deriveReference('RSV', item.id) === normalized ||
          reservationQrTokens.get(item.id)?.toUpperCase() === normalized,
      );
      if (!match) throw new ApiError('NOT_FOUND', 'Reservation not found for this code', 404);
      return mapReservation(match);
    },
  },

  sessions: {
    async list(
      filters: { facilityId?: string; userId?: string; status?: ParkingSession['status'] } = {},
    ): Promise<ParkingSession[]> {
      const data = await fetchGuardSessions();
      const mapped = data.map((item) => mapSession(item));
      return mapped.filter((session) => {
        if (filters.facilityId && session.facilityId !== filters.facilityId) return false;
        if (filters.userId && session.userId !== filters.userId) return false;
        if (filters.status && session.status !== filters.status) return false;
        return true;
      });
    },
    async lookup(query: string): Promise<{
      reservation?: Reservation;
      activeSession?: ParkingSession;
      vehiclePlate: string;
    }> {
      const normalized = normalizePlate(query);
      const sessions = await fetchGuardSessions();
      const match = sessions.find((session) => {
        if (session.id === query) return true;
        const plate = normalizePlate(session.vehicle?.plateNumber ?? '');
        return plate.length > 0 && plate === normalized;
      });
      return {
        activeSession: match ? mapSession(match) : undefined,
        vehiclePlate: match?.vehicle?.plateNumber ?? query,
      };
    },
    async checkIn(input: CheckInInput): Promise<ParkingSession> {
      if (!input.walkIn && input.reservationId) {
        throw new ApiError(
          'NOT_SUPPORTED',
          'POST /api/guard/entry does not accept reservationId or spaceId. Reserved/QR check-in requires a backend change.',
          501,
        );
      }

      const body: Record<string, unknown> = { licensePlate: input.plate };
      if (isUuid(input.facilityId)) body.facilityId = input.facilityId;
      if (input.spaceId) {
        const bundle = await findBundleBySpace(input.spaceId).catch(() => null);
        const zoneId = bundle?.spaces.find((space) => space.id === input.spaceId)?.zoneId;
        if (isUuid(zoneId)) body.zoneId = zoneId;
      }

      const data = await apiRequest<BackendEntryResponse>('/guard/entry', {
        method: 'POST',
        body,
      });

      listCache = null;
      bundles.delete(data.session.facilityId);

      return mapSession(data.session, {
        facilityId: input.facilityId,
        spaceId: data.space?.id ?? input.spaceId,
        spaceCode: data.space?.spaceNumber,
        guardId: input.guardId,
      });
    },
    async checkOut(id: string, input: CheckOutInput): Promise<CheckOutResult> {
      if (input.pay && input.method !== 'CLICK' && input.method !== 'PAYME' && input.method !== 'CASH') {
        throw new ApiError(
          'NOT_SUPPORTED',
          'POST /api/payments accepts only CLICK, PAYME and CASH. UZCARD/HUMO are not supported by the backend.',
          501,
        );
      }

      const sessions = await fetchGuardSessions();
      const target = sessions.find((session) => session.id === id);
      if (!target) throw new ApiError('NOT_FOUND', 'Active parking session not found', 404);

      const data = await apiRequest<BackendExitResponse>('/guard/exit', {
        method: 'POST',
        body: { spaceId: target.spaceId },
      });

      listCache = null;
      bundles.delete(target.facilityId);

      const session = mapSession(data.session ?? target, {
        facilityId: target.facilityId,
        spaceId: target.spaceId,
        spaceCode: target.space?.spaceNumber,
        guardId: input.guardId,
        amountCents: data.finalPriceCents,
      });

      let payment: Payment | undefined;
      if (input.pay && data.finalPriceCents && data.finalPriceCents > 0) {
        const initiated = await apiRequest<BackendInitiatedPayment>('/payments', {
          method: 'POST',
          body: {
            sessionId: id,
            amount: data.finalPriceCents,
            paymentMethod: input.method,
          },
        });
        payment = mapInitiatedPayment(initiated, {
          userId: session.userId ?? '',
          facilityId: session.facilityId,
          sessionId: id,
        });
      }

      return { session, payment };
    },
  },

  payments: {
    async list(filters: { userId?: string; facilityId?: string } = {}): Promise<Payment[]> {
      const data = await apiRequest<BackendPayment[]>('/payments');
      const mapped = data.map((item) => mapPayment(item));
      return mapped.filter((payment) => {
        if (filters.userId && payment.userId !== filters.userId) return false;
        if (filters.facilityId && payment.facilityId !== filters.facilityId) return false;
        return true;
      });
    },
  },

  admin: {
    async users(role?: Role): Promise<User[]> {
      const data = await apiRequest<BackendUser[]>('/users');
      const mapped = data.map((item) => mapUser(item));
      return role ? mapped.filter((user) => user.role === role) : mapped;
    },
  },
};

export function resetRealApiCache() {
  bundles.clear();
  bundleRequests.clear();
  slugIndex.clear();
  floorIndex.clear();
  zoneIndex.clear();
  spaceIndex.clear();
  reservationQrTokens.clear();
  listCache = null;
}
