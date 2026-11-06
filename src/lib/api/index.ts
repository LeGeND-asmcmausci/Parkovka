import type {
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
  ParkingSession,
  ParkingSpace,
  Payment,
  PricingRule,
  QrVerification,
  Reservation,
  Review,
  Role,
  SpaceStatus,
  User,
  Vehicle,
  Zone,
  AppNotification,
  AuditLog,
} from '@/lib/types';
import { USE_FIXTURES } from './client';
import { mockDashboardStats, mockGuardSummary, resetFixtures } from './store';
import * as mock from './store';
import type { SystemSettings } from './fixtures';
import { notSupported, realApi, resetRealApiCache } from './real';

function choose<T>(mockCall: () => Promise<T>, realCall: () => Promise<T>) {
  return USE_FIXTURES ? mockCall() : realCall();
}

const NO_ADMIN_CRUD =
  'The backend exposes only public GET /api/parking routes; there are no admin facility, floor, zone or space routes.';
const NO_VEHICLES = 'The backend has no /api/vehicles routes yet.';
const NO_REVIEWS = 'The backend has no /api/reviews routes yet.';
const NO_NOTIFICATIONS = 'The backend has no /api/notifications routes yet.';
const NO_ADMIN_DATA =
  'The backend contract does not expose this admin resource. Do not add a frontend-only substitute.';

