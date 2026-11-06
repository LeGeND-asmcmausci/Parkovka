import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import type { ParkingSpace } from '@/lib/types';
import {
  connectParkingRealtime,
  type RealtimeStatus,
} from './parking-socket';

export function useParkingRealtime(facilityIds: string[]) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [status, setStatus] = useState<RealtimeStatus>('off');

  const idsKey = useMemo(
    () => [...new Set(facilityIds)].sort().join('|'),
    [facilityIds],
  );

  useEffect(() => {
    const ids = idsKey ? idsKey.split('|') : [];
    if (ids.length === 0) {
      setStatus('off');
      return;
    }

    const disconnect = connectParkingRealtime({
      facilityIds: ids,
      user: user ? { id: user.id, role: user.role } : null,
      onStatus: setStatus,
      onSpaceUpdated: (event) => {
        queryClient.setQueriesData<ParkingSpace[]>({ queryKey: ['spaces'] }, (spaces) =>
          spaces?.map((space) =>
            space.id === event.spaceId
              ? {
                  ...space,
                  status: event.status,
                  updatedAt: event.timestamp ?? new Date().toISOString(),
                }
              : space,
          ),
        );
        void queryClient.invalidateQueries({ queryKey: ['facility', event.facilityId] });
        void queryClient.invalidateQueries({ queryKey: ['facilities'] });
      },
      onAvailabilityUpdated: (event) => {
        void queryClient.invalidateQueries({ queryKey: ['facility', event.facilityId] });
        void queryClient.invalidateQueries({ queryKey: ['facilities'] });
        void queryClient.invalidateQueries({ queryKey: ['spaces'] });
      },
    });

    return disconnect;
  }, [idsKey, queryClient, user]);

  return status;
}
