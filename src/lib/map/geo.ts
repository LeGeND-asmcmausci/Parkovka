import type { Language } from '@/lib/types';

export interface Coordinates {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function hasCoordinates(
  value: { lat?: number; lng?: number } | null | undefined,
): value is Coordinates {
  if (!value) return false;
  const { lat, lng } = value;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  return !(lat === 0 && lng === 0);
}

export function distanceKm(a: Coordinates, b: Coordinates) {
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

export function formatDistanceKm(km: number, language: Language) {
  if (!Number.isFinite(km) || km < 0) return '';
  const locale = language === 'uz' ? 'uz-UZ' : language === 'ru' ? 'ru-RU' : 'en-US';

  if (km < 1) {
    const metres = Math.max(10, Math.round((km * 1000) / 10) * 10);
    return `${new Intl.NumberFormat(locale).format(metres)} ${language === 'ru' ? 'м' : 'm'}`;
  }

  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(rounded);
  return `${formatted} ${language === 'ru' ? 'км' : 'km'}`;
}

export type AvailabilityLevel = 'available' | 'limited' | 'full';

export function availabilityLevel(available: number, total: number): AvailabilityLevel {
  if (!Number.isFinite(available) || available <= 0) return 'full';
  const denominator = Number.isFinite(total) && total > 0 ? total : available;
  return available / denominator <= 0.2 ? 'limited' : 'available';
}

export function googleMapsDirectionsUrl(destination: Coordinates, origin?: Coordinates | null) {
  const params = new URLSearchParams({
    api: '1',
    destination: `${destination.lat},${destination.lng}`,
  });
  if (hasCoordinates(origin)) params.set('origin', `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
