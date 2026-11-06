import { describe, expect, it } from 'vitest';
import {
  availabilityLevel,
  distanceKm,
  formatDistanceKm,
  googleMapsDirectionsUrl,
  hasCoordinates,
} from './geo';

describe('map geo helpers', () => {
  it('validates real coordinates', () => {
    expect(hasCoordinates({ lat: 41.3111, lng: 69.2797 })).toBe(true);
    expect(hasCoordinates({ lat: 0, lng: 0 })).toBe(false);
    expect(hasCoordinates({ lat: 120, lng: 69 })).toBe(false);
    expect(hasCoordinates({ lat: Number.NaN, lng: 69 })).toBe(false);
    expect(hasCoordinates(null)).toBe(false);
  });

  it('computes haversine distance between Tashkent facilities', () => {
    const distance = distanceKm(
      { lat: 41.3111, lng: 69.2797 },
      { lat: 41.3176, lng: 69.257 },
    );
    expect(distance).toBeGreaterThan(2);
    expect(distance).toBeLessThan(3);
    expect(distanceKm({ lat: 41.3111, lng: 69.2797 }, { lat: 41.3111, lng: 69.2797 })).toBe(0);
  });

  it('formats distances in the selected language', () => {
    expect(formatDistanceKm(0.45, 'en')).toBe('450 m');
    expect(formatDistanceKm(2.34, 'uz')).toContain('km');
    expect(formatDistanceKm(NaN, 'en')).toBe('');
  });

  it('classifies availability into map tones', () => {
    expect(availabilityLevel(0, 100)).toBe('full');
    expect(availabilityLevel(5, 100)).toBe('limited');
    expect(availabilityLevel(60, 100)).toBe('available');
    expect(availabilityLevel(3, 0)).toBe('available');
  });

  it('builds a Google Maps directions link from coordinates only', () => {
    const destination = { lat: 41.3111, lng: 69.2797 };
    expect(googleMapsDirectionsUrl(destination)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=41.3111%2C69.2797',
    );

    const withOrigin = googleMapsDirectionsUrl(destination, { lat: 41.3, lng: 69.2 });
    const url = new URL(withOrigin);
    expect(url.searchParams.get('origin')).toBe('41.3,69.2');
    expect(url.searchParams.get('destination')).toBe('41.3111,69.2797');
  });
});
