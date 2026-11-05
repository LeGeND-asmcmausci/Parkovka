import {
  Accessibility,
  ArrowUpDown,
  Cctv,
  Droplets,
  ShieldCheck,
  Umbrella,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n';
import type { AmenityKey, Facility, FacilityType, LocalizedText, ZoneType } from '@/lib/types';

export const FACILITY_TYPE_KEYS: Record<FacilityType, TranslationKey> = {
  MALL: 'search.typeMall',
  BUSINESS: 'search.typeBusiness',
  AIRPORT: 'search.typeAirport',
  HOTEL: 'search.typeHotel',
  PUBLIC: 'search.typePublic',
};

export const ZONE_TYPE_KEYS: Record<ZoneType, TranslationKey> = {
  STANDARD: 'status.standard',
  VIP: 'status.vip',
  EV: 'status.ev',
  ACCESSIBLE: 'status.accessible',
};

export const AMENITY_KEYS: Record<AmenityKey, TranslationKey> = {
  cctv: 'facility.amenity.cctv',
  ev: 'facility.amenity.ev',
  covered: 'facility.amenity.covered',
  security: 'facility.amenity.security',
  elevator: 'facility.amenity.elevator',
  carWash: 'facility.amenity.carWash',
  wifi: 'facility.amenity.wifi',
  accessible: 'facility.amenity.accessible',
};

export const AMENITY_ICONS: Record<AmenityKey, LucideIcon> = {
  cctv: Cctv,
  ev: Zap,
  covered: Umbrella,
  security: ShieldCheck,
  elevator: ArrowUpDown,
  carWash: Droplets,
  wifi: Wifi,
  accessible: Accessibility,
};

export const CITY_LABELS: Record<Facility['city'], LocalizedText> = {
  tashkent: { uz: 'Toshkent', ru: 'Ташкент', en: 'Tashkent' },
  samarkand: { uz: 'Samarqand', ru: 'Самарканд', en: 'Samarkand' },
  bukhara: { uz: 'Buxoro', ru: 'Бухара', en: 'Bukhara' },
};
