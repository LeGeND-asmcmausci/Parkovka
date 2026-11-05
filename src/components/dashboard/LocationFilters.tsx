import { useEffect } from 'react';
import { useFacilities, useFloors, useZones } from '@/lib/api/hooks';
import { useI18n } from '@/lib/i18n';
import { Select } from '@/components/ui/select';

interface LocationFiltersProps {
  facilityId: string;
  floorId: string;
  zoneId?: string;
  onFacilityChange: (id: string) => void;
  onFloorChange: (id: string) => void;
  onZoneChange?: (id: string) => void;
  includeZone?: boolean;
  autoSelect?: boolean;
  className?: string;
}

export function LocationFilters({
  facilityId,
  floorId,
  zoneId,
  onFacilityChange,
  onFloorChange,
  onZoneChange,
  includeZone = true,
  autoSelect = true,
  className,
}: LocationFiltersProps) {
  const { t, tx } = useI18n();
  const facilities = useFacilities();
  const floors = useFloors(facilityId || undefined);
  const zones = useZones(floorId || undefined);

  useEffect(() => {
    if (!autoSelect) return;
    const items = facilities.data ?? [];
    if (items.length > 0 && !items.some((facility) => facility.id === facilityId)) {
      onFacilityChange(items[0].id);
    }
  }, [autoSelect, facilities.data, facilityId, onFacilityChange]);

  useEffect(() => {
    if (!autoSelect) return;
    const items = floors.data ?? [];
    if (items.length > 0 && !items.some((floor) => floor.id === floorId)) {
      onFloorChange(items[0].id);
    }
  }, [autoSelect, floors.data, floorId, onFloorChange]);

  useEffect(() => {
    if (!autoSelect || !includeZone || !onZoneChange) return;
    const items = zones.data ?? [];
    if (items.length > 0 && !items.some((zone) => zone.id === zoneId)) {
      onZoneChange(items[0].id);
    }
  }, [autoSelect, includeZone, onZoneChange, zoneId, zones.data]);

  return (
    <div className={className ?? 'grid gap-3 sm:grid-cols-3'}>
      <Select
        value={facilityId}
        onChange={(event) => onFacilityChange(event.target.value)}
        aria-label={t('admin.facility')}
      >
        {(facilities.data ?? []).map((facility) => (
          <option key={facility.id} value={facility.id}>
            {tx(facility.name)}
          </option>
        ))}
      </Select>
      <Select
        value={floorId}
        onChange={(event) => onFloorChange(event.target.value)}
        aria-label={t('facility.floor')}
        disabled={!facilityId}
      >
        {!floorId && <option value="">{t('facility.selectFloor')}</option>}
        {(floors.data ?? []).map((floor) => (
          <option key={floor.id} value={floor.id}>
            {floor.name}
          </option>
        ))}
      </Select>
      {includeZone && (
        <Select
          value={zoneId ?? ''}
          onChange={(event) => onZoneChange?.(event.target.value)}
          aria-label={t('facility.zone')}
          disabled={!floorId}
        >
          {!zoneId && <option value="">{t('facility.selectZone')}</option>}
          {(zones.data ?? []).map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
