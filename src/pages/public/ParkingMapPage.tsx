import {
  ArrowRight,
  Camera,
  ExternalLink,
  Layers,
  LocateFixed,
  MapPin,
  Maximize2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { USE_FIXTURES } from '@/lib/api';
import { useFacilityMap } from '@/lib/api/hooks';
import { useAuth } from '@/lib/auth';
import { formatAmount } from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';
import { useI18n } from '@/lib/i18n';
import {
  availabilityLevel,
  distanceKm,
  formatDistanceKm,
  googleMapsDirectionsUrl,
  hasCoordinates,
  type AvailabilityLevel,
  type Coordinates,
} from '@/lib/map/geo';
import { useParkingRealtime } from '@/lib/realtime/use-parking-realtime';
import type { FacilityWithAvailability } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  CITY_LABELS,
  FACILITY_TYPE_KEYS,
} from '@/components/facilities/facility-utils';
import { FacilityImage } from '@/components/facilities/FacilityImage';
import { IndoorParkingMap } from '@/components/map/IndoorParkingMap';
import { ParkingCityMap } from '@/components/map/ParkingCityMap';
import { StreetViewPanel } from '@/components/map/StreetViewPanel';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckboxField } from '@/components/ui/controls';
import { InputWithIcon } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';

type SortKey = 'recommended' | 'distance' | 'price-asc' | 'availability';

const PRICE_OPTIONS = [5000, 8000, 12000, 20000];

const LEVEL_TONE: Record<AvailabilityLevel, BadgeTone> = {
  available: 'success',
  limited: 'warning',
  full: 'danger',
};

const LEVEL_KEY = {
  available: 'map.statusAvailable',
  limited: 'map.statusLimited',
  full: 'map.statusFull',
} as const;

const LEVEL_DOT: Record<AvailabilityLevel, string> = {
  available: 'bg-emerald-500',
  limited: 'bg-amber-500',
  full: 'bg-red-500',
};

function facilitySearchText(facility: FacilityWithAvailability) {
  return [
    facility.slug,
    ...Object.values(facility.name),
    ...Object.values(facility.address),
    ...Object.values(facility.district),
    ...Object.values(CITY_LABELS[facility.city]),
  ]
    .join(' ')
    .toLowerCase();
}

function FacilityDetailPanel({
  facility,
  distance,
  userLocation,
  onClose,
  onStreetView,
}: {
  facility: FacilityWithAvailability;
  distance?: number;
  userLocation: Coordinates | null;
  onClose: () => void;
  onStreetView: (facility: FacilityWithAvailability) => void;
}) {
  const { t, tx, language } = useI18n();
  const { user } = useAuth();
  const level = availabilityLevel(facility.availableSpaces, facility.totalSpaces);
  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'GUARD';
  const directions = hasCoordinates(facility)
    ? googleMapsDirectionsUrl(
        { lat: facility.lat, lng: facility.lng },
        userLocation,
      )
    : null;
  const bookingUrl = `/booking/${facility.slug}`;

  return (
    <div className="overflow-hidden bg-card lg:rounded-xl">
      <div className="relative h-32 overflow-hidden bg-navy-950">
        <FacilityImage
          src={facility.image}
          alt={tx(facility.name)}
          className="absolute inset-0 size-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/55 to-navy-950/10" />
        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          <Badge tone="gold" size="sm" className="bg-gold-500/20 text-gold-100">
            {t(FACILITY_TYPE_KEYS[facility.type])}
          </Badge>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('map.closeSheet')}
            className="grid size-8 place-items-center rounded-full bg-navy-950/70 text-white transition-colors hover:bg-navy-950"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="absolute inset-x-3 bottom-2.5">
          <h2 className="font-display text-lg font-bold leading-tight text-white">
            {tx(facility.name)}
          </h2>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-white/75">
            <MapPin className="size-3 shrink-0" />
            {tx(facility.address)}, {tx(CITY_LABELS[facility.city])}
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={LEVEL_TONE[level]} dot>
            {t(LEVEL_KEY[level])}
          </Badge>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Star className="size-3 fill-gold-500 text-gold-500" />
            {facility.rating.toFixed(1)} · {facility.reviewCount}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('facility.availableSpaces')}
            </p>
            <p className="mt-0.5 font-display text-sm font-semibold text-foreground">
              {facility.availableSpaces}
              <span className="text-[11px] font-normal text-muted-foreground">
                {' '}
                / {facility.totalSpaces}
              </span>
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('facility.hourly')}
            </p>
            <p className="mt-0.5 truncate font-display text-sm font-semibold text-foreground">
              {formatAmount(facility.hourlyRate, language)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('map.distance')}
            </p>
            <p className="mt-0.5 font-display text-sm font-semibold text-foreground">
              {distance !== undefined ? formatDistanceKm(distance, language) : '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/facilities/${facility.slug}`}>{t('common.details')}</Link>
          </Button>
          {directions ? (
            <Button asChild variant="outline" size="sm">
              <a href={directions} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                {t('facility.directions')}
              </a>
            </Button>
          ) : (
            <p className="flex items-center justify-center rounded-lg border border-dashed border-border px-2 text-center text-[10px] text-muted-foreground">
              {t('map.noCoordinates')}
            </p>
          )}
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          leftIcon={<Camera />}
          disabled={!hasCoordinates(facility)}
          title={!hasCoordinates(facility) ? t('map.noCoordinates') : undefined}
          onClick={() => onStreetView(facility)}
        >
          {t('map.streetView')}
        </Button>

        {isPrivileged ? (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
            <Badge tone="info" size="sm">
              {t('map.inspectionMode')}
            </Badge>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t('map.inspectionNote')}
            </p>
          </div>
        ) : (
          <Button asChild variant="accent" className="w-full">
            <Link
              to={user ? bookingUrl : '/login'}
              state={user ? undefined : { from: bookingUrl }}
            >
              {t('facility.reserve')}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        )}

        <div className="border-t border-border pt-3">
          <div className="flex items-start gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-navy-700 dark:text-navy-300">
              <Layers className="size-3.5" />
            </span>
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                {t('map.indoorTitle')}
              </h3>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {t('map.indoorHint')}
              </p>
            </div>
          </div>
          <IndoorParkingMap className="mt-3" facility={facility} />
        </div>
      </div>
    </div>
  );
}

