export type Language = 'uz' | 'ru' | 'en';

export type Theme = 'light' | 'dark';

export type Role = 'USER' | 'GUARD' | 'ADMIN';

export interface LocalizedText {
  uz: string;
  ru: string;
  en: string;
}

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  status: UserStatus;
  facilityIds?: string[];
  createdAt: string;
  notes?: string;
}

export type FacilityType = 'MALL' | 'BUSINESS' | 'AIRPORT' | 'HOTEL' | 'PUBLIC';

export type AmenityKey =
  | 'cctv'
  | 'ev'
  | 'covered'
  | 'security'
  | 'elevator'
  | 'carWash'
  | 'wifi'
  | 'accessible';

export interface Facility {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  address: LocalizedText;
  city: 'tashkent' | 'samarkand' | 'bukhara';
  district: LocalizedText;
  lat: number;
  lng: number;
  type: FacilityType;
  image: string;
  open24h: boolean;
  openTime: string;
  closeTime: string;
  amenities: AmenityKey[];
  rules: LocalizedText[];
  hourlyRate: number;
  dailyCap: number;
  reservationFee: number;
  rating: number;
  reviewCount: number;
  totalSpaces: number;
  phone: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'CLOSED';
}

export interface Floor {
  id: string;
  facilityId: string;
  name: string;
  level: number;
  totalSpaces: number;
  status: 'ACTIVE' | 'MAINTENANCE';
}

export type ZoneType = 'STANDARD' | 'EV' | 'VIP' | 'ACCESSIBLE';

export interface Zone {
  id: string;
  facilityId: string;
  floorId: string;
  name: string;
  type: ZoneType;
  rateMultiplier: number;
}

export type SpaceStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BLOCKED' | 'MAINTENANCE';

export interface ParkingSpace {
  id: string;
  code: string;
  facilityId: string;
  floorId: string;
  zoneId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  status: SpaceStatus;
  type: ZoneType;
  sensor: boolean;
  updatedAt: string;
}

export type ReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'NO_SHOW';

export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';

export interface Reservation {
  id: string;
  reference: string;
  userId: string;
  facilityId: string;
  floorId: string;
  zoneId: string;
  spaceId: string;
  spaceCode: string;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  vehicleId: string;
  vehiclePlate: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  qrToken: string;
  createdAt: string;
}

export type PaymentMethod = 'PAYME' | 'CLICK' | 'UZCARD' | 'HUMO' | 'CASH';
export type PaymentState = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface Payment {
  id: string;
  reference: string;
  userId: string;
  reservationId?: string;
  sessionId?: string;
  facilityId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentState;
  createdAt: string;
  paidAt?: string;
}

export type SessionStatus = 'ACTIVE' | 'COMPLETED';

export interface ParkingSession {
  id: string;
  reference: string;
  facilityId: string;
  floorId: string;
  zoneId: string;
  spaceId: string;
  spaceCode: string;
  userId?: string;
  vehiclePlate: string;
  entryAt: string;
  exitAt?: string;
  status: SessionStatus;
  amount: number;
  paid: boolean;
  reservationId?: string;
  entryGuardId?: string;
  exitGuardId?: string;
}

export interface Vehicle {
  id: string;
  userId: string;
  plate: string;
  make: string;
  model: string;
  color: string;
  year: number;
  isDefault: boolean;
}

export interface Review {
  id: string;
  facilityId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
  reply?: string;
}

export type NotificationKind = 'RESERVATION' | 'PAYMENT' | 'SYSTEM' | 'INCIDENT' | 'ENTRY' | 'EXIT';

export interface AppNotification {
  id: string;
  userId?: string;
  role?: Role;
  title: LocalizedText;
  body: LocalizedText;
  kind: NotificationKind;
  read: boolean;
  createdAt: string;
  href?: string;
}

export type CameraStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED';

export interface Camera {
  id: string;
  facilityId: string;
  name: string;
  type: 'ENTRY' | 'EXIT' | 'SPACE';
  zoneId?: string;
  status: CameraStatus;
  lastSeen: string;
  resolution: string;
}

export interface Incident {
  id: string;
  facilityId: string;
  type: 'DAMAGE' | 'THEFT' | 'BLOCKING' | 'EQUIPMENT' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  plate?: string;
  reportedBy: string;
  createdAt: string;
  status: 'OPEN' | 'RESOLVED';
}

export interface AuditLog {
  id: string;
  actor: string;
  actorRole: Role;
  action: string;
  entity: string;
  entityId: string;
  at: string;
  ip: string;
}

export interface PricingRule {
  id: string;
  facilityId: string;
  name: LocalizedText;
  type: 'HOURLY' | 'DAILY' | 'NIGHT' | 'EVENT';
  rate: number;
  startTime?: string;
  endTime?: string;
  active: boolean;
}

export interface DashboardStats {
  totalSpaces: number;
  available: number;
  occupied: number;
  reserved: number;
  blocked: number;
  maintenance: number;
  activeSessions: number;
  todayReservations: number;
  todayRevenue: number;
  occupancyRate: number;
  revenueSeries: { date: string; revenue: number; bookings: number }[];
  occupancySeries: { hour: string; occupancy: number }[];
  paymentDistribution: { method: PaymentMethod; amount: number }[];
  facilityPerformance: {
    facilityId: string;
    name: LocalizedText;
    occupancy: number;
    revenue: number;
    reservations: number;
  }[];
}

export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface FacilityWithAvailability extends Facility {
  availableSpaces: number;
  occupiedSpaces: number;
  reservedSpaces: number;
}

export interface FacilitySearchParams {
  query?: string;
  city?: string;
  availability?: 'all' | 'available';
  type?: FacilityType | 'ALL';
  maxPrice?: number;
  sort?: 'recommended' | 'price-asc' | 'price-desc' | 'rating' | 'availability';
}

export interface CreateFacilityInput {
  name: LocalizedText;
  description: LocalizedText;
  address: LocalizedText;
  city: Facility['city'];
  district: LocalizedText;
  type: FacilityType;
  hourlyRate: number;
  dailyCap: number;
  capacity: number;
  image?: string;
}

export interface CheckInInput {
  facilityId: string;
  plate: string;
  reservationId?: string;
  spaceId?: string;
  guardId?: string;
  walkIn?: boolean;
}

export interface CheckOutInput {
  pay: boolean;
  method: PaymentMethod;
  guardId?: string;
}

export interface CheckOutResult {
  session: ParkingSession;
  payment?: Payment;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BookingDraft {
  facilityId: string;
  floorId: string;
  zoneId: string;
  spaceId: string;
  spaceCode: string;
  startsAt: string;
  endsAt: string;
  vehicleId: string;
}

export interface CreateReservationInput extends BookingDraft {
  paymentMethod: PaymentMethod;
}
