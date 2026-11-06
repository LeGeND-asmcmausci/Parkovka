import { io, type Socket } from 'socket.io-client';
import { USE_FIXTURES, getAccessToken } from '@/lib/api/client';
import type { Role, SpaceStatus } from '@/lib/types';

export interface ParkingSpaceUpdatedEvent {
  facilityId: string;
  spaceId: string;
  status: SpaceStatus;
  timestamp?: string;
}

export interface ParkingAvailabilityUpdatedEvent {
  facilityId: string;
  available?: number;
  occupied?: number;
  reserved?: number;
  timestamp?: string;
}

export type RealtimeStatus = 'off' | 'connecting' | 'connected';

/**
 * `docs/FRONTEND_API_CONTRACT.md` documents `parking:space_updated` and
 * `parking:availability`. The older dotted/colon spellings are kept as aliases
 * so a server build that still emits them also updates the UI; only one of the
 * names is emitted per change, so handlers do not run twice.
 */
export const PARKING_EVENTS = {
  spaceUpdated: [
    'parking.space.updated',
    'parking.space:updated',
    'parking:space_updated',
  ],
  availabilityUpdated: [
    'parking.availability.updated',
    'parking.availability:updated',
    'parking:availability',
  ],
} as const;

export function socketUrl(): string | null {
  const explicit = (import.meta.env.VITE_SOCKET_URL as string | undefined)?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const api = import.meta.env.VITE_API_URL as string | undefined;
  if (!api) return null;
  try {
    return new URL(api).origin;
  } catch {
    return null;
  }
}

export function isRealtimeConfigured() {
  return !USE_FIXTURES && socketUrl() !== null;
}

export interface ParkingRealtimeHandlers {
  facilityIds: string[];
  user?: { id: string; role: Role } | null;
  onStatus?: (status: RealtimeStatus) => void;
  onSpaceUpdated?: (event: ParkingSpaceUpdatedEvent) => void;
  onAvailabilityUpdated?: (event: ParkingAvailabilityUpdatedEvent) => void;
}

export function connectParkingRealtime(handlers: ParkingRealtimeHandlers) {
  const url = socketUrl();
  if (USE_FIXTURES || !url) return () => undefined;

  const facilityIds = [...new Set(handlers.facilityIds)];
  const socket: Socket = io(url, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    // The contract accepts only the access token in `auth.token`; it is
    // re-read on every (re)connect so a rotated token is always current.
    auth: (cb) => {
      const current = getAccessToken();
      cb(current ? { token: current } : {});
    },
  });

  const joinFacilities = () => {
    facilityIds.forEach((facilityId) => socket.emit('join:facility', facilityId));
  };
  const leaveFacilities = () => {
    facilityIds.forEach((facilityId) => socket.emit('leave:facility', facilityId));
  };

  const handleSpaceUpdated = (payload: ParkingSpaceUpdatedEvent) => {
    handlers.onSpaceUpdated?.(payload);
  };
  const handleAvailabilityUpdated = (payload: ParkingAvailabilityUpdatedEvent) => {
    handlers.onAvailabilityUpdated?.(payload);
  };

  handlers.onStatus?.('connecting');

  socket.on('connect', () => {
    handlers.onStatus?.('connected');
    joinFacilities();
  });
  socket.on('disconnect', () => {
    handlers.onStatus?.('connecting');
  });
  socket.on('connect_error', () => {
    handlers.onStatus?.('connecting');
  });
  PARKING_EVENTS.spaceUpdated.forEach((event) => socket.on(event, handleSpaceUpdated));
  PARKING_EVENTS.availabilityUpdated.forEach((event) =>
    socket.on(event, handleAvailabilityUpdated),
  );

  return () => {
    leaveFacilities();
    PARKING_EVENTS.spaceUpdated.forEach((event) => socket.off(event, handleSpaceUpdated));
    PARKING_EVENTS.availabilityUpdated.forEach((event) =>
      socket.off(event, handleAvailabilityUpdated),
    );
    socket.removeAllListeners();
    socket.disconnect();
  };
}