export function ParkingMapPage() {
  const { t, tx, language } = useI18n();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data: facilities = [], isLoading, isError, refetch } = useFacilityMap();

  const [query, setQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sort, setSort] = useState<SortKey>('recommended');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'ready' | 'error'>('idle');
  const [geoError, setGeoError] = useState('');
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const [streetViewFacility, setStreetViewFacility] = useState<FacilityWithAvailability | null>(
    null,
  );

  usePageTitle(t('map.title'));

  const facilityIds = useMemo(() => facilities.map((facility) => facility.id), [facilities]);
  const realtimeStatus = useParkingRealtime(facilityIds);

  const paramFacility = params.get('facility');

  useEffect(() => {
    if (!paramFacility || facilities.length === 0) return;
    const match = facilities.find(
      (facility) => facility.slug === paramFacility || facility.id === paramFacility,
    );
    if (match) setSelectedId(match.id);
  }, [facilities, paramFacility]);

  const distances = useMemo(() => {
    const map = new Map<string, number>();
    if (!userLocation) return map;
    facilities.forEach((facility) => {
      if (hasCoordinates(facility)) {
        map.set(facility.id, distanceKm(userLocation, facility));
      }
    });
    return map;
  }, [facilities, userLocation]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return facilities.filter((facility) => {
      if (maxPrice && facility.hourlyRate > maxPrice) return false;
      if (onlyAvailable && facility.availableSpaces <= 0) return false;
      if (term && !facilitySearchText(facility).includes(term)) return false;
      return true;
    });
  }, [facilities, maxPrice, onlyAvailable, query]);

  const effectiveSort = sort === 'distance' && !userLocation ? 'recommended' : sort;

  const sorted = useMemo(() => {
    const items = filtered.map((facility) => ({
      facility,
      distance: distances.get(facility.id),
    }));

    switch (effectiveSort) {
      case 'distance':
        return items.sort(
          (a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY),
        );
      case 'price-asc':
        return items.sort((a, b) => a.facility.hourlyRate - b.facility.hourlyRate);
      case 'availability':
        return items.sort((a, b) => b.facility.availableSpaces - a.facility.availableSpaces);
      default:
        return items.sort(
          (a, b) =>
            b.facility.rating * b.facility.availableSpaces -
            a.facility.rating * a.facility.availableSpaces,
        );
    }
  }, [distances, effectiveSort, filtered]);

  const selected = facilities.find((facility) => facility.id === selectedId) ?? null;
  const selectedFocus =
    selected && hasCoordinates(selected)
      ? { lat: selected.lat, lng: selected.lng }
      : null;
  const totalFree = facilities.reduce(
    (total, facility) => total + facility.availableSpaces,
    0,
  );

  const selectFacility = (facility: FacilityWithAvailability) => {
    setSelectedId(facility.id);
    setMobilePanelOpen(false);
    setStreetViewFacility(null);
    const next = new URLSearchParams(params);
    next.set('facility', facility.slug);
    setParams(next, { replace: true });
  };

  const closeDetails = () => {
    setSelectedId(null);
    setStreetViewFacility(null);
    const next = new URLSearchParams(params);
    next.delete('facility');
    setParams(next, { replace: true });
  };

  const openStreetView = (facility: FacilityWithAvailability) => {
    setStreetViewFacility(facility);
    setMobilePanelOpen(false);
  };

  const resetFilters = () => {
    setQuery('');
    setMaxPrice(undefined);
    setOnlyAvailable(false);
    setSort(userLocation ? 'distance' : 'recommended');
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      const message = t('map.locationUnsupported');
      setGeoStatus('error');
      setGeoError(message);
      toast.error(t('common.somethingWrong'), message);
      return;
    }

    setGeoStatus('locating');
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setAccuracy(position.coords.accuracy);
        setGeoStatus('ready');
        setSort('distance');
        toast.success(t('map.located'));
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? t('map.locationDenied')
            : error.code === error.POSITION_UNAVAILABLE
              ? t('map.locationUnavailable')
              : t('map.locationTimeout');
        setGeoStatus('error');
        setGeoError(message);
        toast.error(t('common.somethingWrong'), message);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const filterPanel = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="size-4" />
          {t('common.filters')}
        </p>
        <button
          type="button"
          onClick={resetFilters}
          className="flex items-center gap-1 text-[11px] font-medium text-navy-600 hover:underline dark:text-navy-300"
        >
          <RotateCcw className="size-3" />
          {t('common.reset')}
        </button>
      </div>

      <div>
        <label htmlFor="map-price" className="mb-1 block text-[12px] font-medium text-foreground">
          {t('search.price')}
        </label>
        <Select
          id="map-price"
          value={maxPrice ? String(maxPrice) : ''}
          onChange={(event) => setMaxPrice(event.target.value ? Number(event.target.value) : undefined)}
        >
          <option value="">{t('search.anyPrice')}</option>
          {PRICE_OPTIONS.map((price) => (
            <option key={price} value={price}>
              {language === 'en' ? '< ' : '≤ '}
              {formatAmount(price, language)}
            </option>
          ))}
        </Select>
      </div>

      <CheckboxField
        id="map-available"
        checked={onlyAvailable}
        onCheckedChange={(checked) => setOnlyAvailable(checked === true)}
        label={t('search.onlyAvailable')}
      />

      <div>
        <label htmlFor="map-sort" className="mb-1 block text-[12px] font-medium text-foreground">
          {t('search.sort')}
        </label>
        <Select
          id="map-sort"
          value={effectiveSort}
          onChange={(event) => setSort(event.target.value as SortKey)}
        >
          <option value="recommended">{t('search.sortRecommended')}</option>
          <option value="distance" disabled={!userLocation}>
            {t('map.sortDistance')}
          </option>
          <option value="price-asc">{t('search.sortPriceLow')}</option>
          <option value="availability">{t('search.sortAvailability')}</option>
        </Select>
        {!userLocation && (
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            {t('map.locationHint')}
          </p>
        )}
      </div>

      {geoStatus === 'ready' && (
        <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400" role="status">
          {t('map.located')}
        </p>
      )}
      {geoStatus === 'error' && geoError && (
        <p className="text-[11px] font-medium text-destructive" role="status">
          {geoError}
        </p>
      )}
    </div>
  );

  const resultsList = (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t('map.results', { count: sorted.length })}
      </p>
      {sorted.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title={t('map.emptyTitle')}
          description={t('map.emptyText')}
          action={
            <Button variant="outline" size="sm" onClick={resetFilters} leftIcon={<RotateCcw />}>
              {t('common.reset')}
            </Button>
          }
        />
      ) : (
        sorted.map(({ facility, distance }) => {
          const level = availabilityLevel(facility.availableSpaces, facility.totalSpaces);
          return (
            <button
              key={facility.id}
              type="button"
              onClick={() => selectFacility(facility)}
              aria-pressed={facility.id === selectedId}
              className={cn(
                'w-full rounded-lg border p-3 text-left transition-colors',
                facility.id === selectedId
                  ? 'border-gold-400 bg-gold-50/50 shadow-sm dark:bg-gold-500/5'
                  : 'border-border bg-card hover:border-ink-300 dark:hover:border-navy-700',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {tx(facility.name)}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {tx(facility.address)} · {tx(CITY_LABELS[facility.city])}
                  </p>
                </div>
                <span className={cn('mt-1 size-2.5 shrink-0 rounded-full', LEVEL_DOT[level])} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={LEVEL_TONE[level]} size="sm" dot>
                  {t(LEVEL_KEY[level])}
                </Badge>
                <span className="text-[11px] font-semibold text-foreground">
                  {formatAmount(facility.hourlyRate, language)}
                </span>
                {distance !== undefined && (
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceKm(distance, language)}
                  </span>
                )}
              </div>
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <div className="bg-background">
      <section className="border-b border-border bg-surface-sunken/60">
        <div className="page-container py-6 sm:py-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600 dark:text-gold-400">
                {t('nav.map')}
              </p>
              <h1 className="mt-1.5 font-display text-[26px] font-bold tracking-[-0.03em] text-foreground sm:text-[34px]">
                {t('map.title')}
              </h1>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
                {t('map.subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {USE_FIXTURES && (
                <Badge tone="gold" dot>
                  {t('common.demoData')}
                </Badge>
              )}
              <Badge tone="navy">
                {t('map.totalFree')}: {totalFree}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      <div className="page-container py-4 sm:py-6">
        {isLoading ? (
          <div className="grid gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
            <div className="space-y-3">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
            <Skeleton className="h-[calc(100dvh-13rem)] min-h-[520px] rounded-xl" />
          </div>
        ) : isError ? (
          <ErrorState
            title={t('common.somethingWrong')}
            description={t('errors.network')}
            onRetry={() => void refetch()}
            retryLabel={t('common.retry')}
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
            <aside
              className={cn(
                'z-30 bg-card',
                selected && !streetViewFacility
                  ? 'fixed inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-border shadow-pop lg:static lg:max-h-[calc(100dvh-12rem)] lg:rounded-xl lg:border lg:shadow-sm'
                  : 'hidden lg:block lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto lg:rounded-xl lg:border lg:border-border lg:shadow-sm',
              )}
            >
              <div className="hidden border-b border-border p-4 lg:block">
                <InputWithIcon
                  icon={<Search />}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('map.searchPlaceholder')}
                  aria-label={t('map.searchPlaceholder')}
                  className="h-10"
                />
                <div className="mt-4">{filterPanel}</div>
              </div>

              {selected && (
                <FacilityDetailPanel
                  facility={selected}
                  distance={distances.get(selected.id)}
                  userLocation={userLocation}
                  onClose={closeDetails}
                  onStreetView={openStreetView}
                />
              )}

              <div className="hidden p-3 lg:block">{resultsList}</div>
            </aside>

            <div className="relative h-[calc(100dvh-13rem)] min-h-[520px] overflow-hidden rounded-xl border border-border bg-surface-sunken">
              <ParkingCityMap
                className="size-full"
                facilities={filtered}
                activeId={selectedId}
                onSelect={(id) => {
                  const facility = facilities.find((item) => item.id === id);
                  if (facility) selectFacility(facility);
                }}
                userLocation={userLocation}
                accuracy={accuracy}
                focus={selectedFocus}
                fitSignal={fitSignal}
              />

              <div className="absolute inset-x-3 top-3 z-[500] flex gap-2 lg:hidden">
                <InputWithIcon
                  icon={<Search />}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onFocus={() => setMobilePanelOpen(true)}
                  placeholder={t('map.searchPlaceholder')}
                  aria-label={t('map.searchPlaceholder')}
                  className="h-10 flex-1 bg-card/95 shadow-md backdrop-blur"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="size-10 bg-card/95 shadow-md backdrop-blur"
                  aria-label={t('map.controls')}
                  aria-expanded={mobilePanelOpen}
                  onClick={() => setMobilePanelOpen((current) => !current)}
                >
                  <SlidersHorizontal />
                </Button>
              </div>

              {mobilePanelOpen && (
                <div className="absolute inset-x-3 top-16 z-[500] max-h-[55dvh] space-y-4 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card/98 p-4 shadow-pop backdrop-blur lg:hidden">
                  {filterPanel}
                  {resultsList}
                </div>
              )}

              <div className="absolute right-3 top-[4.5rem] z-[500] flex flex-col items-end gap-2 lg:top-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-card/95 shadow-md backdrop-blur"
                    onClick={locate}
                    loading={geoStatus === 'locating'}
                    leftIcon={<LocateFixed />}
                  >
                    {geoStatus === 'locating' ? t('map.locating') : t('map.locate')}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="bg-card/95 shadow-md backdrop-blur"
                    onClick={() => setFitSignal((value) => value + 1)}
                    aria-label={t('map.fit')}
                    title={t('map.fit')}
                  >
                    <Maximize2 />
                  </Button>
                </div>
                {realtimeStatus === 'connected' && (
                  <Badge tone="success" dot className="bg-card/95 shadow-sm backdrop-blur">
                    {t('map.live')}
                  </Badge>
                )}
              </div>

              {streetViewFacility && (
                <StreetViewPanel
                  className="absolute inset-0 z-[900]"
                  facility={streetViewFacility}
                  onClose={() => setStreetViewFacility(null)}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
