import { ArrowLeft, Camera } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  createStreetViewPanorama,
  findStreetViewPanorama,
  hasGoogleMapsApiKey,
  loadGoogleMapsJs,
  StreetViewFailure,
  type LatLngLiteral,
  type StreetViewMapsApi,
  type StreetViewPanoramaInstance,
} from '@/lib/streetview/google-maps';
import type { FacilityWithAvailability } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/states';

type PanelState = 'loading' | 'ready' | 'missing-key' | 'unavailable' | 'error';

interface StreetViewPanelProps {
  facility: FacilityWithAvailability;
  onClose: () => void;
  className?: string;
}

export function StreetViewPanel({ facility, onClose, className }: StreetViewPanelProps) {
  const { t, tx } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<StreetViewPanoramaInstance | null>(null);
  const apiRef = useRef<StreetViewMapsApi | null>(null);

  const position: LatLngLiteral | null =
    Number.isFinite(facility.lat) &&
    Number.isFinite(facility.lng) &&
    !(facility.lat === 0 && facility.lng === 0)
      ? { lat: facility.lat, lng: facility.lng }
      : null;

  const [state, setState] = useState<PanelState>(() => {
    if (!hasGoogleMapsApiKey()) return 'missing-key';
    return position ? 'loading' : 'unavailable';
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!position) return;
    const container = containerRef.current;
    if (!container || !hasGoogleMapsApiKey()) return;

    let cancelled = false;

    void (async () => {
      try {
        const maps = await loadGoogleMapsJs();
        if (cancelled) return;
        apiRef.current = maps;

        const target = await findStreetViewPanorama(maps, position);
        if (cancelled) return;

        panoramaRef.current = createStreetViewPanorama(maps, container, target);
        setState('ready');
      } catch (error) {
        if (cancelled) return;
        if (error instanceof StreetViewFailure && error.code === 'no-panorama') {
          setState('unavailable');
        } else if (error instanceof StreetViewFailure && error.code === 'missing-key') {
          setState('missing-key');
        } else {
          setState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      const panorama = panoramaRef.current;
      panoramaRef.current = null;
      if (panorama) {
        try {
          panorama.setVisible(false);
          apiRef.current?.event?.clearInstanceListeners(panorama);
        } catch {
          // The panorama may already be detached by the Maps API.
        }
      }
      apiRef.current = null;
      container.replaceChildren();
    };
  }, [facility.lat, facility.lng]);

  const message =
    state === 'missing-key'
      ? t('map.streetViewMissingKey')
      : state === 'unavailable'
        ? t('map.streetViewUnavailable')
        : t('map.streetViewError');

  return (
    <section
      role="region"
      aria-label={t('map.streetViewTitle')}
      className={cn('overflow-hidden bg-navy-950', className)}
    >
      <div ref={containerRef} className="absolute inset-0" aria-hidden={state !== 'ready'} />

      {state !== 'ready' && (
        <div className="absolute inset-0 z-[1] grid place-items-center bg-[radial-gradient(120%_120%_at_20%_0%,#163b66_0%,#0b1b33_55%,#070f1f_100%)] px-6 text-center">
          {state === 'loading' ? (
            <div className="space-y-3" role="status">
              <Spinner className="mx-auto size-7 text-gold-400" />
              <p className="text-sm text-white/75">{t('map.streetViewLoading')}</p>
            </div>
          ) : (
            <div className="max-w-sm space-y-3" role="alert">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-white/10 text-gold-400">
                <Camera className="size-5" />
              </div>
              <p className="font-display text-sm font-semibold text-white">
                {t('map.streetViewTitle')}
              </p>
              <p className="text-[12px] leading-relaxed text-white/65">{message}</p>
            </div>
          )}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] flex items-start justify-between gap-3 bg-gradient-to-b from-navy-950/90 to-transparent p-3">
        <div className="pointer-events-auto min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-300">
            {t('map.streetView')}
          </p>
          <h2 className="truncate font-display text-sm font-semibold text-white">
            {tx(facility.name)}
          </h2>
        </div>
        <Button
          autoFocus
          variant="outline"
          size="sm"
          onClick={onClose}
          leftIcon={<ArrowLeft />}
          className="pointer-events-auto shrink-0 border-white/25 bg-navy-950/70 text-white hover:bg-navy-900 hover:text-white"
        >
          {t('map.backToMap')}
        </Button>
      </div>
    </section>
  );
}
