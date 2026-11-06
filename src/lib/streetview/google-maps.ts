export interface LatLngLiteral {
  lat: number;
  lng: number;
}

interface GoogleLatLng {
  lat(): number;
  lng(): number;
}

interface StreetViewLocation {
  pano?: string;
  latLng?: GoogleLatLng;
  description?: string;
}

interface StreetViewPanoramaData {
  location?: StreetViewLocation;
}

interface StreetViewService {
  getPanorama(
    request: { location: LatLngLiteral; radius?: number },
    callback: (data: StreetViewPanoramaData | null, status: string) => void,
  ): void;
}

export interface StreetViewPanoramaInstance {
  setVisible(visible: boolean): void;
  setPov(pov: { heading: number; pitch: number }): void;
  setZoom(zoom: number): void;
  setPosition(position: LatLngLiteral): void;
  getStatus(): string;
}

interface StreetViewPanoramaOptions {
  pano?: string;
  position?: LatLngLiteral;
  pov?: { heading?: number; pitch?: number };
  zoom?: number;
  visible?: boolean;
  addressControl?: boolean;
  fullscreenControl?: boolean;
  motionTracking?: boolean;
  motionTrackingControl?: boolean;
  panControl?: boolean;
  zoomControl?: boolean;
  linksControl?: boolean;
  clickToGo?: boolean;
  scrollwheel?: boolean;
  enableCloseButton?: boolean;
}

export interface StreetViewMapsApi {
  StreetViewService: new () => StreetViewService;
  StreetViewPanorama: new (
    container: HTMLElement,
    options: StreetViewPanoramaOptions,
  ) => StreetViewPanoramaInstance;
  event?: { clearInstanceListeners(instance: unknown): void };
}

declare global {
  interface Window {
    google?: { maps?: StreetViewMapsApi };
    __parkovkaGoogleMapsReady?: () => void;
  }
}

export type StreetViewFailureCode = 'missing-key' | 'no-panorama' | 'load-failed';

export class StreetViewFailure extends Error {
  readonly code: StreetViewFailureCode;

  constructor(code: StreetViewFailureCode) {
    super(code);
    this.name = 'StreetViewFailure';
    this.code = code;
  }
}

const SCRIPT_ID = 'parkovka-google-maps';
const CALLBACK_NAME = '__parkovkaGoogleMapsReady';
let pending: Promise<StreetViewMapsApi> | null = null;

export function googleMapsApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ?? '';
}

export function hasGoogleMapsApiKey(): boolean {
  return googleMapsApiKey().length > 0;
}

export function googleMapsScriptUrl(key: string): string {
  const params = new URLSearchParams({
    key,
    v: 'weekly',
    language: 'uz',
    region: 'UZ',
    callback: CALLBACK_NAME,
  });
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
}

export function loadGoogleMapsJs(): Promise<StreetViewMapsApi> {
  const key = googleMapsApiKey();
  if (!key) return Promise.reject(new StreetViewFailure('missing-key'));

  const ready = window.google?.maps;
  if (ready?.StreetViewService && ready.StreetViewPanorama) return Promise.resolve(ready);
  if (pending) return pending;

  pending = new Promise<StreetViewMapsApi>((resolve, reject) => {
    window.__parkovkaGoogleMapsReady = () => {
      const maps = window.google?.maps;
      if (maps?.StreetViewService && maps.StreetViewPanorama) resolve(maps);
      else reject(new StreetViewFailure('load-failed'));
    };

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = googleMapsScriptUrl(key);
    script.onerror = () => reject(new StreetViewFailure('load-failed'));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    pending = null;
    document.getElementById(SCRIPT_ID)?.remove();
    delete window.__parkovkaGoogleMapsReady;
    throw error;
  });

  return pending;
}

export function findStreetViewPanorama(
  maps: StreetViewMapsApi,
  position: LatLngLiteral,
  radius = 100,
): Promise<{ pano: string; position: LatLngLiteral }> {
  return new Promise((resolve, reject) => {
    const service = new maps.StreetViewService();
    service.getPanorama({ location: position, radius }, (data, status) => {
      if (status === 'OK' && data?.location?.pano) {
        const latLng = data.location.latLng;
        resolve({
          pano: data.location.pano,
          position: latLng
            ? { lat: latLng.lat(), lng: latLng.lng() }
            : position,
        });
        return;
      }
      reject(new StreetViewFailure('no-panorama'));
    });
  });
}

export function createStreetViewPanorama(
  maps: StreetViewMapsApi,
  container: HTMLElement,
  target: { pano: string; position: LatLngLiteral },
): StreetViewPanoramaInstance {
  return new maps.StreetViewPanorama(container, {
    pano: target.pano,
    position: target.position,
    pov: { heading: 0, pitch: 0 },
    zoom: 1,
    visible: true,
    addressControl: false,
    fullscreenControl: true,
    motionTracking: false,
    motionTrackingControl: false,
    panControl: true,
    zoomControl: true,
    linksControl: true,
    clickToGo: true,
    scrollwheel: true,
    enableCloseButton: false,
  });
}
