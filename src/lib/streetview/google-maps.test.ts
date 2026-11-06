import { describe, expect, it } from 'vitest';
import {
  findStreetViewPanorama,
  googleMapsScriptUrl,
  type StreetViewMapsApi,
} from './google-maps';

describe('google maps street view adapter', () => {
  it('builds the Maps JavaScript API URL from the configured key', () => {
    const url = new URL(googleMapsScriptUrl('test-key-123'));

    expect(url.origin).toBe('https://maps.googleapis.com');
    expect(url.pathname).toBe('/maps/api/js');
    expect(url.searchParams.get('key')).toBe('test-key-123');
    expect(url.searchParams.get('v')).toBe('weekly');
    expect(url.searchParams.get('language')).toBe('uz');
    expect(url.searchParams.get('callback')).toBe('__parkovkaGoogleMapsReady');
  });

  it('resolves a panorama and its real coordinates', async () => {
    const maps = {
      StreetViewService: class {
        getPanorama(_request: unknown, callback: (data: unknown, status: string) => void) {
          callback(
            {
              location: {
                pano: 'pano-1',
                latLng: { lat: () => 41.3, lng: () => 69.2 },
              },
            },
            'OK',
          );
        }
      },
      StreetViewPanorama: class {},
    } as unknown as StreetViewMapsApi;

    await expect(
      findStreetViewPanorama(maps, { lat: 41.3111, lng: 69.2797 }),
    ).resolves.toEqual({
      pano: 'pano-1',
      position: { lat: 41.3, lng: 69.2 },
    });
  });

  it('reports a missing panorama instead of inventing one', async () => {
    const maps = {
      StreetViewService: class {
        getPanorama(_request: unknown, callback: (data: unknown, status: string) => void) {
          callback(null, 'ZERO_RESULTS');
        }
      },
      StreetViewPanorama: class {},
    } as unknown as StreetViewMapsApi;

    await expect(
      findStreetViewPanorama(maps, { lat: 41.3111, lng: 69.2797 }),
    ).rejects.toMatchObject({ code: 'no-panorama' });
  });
});
