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
  QrVerification,
  Reservation,
  Role,
  SpaceStatus,
  User,
  Zone,
} from '@/lib/types';
import { ApiError } from './errors';
import { apiRequest } from './client';
import { readSession } from './session-store';

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

interface BackendCoordinates {
  latitude?: number | string | null;
  longitude?: number | string | null;
}

interface BackendPricing {
  hourlyRate?: number | null;
  dailyRate?: number | null;
  currency?: string | null;
}

interface BackendAvailability {
  totalSpaces?: number | null;
  available?: number | null;
  occupied?: number | null;
  reserved?: number | null;
  maintenance?: number | null;
}

interface BackendFacilitySummary {
  id: string;
  name: string;
  description?: string | null;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  coordinates?: BackendCoordinates | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  openingHours?: string | null;
  parkingType?: string | null;
  covered?: boolean | null;
  hourlyRate?: number | null;
  dailyRate?: number | null;
  pricing?: BackendPricing | null;
  totalSpaces?: number | null;
  floorCount?: number | null;
  spaceCount?: number | null;
  status?: string | null;
  availability?: BackendAvailability | null;
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
  pricePerHour?: number | null;
  pricePerDay?: number | null;
  level?: number | null;
  zoneName?: string | null;
  zone?: { id?: string; name?: string; zoneCode?: string; zoneType?: string | null } | null;
  floor?: { id?: string; name?: string; floorName?: string; level?: number } | null;
}

interface BackendZone {
  id: string;
  name?: string | null;
  zoneCode?: string | null;
  zoneType?: string | null;
  covered?: boolean | null;
  status?: string | null;
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
  unzonedSpaces?: BackendSpace[] | null;
}

interface BackendFloorsResponse {
  facilityId: string;
  facilityName?: string;
  floors?: BackendFloor[] | null;
  availability?: BackendAvailability | null;
}

interface BackendFacilityDetail extends BackendFacilitySummary {
  floors?: BackendFloor[] | null;
}

interface BackendCancelResponse {
  id: string;
  status: string;
  canceledAt?: string | null;
}

interface BackendQrVerification {
  valid: boolean;
  purpose: 'entry' | 'exit' | 'reservation';
  parkingSessionId?: string | null;
  sessionStatus?: string | null;
  facilityId?: string | null;
  expiresAt?: string | null;
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
  facilityId?: string | null;
  entryTime: string;
  expectedExit?: string | null;
  actualExitTime?: string | null;
  basePriceCents?: number | null;
  finalPriceCents?: number | null;
  status?: string | null;
  space?: BackendSpace | null;
  vehicle?: { id?: string; plateNumber?: string } | null;
  facility?: { id?: string; name?: string } | null;
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
  space?: { id?: string; spaceNumber?: string; status?: string } | null;
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
  reservationId?: string;
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
const QR_STORAGE_KEY = 'parkovka.reservationQr.v1';

function readStoredQrTokens(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(QR_STORAGE_KEY) ?? 'null');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function persistQrTokens() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      QR_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(reservationQrTokens)),
    );
  } catch {
    // Storage can be blocked or full; the in-memory map still works for this tab.
  }
}

// The backend returns the reservation QR only in the create response, so keep it
// for reloads within the tab instead of rendering an empty QR code.
const reservationQrTokens = new Map<string, string>(Object.entries(readStoredQrTokens()));
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
  return readSession()?.user;
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

function mapOpeningHours(
  value: string | null | undefined,
): Pick<FacilityWithAvailability, 'open24h' | 'openTime' | 'closeTime'> {
  const text = (value ?? '').trim();
  const range = text.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (range) return { open24h: false, openTime: range[1], closeTime: range[2] };
  return { open24h: true, openTime: '00:00', closeTime: '23:59' };
}

function facilityBase(raw: BackendFacilitySummary): FacilityWithAvailability {
  const hours = mapOpeningHours(raw.openingHours);
  return {
    id: raw.id,
    slug: slugify(raw.name, raw.id),
    name: localize(raw.name),
    description: localize(raw.description),
    address: localize(raw.address),
    city: mapCity(raw.city),
    district: localize(raw.address || raw.city),
    lat: toNumber(raw.coordinates?.latitude ?? raw.latitude),
    lng: toNumber(raw.coordinates?.longitude ?? raw.longitude),
    type: 'PUBLIC',
    image: '/images/facility-city.jpg',
    ...hours,
    amenities: raw.covered ? ['covered'] : [],
    rules: [],
    hourlyRate: raw.pricing?.hourlyRate ?? raw.hourlyRate ?? 0,
    dailyCap: raw.pricing?.dailyRate ?? raw.dailyRate ?? 0,
    reservationFee: 0,
    rating: 0,
    reviewCount: 0,
    totalSpaces: raw.totalSpaces ?? raw.spaceCount ?? raw._count?.spaces ?? 0,
    phone: '',
    status: mapFacilityStatus(raw.status),
    availableSpaces: raw.availability?.available ?? 0,
    occupiedSpaces: raw.availability?.occupied ?? 0,
    reservedSpaces: raw.availability?.reserved ?? 0,
  };
}

