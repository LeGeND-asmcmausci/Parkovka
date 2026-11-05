import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { formatAmount } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { FacilityWithAvailability } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CITY_LABELS } from '@/components/facilities/facility-utils';

function FitBounds({ facilities }: { facilities: FacilityWithAvailability[] }) {
  const map = useMap();
  useEffect(() => {
    if (facilities.length === 0) return;
    const bounds = L.latLngBounds(facilities.map((facility) => [facility.lat, facility.lng]));
    map.fitBounds(bounds.pad(0.25), { animate: false, maxZoom: 14 });
  }, [facilities, map]);
  return null;
}

export function FacilitiesMap({
  facilities,
  activeId,
  onSelect,
  className,
}: {
  facilities: FacilityWithAvailability[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const { t, tx, language } = useI18n();

  const icons = useMemo(() => {
    const map = new Map<string, L.DivIcon>();
    facilities.forEach((facility) => {
      const tone =
        facility.availableSpaces === 0
          ? 'background:#7f1d1d;color:#fff;border-color:#fca5a5'
          : facility.availableSpaces < 10
            ? 'background:#78350f;color:#fde68a;border-color:#f59e0b'
            : 'background:#0b1b33;color:#fff;border-color:#c9a227';
      const selected = facility.id === activeId ? 'outline:3px solid rgba(201,162,39,.45);outline-offset:2px;' : '';
      map.set(
        facility.id,
        L.divIcon({
          className: '',
          html: `<div style="${tone};${selected}border-width:2px;border-style:solid;border-radius:999px;padding:5px 9px;font:600 11px/1.1 Inter,system-ui,sans-serif;white-space:nowrap;box-shadow:0 4px 12px rgba(7,15,31,.35);transform:translate(-50%,-100%);">${formatAmount(facility.hourlyRate, language)}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
      );
    });
    return map;
  }, [activeId, facilities, language]);

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border', className)}>
      <MapContainer
        center={[41.3111, 69.2797]}
        zoom={12}
        scrollWheelZoom={false}
        className="size-full min-h-[320px]"
        attributionControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <FitBounds facilities={facilities} />
        {facilities.map((facility) => (
          <Marker
            key={facility.id}
            position={[facility.lat, facility.lng]}
            icon={icons.get(facility.id)}
            eventHandlers={{ click: () => onSelect?.(facility.id) }}
          >
            <Popup>
              <div className="min-w-[190px] space-y-1.5">
                <p className="font-display text-sm font-semibold text-ink-900">{tx(facility.name)}</p>
                <p className="flex items-center gap-1 text-xs text-ink-500">
                  <MapPin className="size-3" />
                  {tx(CITY_LABELS[facility.city])} · {tx(facility.district)}
                </p>
                <p className="text-xs font-medium text-ink-700">
                  {t('search.spacesFree', { count: facility.availableSpaces })} ·{' '}
                  {formatAmount(facility.hourlyRate, language)}/{t('common.hours')}
                </p>
                <Link
                  to={`/facilities/${facility.slug}`}
                  className="mt-1 inline-flex text-xs font-semibold text-navy-700 underline underline-offset-2"
                >
                  {t('common.details')}
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
