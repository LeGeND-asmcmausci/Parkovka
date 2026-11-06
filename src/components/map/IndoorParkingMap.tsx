import { ArrowRight, Layers, ScanLine } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFloors, useSpaces, useZones } from '@/lib/api/hooks';
import { useAuth } from '@/lib/auth';
import { formatAmount } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { FacilityWithAvailability, ParkingSpace } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ZONE_TYPE_KEYS } from '@/components/facilities/facility-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { ParkingMap } from './ParkingMap';

export interface IndoorParkingMapProps {
  facility: FacilityWithAvailability;
  className?: string;
}

export function IndoorParkingMap({ facility, className }: IndoorParkingMapProps) {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const [floorId, setFloorId] = useState<string>();
  const [zoneId, setZoneId] = useState<string>();
  const [selectedSpace, setSelectedSpace] = useState<ParkingSpace | null>(null);

  const {
    data: floors = [],
    isLoading: floorsLoading,
    isError: floorsError,
    refetch: refetchFloors,
  } = useFloors(facility.id);
  const {
    data: spaces = [],
    isLoading: spacesLoading,
    isError: spacesError,
    refetch: refetchSpaces,
  } = useSpaces({ facilityId: facility.id });
  const { data: zones = [] } = useZones(floorId);

  useEffect(() => {
    if (floors.length > 0 && !floors.some((floor) => floor.id === floorId)) {
      setFloorId(floors[0].id);
    }
  }, [floorId, floors]);

  useEffect(() => {
    if (zones.length > 0 && !zones.some((zone) => zone.id === zoneId)) {
      setZoneId(zones[0].id);
    }
  }, [zoneId, zones]);

  useEffect(() => {
    setSelectedSpace(null);
  }, [floorId, zoneId]);

  const floorSpaces = useMemo(
    () => spaces.filter((space) => space.floorId === floorId),
    [floorId, spaces],
  );
  const zoneSpaces = useMemo(
    () => floorSpaces.filter((space) => space.zoneId === zoneId),
    [floorSpaces, zoneId],
  );
  const selectedZone = zones.find((zone) => zone.id === zoneId);
  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'GUARD';
  const canSelect = (space: ParkingSpace) => isPrivileged || space.status === 'AVAILABLE';

  const availableInZone = zoneSpaces.filter((space) => space.status === 'AVAILABLE').length;
  const spacePrice = facility.hourlyRate * (selectedZone?.rateMultiplier ?? 1);

  const bookingParams = new URLSearchParams({
    ...(floorId ? { floorId } : {}),
    ...(zoneId ? { zoneId } : {}),
    ...(selectedSpace ? { spaceId: selectedSpace.id, spaceCode: selectedSpace.code } : {}),
  }).toString();
  const bookingUrl = `/booking/${facility.slug}${bookingParams ? `?${bookingParams}` : ''}`;

  if (floorsLoading || spacesLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        <Skeleton className="h-9 w-56 rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (floorsError || spacesError) {
    return (
      <ErrorState
        className={className}
        title={t('common.somethingWrong')}
        description={t('errors.network')}
        onRetry={() => {
          void refetchFloors();
          void refetchSpaces();
        }}
        retryLabel={t('common.retry')}
      />
    );
  }

  if (floors.length === 0) {
    return (
      <EmptyState
        className={className}
        icon={<Layers />}
        title={t('map.indoorTitle')}
        description={t('map.emptyText')}
      />
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('facility.floor')}
          </p>
          <span className="text-[11px] text-muted-foreground">
            {t('map.availableOf', {
              available: zoneSpaces.filter((space) => space.status === 'AVAILABLE').length,
              total: zoneSpaces.length,
            })}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label={t('facility.floor')}>
          {floors.map((floor) => {
            const count = spaces.filter(
              (space) => space.floorId === floor.id && space.status === 'AVAILABLE',
            ).length;
            return (
              <button
                key={floor.id}
                type="button"
                onClick={() => setFloorId(floor.id)}
                aria-pressed={floor.id === floorId}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors',
                  floor.id === floorId
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {floor.name}
                <span className="ml-1.5 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('facility.zone')}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label={t('facility.zone')}>
          {zones.map((zone) => {
            const count = floorSpaces.filter(
              (space) => space.zoneId === zone.id && space.status === 'AVAILABLE',
            ).length;
            return (
              <button
                key={zone.id}
                type="button"
                onClick={() => setZoneId(zone.id)}
                aria-pressed={zone.id === zoneId}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors',
                  zone.id === zoneId
                    ? 'border-gold-400 bg-gold-50 text-gold-700 dark:bg-gold-500/10 dark:text-gold-300'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {zone.name} · {t(ZONE_TYPE_KEYS[zone.type])}
                <span className="ml-1.5 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {zoneSpaces.length === 0 ? (
        <EmptyState title={t('map.emptyTitle')} description={t('map.emptyText')} />
      ) : (
        <ParkingMap
          spaces={zoneSpaces}
          selectedSpaceId={selectedSpace?.id ?? null}
          onSelectSpace={setSelectedSpace}
          canSelect={canSelect}
          showSearch={false}
        />
      )}

      {selectedSpace && (
        <div className="rounded-xl border border-gold-300 bg-gold-50/70 p-3.5 dark:border-gold-500/30 dark:bg-gold-500/10">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-700 dark:text-gold-300">
                {t('booking.spaceSelected')}
              </p>
              <p className="mt-0.5 font-display text-base font-semibold text-foreground">
                {selectedSpace.code}
              </p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {floors.find((floor) => floor.id === floorId)?.name} · {selectedZone?.name} ·{' '}
                {formatAmount(spacePrice, language)} / {t('common.hours')}
              </p>
            </div>
            <StatusBadge status={selectedSpace.status} />
          </div>

          <div className="mt-3">
            {isPrivileged ? (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-card/70 px-3 py-2">
                <ScanLine className="mt-0.5 size-4 shrink-0 text-navy-600 dark:text-navy-300" />
                <div>
                  <Badge tone="info" size="sm">
                    {t('map.inspectionMode')}
                  </Badge>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {t('map.inspectionNote')}
                  </p>
                </div>
              </div>
            ) : (
              <Button asChild variant="accent" className="w-full">
                <Link
                  to={user ? bookingUrl : '/login'}
                  state={user ? undefined : { from: bookingUrl }}
                >
                  {user ? t('facility.reserve') : t('booking.loginCta')}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            {t('search.spacesFree', { count: availableInZone })}
          </p>
        </div>
      )}
    </div>
  );
}
