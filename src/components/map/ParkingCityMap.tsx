import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import {
  Circle,
  MapContainer,
  Marker,
  ScaleControl,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import { formatAmount } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import {
  availabilityLevel,
  hasCoordinates,
  type AvailabilityLevel,
  type Coordinates,
} from '@/lib/map/geo';
import type { FacilityWithAvailability } from '@/lib/types';
import { cn } from '@/lib/utils';

const TASHKENT: [number, number] = [41.3111, 69.2797];

const TONE_STYLES: Record<
  AvailabilityLevel,
  { background: string; border: string }
> = {
  available: { background: 'linear-gradient(135deg,#047857,#065f46)', border: '#6ee7b7' },
  limited: { background: 'linear-gradient(135deg,#b45309,#92400e)', border: '#fcd34d' },
  full: { background: 'linear-gradient(135deg,#b91c1c,#991b1b)', border: '#fca5a5' },
};

function facilityIcon(facility: FacilityWithAvailability, active: boolean) {
  const level = availabilityLevel(facility.availableSpaces, facility.totalSpaces);
  const tone = TONE_STYLES[level];
  const outline = active
    ? 'outline:3px solid rgba(201,162,39,.65);outline-offset:3px;'
    : '';

  return L.divIcon({
    className: '',
    html: `<div style="display:inline-block;transform:translate(-50%,-100%);white-space:nowrap;">
      <div style="display:flex;align-items:center;gap:5px;padding:5px 9px;border-radius:999px;border:2px solid ${tone.border};background:${tone.background};box-shadow:0 6px 16px rgba(7,15,31,.38);${outline}">
        <span style="width:6px;height:6px;border-radius:999px;background:#fff;opacity:.9"></span>
        <span style="font:700 12px/1 Inter,system-ui,sans-serif;color:#fff">${facility.availableSpaces}</span>
        <span style="font:500 9px/1 Inter,system-ui,sans-serif;color:rgba(255,255,255,.78)">/ ${facility.totalSpaces}</span>
      </div>
      <div style="display:flex;justify-content:center;margin-top:-1px;">
        <span style="width:9px;height:9px;display:block;background:${tone.background};border-right:2px solid ${tone.border};border-bottom:2px solid ${tone.border};transform:rotate(45deg)"></span>
      </div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

const userIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:999px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 7px rgba(37,99,235,.22),0 4px 10px rgba(7,15,31,.35);transform:translate(-50%,-50%)"></div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

function MapFocus({
  target,
  zoom,
}: {
  target: Coordinates | null;
  zoom: number;
}) {
  const map = useMap();
  const lat = target?.lat;
  const lng = target?.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    map.flyTo([lat, lng], zoom, { duration: 0.65 });
  }, [lat, lng, map, zoom]);

  return null;
}

function FitResults({
  facilities,
  signal,
}: {
  facilities: FacilityWithAvailability[];
  signal: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (signal === 0) return;
    const points = facilities
      .filter(hasCoordinates)
      .map((facility) => [facility.lat, facility.lng] as [number, number]);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.flyTo(points[0], 14, { duration: 0.65 });
      return;
    }
    map.fitBounds(L.latLngBounds(points).pad(0.18), { maxZoom: 14 });
  }, [facilities, map, signal]);

  return null;
}

export interface ParkingCityMapProps {
  facilities: FacilityWithAvailability[];
  activeId: string | null;
  onSelect: (facilityId: string) => void;
  userLocation: Coordinates | null;
  accuracy?: number | null;
  focus?: Coordinates | null;
  fitSignal?: number;
  className?: string;
}

export function ParkingCityMap({
  facilities,
  activeId,
  onSelect,
  userLocation,
  accuracy,
  focus = null,
  fitSignal = 0,
  className,
}: ParkingCityMapProps) {
  const { t, tx, language } = useI18n();

  const mappedFacilities = useMemo(
    () => facilities.filter(hasCoordinates),
    [facilities],
  );

  const icons = useMemo(
    () =>
      new Map(
        mappedFacilities.map((facility) => [
          facility.id,
          facilityIcon(facility, facility.id === activeId),
        ]),
      ),
    [activeId, mappedFacilities],
  );

  const focusTarget = focus ?? userLocation;

  return (
    <div className={cn('relative isolate', className)}>
      <MapContainer
        center={TASHKENT}
        zoom={12}
        scrollWheelZoom
        zoomControl={false}
        className="size-full"
        attributionControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <ZoomControl position="bottomright" />
        <ScaleControl position="bottomleft" imperial={false} />
        <MapFocus target={focusTarget} zoom={focus ? 15 : 14} />
        <FitResults facilities={mappedFacilities} signal={fitSignal} />

        {mappedFacilities.map((facility) => (
          <Marker
            key={facility.id}
            position={[facility.lat, facility.lng]}
            icon={icons.get(facility.id)}
            title={tx(facility.name)}
            keyboard
            eventHandlers={{ click: () => onSelect(facility.id) }}
          >
            <Tooltip direction="top" offset={[0, -34]} opacity={1}>
              <div className="min-w-[160px] space-y-1">
                <p className="text-[12px] font-semibold text-ink-900">{tx(facility.name)}</p>
                <p className="text-[11px] text-ink-500">{tx(facility.address)}</p>
                <p className="text-[11px] font-medium text-ink-700">
                  {t('map.availableOf', {
                    available: facility.availableSpaces,
                    total: facility.totalSpaces,
                  })}
                  {' · '}
                  {formatAmount(facility.hourlyRate, language)}/{t('common.hours')}
                </p>
              </div>
            </Tooltip>
          </Marker>
        ))}

        {userLocation && (
          <>
            {accuracy && accuracy > 0 && (
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={accuracy}
                pathOptions={{
                  color: '#2563eb',
                  weight: 1,
                  fillColor: '#3b82f6',
                  fillOpacity: 0.12,
                }}
              />
            )}
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
              <Tooltip direction="top" offset={[0, -14]} opacity={1}>
                {t('map.locate')}
              </Tooltip>
            </Marker>
          </>
        )}
      </MapContainer>
    </div>
  );
}
