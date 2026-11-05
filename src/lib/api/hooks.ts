import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import type {
  CheckInInput,
  CheckOutInput,
  CreateFacilityInput,
  Facility,
  FacilitySearchParams,
  Incident,
  ParkingSession,
  ParkingSpace,
  PricingRule,
  Reservation,
  Review,
  Role,
  SpaceStatus,
  User,
  Vehicle,
} from '@/lib/types';
import type { SystemSettings } from './fixtures';
import { api } from './index';

export const queryKeys = {
  facilities: (params?: FacilitySearchParams) => ['facilities', params ?? {}] as const,
  facility: (id: string) => ['facility', id] as const,
  floors: (facilityId: string) => ['floors', facilityId] as const,
  zones: (floorId: string) => ['zones', floorId] as const,
  spaces: (filters: Record<string, unknown>) => ['spaces', filters] as const,
  reservations: (filters: Record<string, unknown>) => ['reservations', filters] as const,
  reservation: (id: string) => ['reservation', id] as const,
  vehicles: (userId: string) => ['vehicles', userId] as const,
  sessions: (filters: Record<string, unknown>) => ['sessions', filters] as const,
  payments: (filters: Record<string, unknown>) => ['payments', filters] as const,
  reviews: (facilityId: string) => ['reviews', facilityId] as const,
  myReviews: (userId: string) => ['reviews', 'mine', userId] as const,
  notifications: (audience: string) => ['notifications', audience] as const,
  stats: (facilityId: string | undefined, days: number) =>
    ['admin-stats', facilityId ?? 'all', days] as const,
  users: (role?: Role) => ['admin-users', role ?? 'all'] as const,
  cameras: (facilityId?: string) => ['cameras', facilityId ?? 'all'] as const,
  incidents: (facilityId?: string) => ['incidents', facilityId ?? 'all'] as const,
  pricing: () => ['pricing'] as const,
  audit: () => ['audit-logs'] as const,
  settings: () => ['system-settings'] as const,
  guardSummary: (facilityIds?: string[]) => ['guard-summary', facilityIds ?? []] as const,
};

function invalidate(queryClient: QueryClient, prefixes: string[]) {
  prefixes.forEach((prefix) => {
    void queryClient.invalidateQueries({ queryKey: [prefix] });
  });
}

const ALL_DATA = [
  'facilities',
  'facility',
  'floors',
  'zones',
  'spaces',
  'reservations',
  'reservation',
  'sessions',
  'payments',
  'admin-stats',
  'guard-summary',
  'notifications',
  'admin-users',
  'cameras',
  'incidents',
  'pricing',
  'audit-logs',
  'vehicles',
];

export function useFacilities(params: FacilitySearchParams = {}) {
  return useQuery({
    queryKey: queryKeys.facilities(params),
    queryFn: () => api.facilities.list(params),
    staleTime: 20_000,
  });
}

export function useFacility(idOrSlug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.facility(idOrSlug ?? ''),
    queryFn: () => api.facilities.get(idOrSlug as string),
    enabled: Boolean(idOrSlug),
  });
}

export function useFloors(facilityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.floors(facilityId ?? ''),
    queryFn: () => api.facilities.floors(facilityId as string),
    enabled: Boolean(facilityId),
  });
}

export function useZones(floorId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.zones(floorId ?? ''),
    queryFn: () => api.facilities.zones(floorId as string),
    enabled: Boolean(floorId),
  });
}

export function useSpaces(
  filters: { facilityId?: string; floorId?: string; zoneId?: string; status?: SpaceStatus },
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.spaces(filters),
    queryFn: () => api.facilities.spaces(filters),
    enabled: enabled && Boolean(filters.facilityId || filters.floorId || filters.zoneId),
  });
}

export function useReservation(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reservation(id ?? ''),
    queryFn: () => api.reservations.get(id as string),
    enabled: Boolean(id),
  });
}

export function useMyReservations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.reservations({ userId: user?.id }),
    queryFn: () => api.reservations.list({ userId: user?.id }),
    enabled: Boolean(user),
  });
}

