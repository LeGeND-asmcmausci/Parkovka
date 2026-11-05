import { useMemo } from 'react';
import { useFacilities } from '@/lib/api/hooks';
import { useI18n } from '@/lib/i18n';

export function useFacilityLookup() {
  const { data: facilities = [] } = useFacilities();
  const { tx } = useI18n();

  const byId = useMemo(
    () => new Map(facilities.map((facility) => [facility.id, facility])),
    [facilities],
  );

  return {
    facilities,
    get: (id: string | undefined) => (id ? byId.get(id) : undefined),
    name: (id: string | undefined) => {
      const facility = id ? byId.get(id) : undefined;
      return facility ? tx(facility.name) : (id ?? '—');
    },
  };
}