export const api = {
  auth: {
    login: (email: string, password: string): Promise<AuthSession> =>
      choose(
        () => mock.mockLogin(email, password),
        () => realApi.auth.login(email, password),
      ),
    register: (input: {
      fullName: string;
      email: string;
      phone: string;
      password: string;
    }): Promise<AuthSession> =>
      choose(
        () => mock.mockRegister(input),
        () => realApi.auth.register(input),
      ),
    me: (token: string): Promise<User> =>
      choose(
        () => mock.mockMe(token),
        () => realApi.auth.me(token),
      ),
    logout: (refreshToken?: string): Promise<void> =>
      choose(
        async () => undefined,
        () => realApi.auth.logout(refreshToken),
      ),
  },
  profile: {
    update: (userId: string, patch: Partial<Pick<User, 'fullName' | 'phone' | 'email'>>) =>
      choose(
        () => mock.mockUpdateProfile(userId, patch),
        () => realApi.profile.update(userId, patch),
      ),
  },
  facilities: {
    list: (params: FacilitySearchParams = {}): Promise<FacilityWithAvailability[]> =>
      choose(
        () => mock.mockFacilities(params),
        () => realApi.facilities.list(params),
      ),
    map: (params: {
      city?: string;
      parkingType?: string;
      bounds?: { north: number; south: number; east: number; west: number };
      limit?: number;
    } = {}): Promise<FacilityWithAvailability[]> =>
      choose(
        () => mock.mockFacilities({ city: params.city }),
        () => realApi.facilities.map(params),
      ),
    get: (idOrSlug: string): Promise<FacilityWithAvailability> =>
      choose(
        () => mock.mockFacility(idOrSlug),
        () => realApi.facilities.get(idOrSlug),
      ),
    floors: (facilityId: string): Promise<Floor[]> =>
      choose(
        () => mock.mockFloors(facilityId),
        () => realApi.facilities.floors(facilityId),
      ),
    zones: (floorId: string): Promise<Zone[]> =>
      choose(
        () => mock.mockZones(floorId),
        () => realApi.facilities.zones(floorId),
      ),
    spaces: (filters: {
      facilityId?: string;
      floorId?: string;
      zoneId?: string;
      status?: SpaceStatus;
    } = {}): Promise<ParkingSpace[]> =>
      choose(
        () => mock.mockSpaces(filters),
        () => realApi.facilities.spaces(filters),
      ),
    availability: (spaceId: string): Promise<{ available: boolean }> =>
      choose(
        () => mock.mockSpaceAvailability(spaceId),
        () => realApi.facilities.availability(spaceId),
      ),
    create: (input: CreateFacilityInput): Promise<Facility> =>
      choose(
        () => mock.mockCreateFacility(input),
        () => notSupported('Creating a facility', NO_ADMIN_CRUD),
      ),
    update: (id: string, patch: Partial<Facility>): Promise<Facility> =>
      choose(
        () => mock.mockUpdateFacility(id, patch),
        () => notSupported('Updating a facility', NO_ADMIN_CRUD),
      ),
    remove: (id: string): Promise<void> =>
      choose(
        () => mock.mockDeleteFacility(id),
        () => notSupported('Deleting a facility', NO_ADMIN_CRUD),
      ),
    addFloor: (facilityId: string): Promise<Floor> =>
      choose(
        () => mock.mockAddFloor(facilityId),
        () => notSupported('Adding a floor', NO_ADMIN_CRUD),
      ),
    addZone: (floorId: string): Promise<Zone> =>
      choose(
        () => mock.mockAddZone(floorId),
        () => notSupported('Adding a zone', NO_ADMIN_CRUD),
      ),
    addSpace: (zoneId: string): Promise<ParkingSpace> =>
      choose(
        () => mock.mockAddSpace(zoneId),
        () => notSupported('Adding a space', NO_ADMIN_CRUD),
      ),
    setSpaceStatus: (spaceId: string, status: SpaceStatus): Promise<ParkingSpace> =>
      choose(
        () => mock.mockUpdateSpaceStatus(spaceId, status),
        () => notSupported('Changing a space status', NO_ADMIN_CRUD),
      ),
  },
  reservations: {
    list: (filters: { userId?: string; facilityId?: string } = {}): Promise<Reservation[]> =>
      choose(
        () => mock.mockReservations(filters),
        () => realApi.reservations.list(filters),
      ),
    get: (id: string): Promise<Reservation> =>
      choose(
        () => mock.mockReservation(id),
        () => realApi.reservations.get(id),
      ),
    create: (
      input: {
        facilityId: string;
        floorId: string;
        zoneId: string;
        spaceId: string;
        startsAt: string;
        endsAt: string;
        vehicleId: string;
        paymentMethod: 'PAYME' | 'CLICK' | 'UZCARD' | 'HUMO' | 'CASH';
      },
      userId: string,
    ): Promise<Reservation> =>
      choose(
        () => mock.mockCreateReservation(input, userId),
        () => realApi.reservations.create(input, userId),
      ),
    cancel: (id: string, userId: string): Promise<Reservation> =>
      choose(
        () => mock.mockCancelReservation(id, userId),
        () => realApi.reservations.cancel(id),
      ),
    findByCode: (code: string): Promise<Reservation> =>
      choose(
        () => mock.mockFindReservationByCode(code),
        () => realApi.reservations.findByCode(code),
      ),
  },
  vehicles: {
    list: (userId: string): Promise<Vehicle[]> =>
      choose(
        () => mock.mockVehicles(userId),
        () => notSupported('Listing vehicles', NO_VEHICLES),
      ),
    create: (userId: string, input: Omit<Vehicle, 'id' | 'userId' | 'isDefault'>) =>
      choose(
        () => mock.mockCreateVehicle(userId, input),
        () => notSupported('Adding a vehicle', NO_VEHICLES),
      ),
    update: (userId: string, id: string, patch: Partial<Vehicle>) =>
      choose(
        () => mock.mockUpdateVehicle(userId, id, patch),
        () => notSupported('Updating a vehicle', NO_VEHICLES),
      ),
    remove: (userId: string, id: string) =>
      choose(
        () => mock.mockDeleteVehicle(userId, id),
        () => notSupported('Deleting a vehicle', NO_VEHICLES),
      ),
  },
  sessions: {
    list: (filters: { facilityId?: string; userId?: string; status?: ParkingSession['status'] } = {}) =>
      choose(
        () => mock.mockSessions(filters),
        () => realApi.sessions.list(filters),
      ),
    lookup: (query: string) =>
      choose(
        () => mock.mockLookupEntry(query),
        () => realApi.sessions.lookup(query),
      ),
    verifyQr: (qrToken: string): Promise<QrVerification> =>
      choose(
        () => mock.mockVerifyQr(qrToken),
        () => realApi.sessions.verifyQr(qrToken),
      ),
    checkIn: (input: CheckInInput): Promise<ParkingSession> =>
      choose(
        () => mock.mockCheckIn(input),
        () => realApi.sessions.checkIn(input),
      ),
    checkOut: (id: string, input: CheckOutInput): Promise<CheckOutResult> =>
      choose(
        () => mock.mockCheckOut(id, input),
        () => realApi.sessions.checkOut(id, input),
      ),
  },
  payments: {
    list: (filters: { userId?: string; facilityId?: string } = {}): Promise<Payment[]> =>
      choose(
        () => mock.mockPayments(filters),
        () => realApi.payments.list(filters),
      ),
    create: (input: {
      reservationId?: string;
      sessionId?: string;
      amount?: number;
      paymentMethod: 'PAYME' | 'CLICK' | 'UZCARD' | 'HUMO' | 'CASH';
      description?: string;
    }): Promise<Payment> =>
      choose(
        () => mock.mockCreatePayment(input),
        () => realApi.payments.create(input),
      ),
  },
  reviews: {
    list: (facilityId: string): Promise<Review[]> =>
      choose(
        () => mock.mockReviews(facilityId),
        () => notSupported('Listing reviews', NO_REVIEWS),
      ),
    mine: (userId: string): Promise<Review[]> =>
      choose(
        () => mock.mockUserReviews(userId),
        () => notSupported('Listing your reviews', NO_REVIEWS),
      ),
    create: (input: {
      facilityId: string;
      userId: string;
      userName: string;
      rating: number;
      comment: string;
    }): Promise<Review> =>
      choose(
        () => mock.mockCreateReview(input),
        () => notSupported('Creating a review', NO_REVIEWS),
      ),
  },
  notifications: {
    list: (userId?: string, role?: Role): Promise<AppNotification[]> =>
      choose(
        () => mock.mockNotifications(userId, role),
        () => notSupported('Listing notifications', NO_NOTIFICATIONS),
      ),
    markRead: (id: string): Promise<void> =>
      choose(
        () => mock.mockMarkNotificationRead(id),
        () => notSupported('Marking a notification as read', NO_NOTIFICATIONS),
      ),
    markAllRead: (userId?: string, role?: Role): Promise<void> =>
      choose(
        () => mock.mockMarkAllNotificationsRead(userId, role),
        () => notSupported('Marking all notifications as read', NO_NOTIFICATIONS),
      ),
  },
  admin: {
    stats: (facilityId?: string, days = 7): Promise<DashboardStats> =>
      choose(
        () => mockDashboardStats(facilityId, days),
        () => notSupported('Admin dashboard statistics', NO_ADMIN_DATA),
      ),
    users: (role?: Role): Promise<User[]> =>
      choose(
        () => mock.mockUsers(role),
        () => realApi.admin.users(role),
      ),
    createUser: (input: {
      fullName: string;
      email: string;
      phone: string;
      role: Role;
      facilityIds?: string[];
      password?: string;
    }): Promise<User> =>
      choose(
        () => mock.mockCreateUser(input),
        () =>
          realApi.admin.createUser({
            name: input.fullName,
            email: input.email,
            password: input.password ?? '',
            role: input.role,
            phone: input.phone || undefined,
          }),
      ),
    updateUser: (id: string, patch: Partial<User>): Promise<User> =>
      choose(
        () => mock.mockUpdateUser(id, patch),
        () => notSupported('Updating a user', 'The backend exposes only GET /api/users.'),
      ),
    cameras: (facilityId?: string): Promise<Camera[]> =>
      choose(
        () => mock.mockCameras(facilityId),
        () => notSupported('Listing cameras', NO_ADMIN_DATA),
      ),
    toggleCamera: (id: string): Promise<Camera> =>
      choose(
        () => mock.mockToggleCamera(id),
        () => notSupported('Toggling a camera', NO_ADMIN_DATA),
      ),
    incidents: (facilityId?: string): Promise<Incident[]> =>
      choose(
        () => mock.mockIncidents(facilityId),
        () => notSupported('Listing incidents', NO_ADMIN_DATA),
      ),
    createIncident: (input: {
      facilityId: string;
      type: Incident['type'];
      severity: Incident['severity'];
      description: string;
      plate?: string;
      reportedBy: string;
    }): Promise<Incident> =>
      choose(
        () => mock.mockCreateIncident(input),
        () => notSupported('Creating an incident', NO_ADMIN_DATA),
      ),
    resolveIncident: (id: string): Promise<Incident> =>
      choose(
        () => mock.mockResolveIncident(id),
        () => notSupported('Resolving an incident', NO_ADMIN_DATA),
      ),
    pricing: (): Promise<PricingRule[]> =>
      choose(
        () => mock.mockPricingRules(),
        () => notSupported('Listing pricing rules', NO_ADMIN_DATA),
      ),
    updatePricing: (id: string, patch: Partial<PricingRule>): Promise<PricingRule> =>
      choose(
        () => mock.mockUpdatePricingRule(id, patch),
        () => notSupported('Updating a pricing rule', NO_ADMIN_DATA),
      ),
    auditLogs: (): Promise<AuditLog[]> =>
      choose(
        () => mock.mockAuditLogs(),
        () => notSupported('Listing audit logs', NO_ADMIN_DATA),
      ),
    settings: (): Promise<SystemSettings> =>
      choose(
        () => mock.mockSettings(),
        () => notSupported('Loading system settings', NO_ADMIN_DATA),
      ),
    updateSettings: (patch: Partial<SystemSettings>): Promise<SystemSettings> =>
      choose(
        () => mock.mockUpdateSettings(patch),
        () => notSupported('Updating system settings', NO_ADMIN_DATA),
      ),
  },
  guard: {
    summary: (facilityIds?: string[]) =>
      choose(
        () => mockGuardSummary(facilityIds),
        () =>
          notSupported(
            'Guard shift summary',
            'The backend exposes only GET /api/guard/sessions; today counts, revenue and incidents cannot be derived from it.',
          ),
      ),
  },
};

export function resetDemoData() {
  resetFixtures();
  resetRealApiCache();
}

export { USE_FIXTURES };