export function useAllReservations(facilityId?: string) {
  return useQuery({
    queryKey: queryKeys.reservations({ facilityId, all: true }),
    queryFn: () => api.reservations.list({ facilityId }),
  });
}

export function useVehicles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.vehicles(user?.id ?? ''),
    queryFn: () => api.vehicles.list(user?.id as string),
    enabled: Boolean(user),
  });
}

export function useSessions(filters: {
  facilityId?: string;
  userId?: string;
  status?: ParkingSession['status'];
} = {}) {
  return useQuery({
    queryKey: queryKeys.sessions(filters),
    queryFn: () => api.sessions.list(filters),
  });
}

export function useMyPayments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.payments({ userId: user?.id }),
    queryFn: () => api.payments.list({ userId: user?.id }),
    enabled: Boolean(user),
  });
}

export function useAllPayments(facilityId?: string) {
  return useQuery({
    queryKey: queryKeys.payments({ facilityId, all: true }),
    queryFn: () => api.payments.list({ facilityId }),
  });
}

export function useFacilityReviews(facilityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reviews(facilityId ?? ''),
    queryFn: () => api.reviews.list(facilityId as string),
    enabled: Boolean(facilityId),
  });
}

export function useMyReviews() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.myReviews(user?.id ?? ''),
    queryFn: () => api.reviews.mine(user?.id as string),
    enabled: Boolean(user),
  });
}

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.notifications(user ? user.id : 'anonymous'),
    queryFn: () => api.notifications.list(user?.id, user?.role),
    enabled: Boolean(user),
  });
}

export function useAdminStats(facilityId?: string, days = 7) {
  return useQuery({
    queryKey: queryKeys.stats(facilityId, days),
    queryFn: () => api.admin.stats(facilityId, days),
  });
}

export function useAdminUsers(role?: Role) {
  return useQuery({
    queryKey: queryKeys.users(role),
    queryFn: () => api.admin.users(role),
  });
}

export function useCameras(facilityId?: string) {
  return useQuery({
    queryKey: queryKeys.cameras(facilityId),
    queryFn: () => api.admin.cameras(facilityId),
  });
}

export function useIncidents(facilityId?: string) {
  return useQuery({
    queryKey: queryKeys.incidents(facilityId),
    queryFn: () => api.admin.incidents(facilityId),
  });
}

export function usePricing() {
  return useQuery({ queryKey: queryKeys.pricing(), queryFn: () => api.admin.pricing() });
}

export function useAuditLogs() {
  return useQuery({ queryKey: queryKeys.audit(), queryFn: () => api.admin.auditLogs() });
}

export function useSystemSettings() {
  return useQuery({ queryKey: queryKeys.settings(), queryFn: () => api.admin.settings() });
}

export function useGuardSummary(facilityIds?: string[]) {
  return useQuery({
    queryKey: queryKeys.guardSummary(facilityIds),
    queryFn: () => api.guard.summary(facilityIds),
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: {
      facilityId: string;
      floorId: string;
      zoneId: string;
      spaceId: string;
      startsAt: string;
      endsAt: string;
      vehicleId: string;
      paymentMethod: 'PAYME' | 'CLICK' | 'UZCARD' | 'HUMO' | 'CASH';
    }) => api.reservations.create(input, user?.id as string),
    onSuccess: () => invalidate(queryClient, ALL_DATA),
  });
}

export function useCancelReservation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (id: string) => api.reservations.cancel(id, user?.id as string),
    onSuccess: () => invalidate(queryClient, ALL_DATA),
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: Omit<Vehicle, 'id' | 'userId' | 'isDefault'>) =>
      api.vehicles.create(user?.id as string, input),
    onSuccess: () => invalidate(queryClient, ['vehicles']),
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Vehicle> }) =>
      api.vehicles.update(user?.id as string, id, patch),
    onSuccess: () => invalidate(queryClient, ['vehicles']),
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (id: string) => api.vehicles.remove(user?.id as string, id),
    onSuccess: () => invalidate(queryClient, ['vehicles']),
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      facilityId: string;
      userId: string;
      userName: string;
      rating: number;
      comment: string;
    }) => api.reviews.create(input),
    onSuccess: () => invalidate(queryClient, ['reviews', 'facilities', 'facility']),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => invalidate(queryClient, ['notifications']),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: () => api.notifications.markAllRead(user?.id, user?.role),
    onSuccess: () => invalidate(queryClient, ['notifications']),
  });
}