function mapFacilityDetail(
  detail: BackendFacilityDetail,
  layout: BackendFloorsResponse,
): FacilityBundle {
  const floors: Floor[] = [];
  const zones: Zone[] = [];
  const spaces: ParkingSpace[] = [];

  (layout.floors ?? []).forEach((floorRaw, floorIdx) => {
    const floorId = floorRaw.id;
    const level = floorRaw.level ?? floorIdx + 1;
    const floorName = floorRaw.name || floorRaw.floorName || `P${level}`;
    let floorSpaceCount = 0;
    let rowIdx = 0;

    (floorRaw.zones ?? []).forEach((zoneRaw) => {
      const zoneId = zoneRaw.id;
      const zoneCode = zoneRaw.zoneCode || zoneRaw.name || 'Z';
      zones.push({
        id: zoneId,
        facilityId: detail.id,
        floorId,
        name: zoneRaw.name || zoneCode,
        type: mapZoneType(zoneRaw.zoneType),
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
          y: 52 + rowIdx * 148,
          w: 84,
          h: 92,
          status: mapSpaceStatus(spaceRaw.status),
          type: mapZoneType(spaceRaw.spaceType ?? zoneRaw.zoneType),
          sensor: false,
          updatedAt: new Date().toISOString(),
        });
        floorSpaceCount += 1;
      });
      rowIdx += 1;
    });

    (floorRaw.unzonedSpaces ?? []).forEach((spaceRaw, spaceIdx) => {
      spaces.push({
        id: spaceRaw.id,
        code: spaceRaw.spaceNumber,
        facilityId: detail.id,
        floorId,
        zoneId: '',
        x: 74 + (spaceIdx % 8) * 100,
        y: 52 + (rowIdx + Math.floor(spaceIdx / 8)) * 148,
        w: 84,
        h: 92,
        status: mapSpaceStatus(spaceRaw.status),
        type: mapZoneType(spaceRaw.spaceType),
        sensor: false,
        updatedAt: new Date().toISOString(),
      });
      floorSpaceCount += 1;
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

  const facility = facilityBase(detail);
  if (!detail.totalSpaces && spaces.length > 0) facility.totalSpaces = spaces.length;

  return { facility, floors, zones, spaces };
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
    const [detail, layout] = await Promise.all([
      apiRequest<BackendFacilityDetail>(`/parking/${facilityId}`),
      apiRequest<BackendFloorsResponse>(`/parking/${facilityId}/floors`),
    ]);
    const bundle = mapFacilityDetail(detail, layout);
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
    facilityId: raw.facilityId || raw.facility?.id || fallback.facilityId || '',
    floorId: space?.floorId ?? fallback.floorId ?? '',
    zoneId: space?.zoneId ?? fallback.zoneId ?? '',
    spaceId: raw.spaceId || space?.id || fallback.spaceId || '',
    spaceCode: space?.spaceNumber ?? fallback.spaceCode ?? '',
    userId: raw.userId ?? undefined,
    vehiclePlate: raw.vehicle?.plateNumber ?? fallback.vehiclePlate ?? '',
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

async function fetchGuardSessions(facilityId?: string): Promise<BackendSession[]> {
  const query = facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : '';
  return apiRequest<BackendSession[]>(`/guard/sessions${query}`);
}

function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/\s+/g, ' ').trim();
}

function mapSpaceFromApi(raw: BackendSpace, facilityId: string, index: number): ParkingSpace {
  return {
    id: raw.id,
    code: raw.spaceNumber,
    facilityId: raw.facilityId ?? facilityId,
    floorId: raw.floorId ?? raw.floor?.id ?? '',
    zoneId: raw.zoneId ?? raw.zone?.id ?? '',
    x: 74 + (index % 8) * 100,
    y: 52 + Math.floor(index / 8) * 148,
    w: 84,
    h: 92,
    status: mapSpaceStatus(raw.status),
    type: mapZoneType(raw.spaceType ?? raw.zone?.zoneType),
    sensor: false,
    updatedAt: new Date().toISOString(),
  };
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
    async logout(refreshToken?: string): Promise<void> {
      const token = readSession()?.refreshToken ?? refreshToken;
      await apiRequest<null>('/auth/logout', {
        method: 'POST',
        body: token ? { refreshToken: token } : {},
        skipRefresh: true,
      });
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
      return applyFilters(items.map(facilityBase), params);
    },
    async map(params: {
      city?: string;
      parkingType?: string;
      bounds?: { north: number; south: number; east: number; west: number };
      limit?: number;
    } = {}): Promise<FacilityWithAvailability[]> {
      const query = new URLSearchParams();
      if (params.city) query.set('city', params.city);
      if (params.parkingType) query.set('parkingType', params.parkingType);
      if (params.bounds) {
        query.set('north', String(params.bounds.north));
        query.set('south', String(params.bounds.south));
        query.set('east', String(params.bounds.east));
        query.set('west', String(params.bounds.west));
      }
      if (params.limit) query.set('limit', String(params.limit));
      const suffix = query.toString() ? `?${query.toString()}` : '';
      const data = await apiRequest<BackendFacilitySummary[]>(`/parking/map${suffix}`);
      return data.map(facilityBase);
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
      let facilityId = filters.facilityId;
      if (!facilityId && (filters.floorId || filters.zoneId)) {
        let bundle = filters.floorId
          ? await findBundleByFloor(filters.floorId)
          : await findBundleByZone(filters.zoneId as string);
        if (!bundle) {
          await ensureAllBundles();
          bundle = filters.floorId
            ? await findBundleByFloor(filters.floorId)
            : await findBundleByZone(filters.zoneId as string);
        }
        facilityId = bundle?.facility.id;
      }
      if (!facilityId) return [];

      const query = new URLSearchParams();
      if (filters.status) query.set('status', filters.status);
      if (filters.floorId) query.set('floorId', filters.floorId);
      if (filters.zoneId) query.set('zoneId', filters.zoneId);
      query.set('limit', '500');

      const data = await apiRequest<BackendSpace[]>(
        `/parking/${facilityId}/spaces?${query.toString()}`,
      );
      const bundle = await getBundle(facilityId).catch(() => null);
      const positions = new Map((bundle?.spaces ?? []).map((space) => [space.id, space]));

      return data.map((raw, index) => {
        const status = mapSpaceStatus(raw.status);
        const cached = positions.get(raw.id);
        if (cached) {
          cached.status = status;
          cached.updatedAt = new Date().toISOString();
          return cached;
        }
        return mapSpaceFromApi(raw, facilityId as string, index);
      });
    },
    async availability(spaceId: string): Promise<{ available: boolean }> {
      let bundle = await findBundleBySpace(spaceId);
      if (!bundle) {
        await ensureAllBundles();
        bundle = await findBundleBySpace(spaceId);
      }
      if (!bundle) throw new ApiError('NOT_FOUND', 'Parking space not found', 404);

      const data = await apiRequest<{ available?: number; spaces?: BackendSpace[] }>(
        `/parking/${bundle.facility.id}/availability`,
      );
      const raw = (data.spaces ?? []).find((space) => space.id === spaceId);
      const cachedSpace = bundle.spaces.find((space) => space.id === spaceId);
      if (cachedSpace && raw) {
        cachedSpace.status = mapSpaceStatus(raw.status);
        cachedSpace.updatedAt = new Date().toISOString();
      }
      return { available: raw?.status === 'AVAILABLE' };
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
        vehicleId?: string;
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
      if (input.vehicleId && isUuid(input.vehicleId)) body.vehicleId = input.vehicleId;

      const data = await apiRequest<BackendReservationResponse>('/reservations', {
        method: 'POST',
        body,
      });
      if (data.qrToken) {
        reservationQrTokens.set(data.reservation.id, data.qrToken);
        persistQrTokens();
      }

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
      await apiRequest<BackendCancelResponse>(`/reservations/${id}/cancel`, { method: 'POST' });
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
      const data = await fetchGuardSessions(filters.facilityId);
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
    async verifyQr(qrToken: string): Promise<QrVerification> {
      const data = await apiRequest<BackendQrVerification>('/guard/verify-qr', {
        method: 'POST',
        body: { qrToken: qrToken.trim() },
      });
      return {
        valid: data.valid,
        purpose: data.purpose,
        parkingSessionId: data.parkingSessionId ?? undefined,
        sessionStatus: (data.sessionStatus as QrVerification['sessionStatus']) ?? undefined,
        facilityId: data.facilityId ?? undefined,
        expiresAt: data.expiresAt ?? '',
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

      const body: Record<string, unknown> = { licensePlate: normalizePlate(input.plate) };
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
      if (data.session.facilityId) bundles.delete(data.session.facilityId);

      return mapSession(data.session, {
        facilityId: input.facilityId,
        spaceId: data.space?.id ?? input.spaceId,
        spaceCode: data.space?.spaceNumber,
        vehiclePlate: input.plate,
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

      let target: BackendSession | undefined;
      let body: Record<string, unknown>;
      if (input.qrToken) {
        body = { qrToken: input.qrToken.trim() };
      } else if (input.plate) {
        body = { licensePlate: normalizePlate(input.plate) };
      } else {
        const sessions = await fetchGuardSessions();
        target = sessions.find((session) => session.id === id);
        if (!target) throw new ApiError('NOT_FOUND', 'Active parking session not found', 404);
        body = { spaceId: target.spaceId };
      }

      const data = await apiRequest<BackendExitResponse>('/guard/exit', {
        method: 'POST',
        body,
      });

      const sessionId = data.session.id || id;
      const facilityId =
        data.session.facilityId || data.session.facility?.id || target?.facilityId || '';
      listCache = null;
      if (facilityId) bundles.delete(facilityId);

      const session = mapSession(
        { ...data.session, id: sessionId },
        {
          facilityId,
          spaceId: data.space?.id ?? data.session.spaceId ?? target?.spaceId,
          spaceCode: data.space?.spaceNumber ?? target?.space?.spaceNumber,
          vehiclePlate: input.plate,
          guardId: input.guardId,
          amountCents: data.finalPriceCents,
        },
      );

      let payment: Payment | undefined;
      if (input.pay && data.finalPriceCents && data.finalPriceCents > 0) {
        const initiated = await apiRequest<BackendInitiatedPayment>('/payments', {
          method: 'POST',
          body: {
            sessionId,
            amount: data.finalPriceCents,
            paymentMethod: input.method,
          },
        });
        payment = mapInitiatedPayment(initiated, {
          userId: session.userId ?? '',
          facilityId: session.facilityId,
          sessionId,
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
    async create(input: {
      reservationId?: string;
      sessionId?: string;
      amount?: number;
      paymentMethod: PaymentMethod;
      description?: string;
    }): Promise<Payment> {
      if (input.paymentMethod !== 'CLICK' && input.paymentMethod !== 'PAYME' && input.paymentMethod !== 'CASH') {
        throw new ApiError(
          'NOT_SUPPORTED',
          'POST /api/payments accepts only CLICK, PAYME and CASH.',
          501,
        );
      }
      const body: Record<string, unknown> = { paymentMethod: input.paymentMethod };
      if (input.reservationId) body.reservationId = input.reservationId;
      if (input.sessionId) body.sessionId = input.sessionId;
      if (typeof input.amount === 'number' && input.amount > 0) body.amount = input.amount;
      if (input.description) body.description = input.description;

      const initiated = await apiRequest<BackendInitiatedPayment>('/payments', {
        method: 'POST',
        body,
      });
      return {
        id: initiated.paymentId,
        reference: deriveReference('PAY', initiated.paymentId),
        userId: readSession()?.user.id ?? '',
        reservationId: input.reservationId,
        sessionId: input.sessionId,
        facilityId: '',
        amount: centsToAmount(initiated.amount),
        method: mapPaymentMethod(initiated.paymentMethod),
        status: mapPaymentState(initiated.status),
        createdAt: new Date().toISOString(),
      };
    },
  },

  admin: {
    async users(role?: Role): Promise<User[]> {
      const data = await apiRequest<BackendUser[]>('/users');
      const mapped = data.map((item) => mapUser(item));
      return role ? mapped.filter((user) => user.role === role) : mapped;
    },
    async createUser(input: {
      name: string;
      email: string;
      password: string;
      role: Role;
      phone?: string;
      licensePlate?: string;
    }): Promise<User> {
      const body: Record<string, unknown> = {
        name: input.name,
        email: input.email,
        password: input.password,
        role: input.role,
      };
      if (input.phone) body.phone = input.phone;
      if (input.licensePlate) body.licensePlate = input.licensePlate;

      const data = await apiRequest<{ user: BackendUser }>('/users', {
        method: 'POST',
        body,
      });
      return mapUser(data.user);
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
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(QR_STORAGE_KEY);
    } catch {
      // Ignore storage access errors.
    }
  }
  listCache = null;
}