export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckInInput) => api.sessions.checkIn(input),
    onSuccess: () => invalidate(queryClient, ALL_DATA),
  });
}

export function useCheckOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CheckOutInput }) =>
      api.sessions.checkOut(id, input),
    onSuccess: () => invalidate(queryClient, ALL_DATA),
  });
}

export function useUpdateSpaceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SpaceStatus }) =>
      api.facilities.setSpaceStatus(id, status),
    onSuccess: () => invalidate(queryClient, ALL_DATA),
  });
}

export function useCreateFacility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFacilityInput) => api.facilities.create(input),
    onSuccess: () => invalidate(queryClient, ALL_DATA),
  });
}

export function useUpdateFacility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Facility> }) =>
      api.facilities.update(id, patch),
    onSuccess: () => invalidate(queryClient, ALL_DATA),
  });
}

export function useDeleteFacility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.facilities.remove(id),
    onSuccess: () => invalidate(queryClient, ALL_DATA),
  });
}

export function useAddFloor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (facilityId: string) => api.facilities.addFloor(facilityId),
    onSuccess: () => invalidate(queryClient, ALL_DATA),
  });
}

export function useAddZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (floorId: string) => api.facilities.addZone(floorId),
    onSuccess: () => invalidate(queryClient, ALL_DATA),
  });
}

export function useAddSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (zoneId: string) => api.facilities.addSpace(zoneId),
    onSuccess: () => invalidate(queryClient, ALL_DATA),
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      fullName: string;
      email: string;
      phone: string;
      role: Role;
      facilityIds?: string[];
    }) => api.admin.createUser(input),
    onSuccess: () => invalidate(queryClient, ['admin-users', 'audit-logs']),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<User> }) =>
      api.admin.updateUser(id, patch),
    onSuccess: () => invalidate(queryClient, ['admin-users', 'audit-logs']),
  });
}

export function useToggleCamera() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.toggleCamera(id),
    onSuccess: () => invalidate(queryClient, ['cameras']),
  });
}

export function useCreateIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      facilityId: string;
      type: Incident['type'];
      severity: Incident['severity'];
      description: string;
      plate?: string;
      reportedBy: string;
    }) => api.admin.createIncident(input),
    onSuccess: () => invalidate(queryClient, ['incidents', 'notifications', 'guard-summary']),
  });
}

export function useResolveIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.resolveIncident(id),
    onSuccess: () => invalidate(queryClient, ['incidents', 'guard-summary']),
  });
}

export function useUpdatePricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<PricingRule> }) =>
      api.admin.updatePricing(id, patch),
    onSuccess: () => invalidate(queryClient, ['pricing', 'audit-logs']),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<SystemSettings>) => api.admin.updateSettings(patch),
    onSuccess: () => invalidate(queryClient, ['system-settings', 'audit-logs']),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user, patchUser } = useAuth();
  return useMutation({
    mutationFn: (patch: Partial<Pick<User, 'fullName' | 'phone' | 'email'>>) =>
      api.profile.update(user?.id as string, patch),
    onSuccess: (updated) => {
      patchUser(updated);
      invalidate(queryClient, ['admin-users']);
    },
  });
}

export function useSpaceAvailability(spaceId: string | undefined) {
  return useQuery({
    queryKey: ['space-availability', spaceId],
    queryFn: () => api.facilities.availability(spaceId as string),
    enabled: Boolean(spaceId),
    staleTime: 5_000,
  });
}

export type CheckOutPayload = { id: string; input: CheckOutInput };
export type ReservationListItem = Reservation;
export type SpaceListItem = ParkingSpace;
export type ReviewListItem = Review;
