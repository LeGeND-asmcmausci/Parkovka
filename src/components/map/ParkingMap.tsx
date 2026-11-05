import { Minus, Plus, RotateCcw, Search } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import type { ParkingSpace, SpaceStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';

const STATUS_CLASSES: Record<
  SpaceStatus,
  { shape: string; text: string; dot: string }
> = {
  AVAILABLE: {
    shape: 'fill-emerald-50 stroke-emerald-600 dark:fill-emerald-500/15 dark:stroke-emerald-400',
    text: 'fill-emerald-800 dark:fill-emerald-300',
    dot: 'bg-emerald-500',
  },
  OCCUPIED: {
    shape: 'fill-rose-50 stroke-rose-500 dark:fill-rose-500/15 dark:stroke-rose-400',
    text: 'fill-rose-700 dark:fill-rose-300',
    dot: 'bg-rose-500',
  },
  RESERVED: {
    shape: 'fill-amber-50 stroke-amber-500 dark:fill-amber-500/15 dark:stroke-amber-400',
    text: 'fill-amber-800 dark:fill-amber-300',
    dot: 'bg-amber-500',
  },
  BLOCKED: {
    shape: 'fill-ink-100 stroke-ink-400 dark:fill-white/5 dark:stroke-white/25',
    text: 'fill-ink-500 dark:fill-white/40',
    dot: 'bg-ink-400',
  },
  MAINTENANCE: {
    shape: 'fill-violet-50 stroke-violet-400 dark:fill-violet-500/15 dark:stroke-violet-400',
    text: 'fill-violet-700 dark:fill-violet-300',
    dot: 'bg-violet-400',
  },
};

const STATUS_KEYS = {
  AVAILABLE: 'status.available',
  OCCUPIED: 'status.occupied',
  RESERVED: 'status.reserved',
  BLOCKED: 'status.blocked',
  MAINTENANCE: 'status.maintenance',
} as const;

export interface ParkingMapProps {
  spaces: ParkingSpace[];
  selectedSpaceId?: string | null;
  onSelectSpace?: (space: ParkingSpace) => void;
  canSelect?: (space: ParkingSpace) => boolean;
  showLegend?: boolean;
  showSearch?: boolean;
  className?: string;
}

export function ParkingMap({
  spaces,
  selectedSpaceId,
  onSelectSpace,
  canSelect = (space) => space.status === 'AVAILABLE',
  showLegend = true,
  showSearch = true,
  className,
}: ParkingMapProps) {
  const { t } = useI18n();
  const patternId = `hatch-${useId().replace(/:/g, '')}`;
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [query, setQuery] = useState('');
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const movedRef = useRef(false);

  const sorted = useMemo(
    () => [...spaces].sort((a, b) => a.y - b.y || a.x - b.x),
    [spaces],
  );
  const bands = useMemo(() => {
    const map = new Map<number, ParkingSpace[]>();
    sorted.forEach((space) => map.set(space.y, [...(map.get(space.y) ?? []), space]));
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [sorted]);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return null;
    return new Set(
      sorted.filter((space) => space.code.toLowerCase().includes(term)).map((space) => space.id),
    );
  }, [query, sorted]);

  const maxY = sorted.length ? Math.max(...sorted.map((space) => space.y + space.h)) : 500;
  const viewHeight = Math.max(500, maxY + 60);

  const zoomBy = (delta: number) =>
    setScale((current) => Math.min(2.4, Math.max(0.8, Math.round((current + delta) * 10) / 10)));

  const reset = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const translateX = 500 * (1 - scale) + pan.x;
  const translateY = 250 * (1 - scale) + pan.y;

  const selectFirstMatch = () => {
    if (!matches || matches.size === 0 || !onSelectSpace) return;
    const target = sorted.find((space) => matches.has(space.id) && canSelect(space));
    if (target) onSelectSpace(target);
  };

  if (spaces.length === 0) {
    return (
      <EmptyState
        className={className}
        title={t('admin.noData')}
        description={t('booking.noSpaceSelected')}
      />
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface-sunken">
        <svg
          viewBox={`0 0 1000 ${viewHeight}`}
          className="block h-auto w-full touch-none select-none"
          role="img"
          aria-label={t('facility.viewOnMap')}
          onPointerDown={(event) => {
            movedRef.current = false;
            if (!onSelectSpace) return;
            const target = event.target as Element;
            if (target.closest('[data-space]')) return;
            dragRef.current = {
              x: event.clientX,
              y: event.clientY,
              panX: pan.x,
              panY: pan.y,
            };
            movedRef.current = false;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = 1000 / rect.width;
            const dx = (event.clientX - drag.x) * ratio;
            const dy = (event.clientY - drag.y) * ratio;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;
            setPan({
              x: Math.max(-600, Math.min(600, drag.panX + dx)),
              y: Math.max(-400, Math.min(400, drag.panY + dy)),
            });
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          <defs>
            <pattern id={patternId} width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="10" className="stroke-current opacity-20" strokeWidth="3" />
            </pattern>
          </defs>
          <g transform={`translate(${translateX} ${translateY}) scale(${scale})`}>
            <rect x="18" y="18" width="964" height={viewHeight - 36} rx="18" className="fill-card stroke-border" strokeWidth="1.5" />
            {bands.map(([y, bandSpaces]) => {
              const floor = bandSpaces[0]?.code.split('-')[0] ?? '';
              const zone = bandSpaces[0]?.code.split('-')[1]?.replace(/\d+/g, '') ?? '';
              return (
                <g key={y}>
                  <rect
                    x="40"
                    y={y - 12}
                    width="920"
                    height="116"
                    rx="12"
                    className="fill-muted/50 stroke-border"
                    strokeWidth="1"
                    strokeDasharray="3 5"
                  />
                  <text x="52" y={y + 2} className="fill-muted-foreground text-[10px] font-semibold" style={{ fontSize: 11 }}>
                    {floor} · {zone}
                  </text>
                </g>
              );
            })}

            {sorted.map((space) => {
              const selected = space.id === selectedSpaceId;
              const selectable = canSelect(space);
              const dimmed = matches ? !matches.has(space.id) : false;
              const status = STATUS_CLASSES[space.status];
              const suffix = space.code.split('-')[1] ?? space.code;
              return (
                <g
                  key={space.id}
                  data-space
                  transform={`translate(${space.x} ${space.y})`}
                  role={onSelectSpace ? 'button' : undefined}
                  tabIndex={onSelectSpace && selectable ? 0 : undefined}
                  aria-label={`${space.code} — ${t(STATUS_KEYS[space.status])}`}
                  aria-pressed={onSelectSpace ? selected : undefined}
                  aria-disabled={onSelectSpace && !selectable ? true : undefined}
                  className={cn(
                    'transition-opacity',
                    dimmed && 'opacity-25',
                    onSelectSpace && selectable
                      ? 'cursor-pointer focus-visible:outline-none [&:focus-visible>rect]:stroke-[3]'
                      : 'cursor-default',
                  )}
                  onClick={() => {
                    if (!onSelectSpace || !selectable || movedRef.current) return;
                    onSelectSpace(space);
                  }}
                  onKeyDown={(event) => {
                    if (!onSelectSpace || !selectable) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectSpace(space);
                    }
                  }}
                >
                  {selected && (
                    <rect
                      x="-4"
                      y="-4"
                      width={space.w + 8}
                      height={space.h + 8}
                      rx="11"
                      className="fill-none stroke-gold-500"
                      strokeWidth="3"
                    />
                  )}
                  <rect
                    width={space.w}
                    height={space.h}
                    rx="8"
                    className={cn(
                      'transition-colors',
                      selected ? 'fill-navy-900 stroke-gold-400 dark:fill-gold-500 dark:stroke-gold-300' : status.shape,
                    )}
                    strokeWidth="1.5"
                  />
                  {(space.status === 'BLOCKED' || space.status === 'MAINTENANCE') && !selected && (
                    <rect width={space.w} height={space.h} rx="8" fill={`url(#${patternId})`} className="text-current" />
                  )}
                  <text
                    x={space.w / 2}
                    y={space.h / 2 + 2}
                    textAnchor="middle"
                    className={cn('pointer-events-none font-semibold', selected ? 'fill-white dark:fill-navy-950' : status.text)}
                    style={{ fontSize: 16 }}
                  >
                    {suffix}
                  </text>
                  <text
                    x={space.w / 2}
                    y={space.h / 2 + 19}
                    textAnchor="middle"
                    className={cn('pointer-events-none', selected ? 'fill-white/70 dark:fill-navy-950/70' : 'fill-current opacity-60')}
                    style={{ fontSize: 9 }}
                  >
                    {t(STATUS_KEYS[space.status])}
                  </text>
                  {space.sensor && <circle cx={space.w - 10} cy="10" r="3" className="fill-current opacity-40" />}
                </g>
              );
            })}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {showSearch ? (
            <div className="pointer-events-auto relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') selectFirstMatch();
                }}
                placeholder={t('common.search')}
                aria-label={t('common.search')}
                className="h-8 w-36 rounded-md border border-border bg-card/95 pl-8 pr-2 text-xs text-foreground shadow-sm outline-none backdrop-blur placeholder:text-muted-foreground focus:border-ring sm:w-48"
              />
            </div>
          ) : (
            <span />
          )}
          <div className="pointer-events-auto flex items-center gap-1 rounded-md border border-border bg-card/95 p-0.5 shadow-sm backdrop-blur">
            <Button variant="ghost" size="icon-xs" onClick={() => zoomBy(0.2)} aria-label={t('nav.expand')}>
              <Plus />
            </Button>
            <span className="w-9 text-center text-[10px] font-medium text-muted-foreground">
              {Math.round(scale * 100)}%
            </span>
            <Button variant="ghost" size="icon-xs" onClick={() => zoomBy(-0.2)} aria-label={t('nav.collapse')}>
              <Minus />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={reset} aria-label={t('common.reset')}>
              <RotateCcw />
            </Button>
          </div>
        </div>

        {matches && matches.size === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-11 flex justify-center">
            <span className="rounded-md bg-navy-950/90 px-3 py-1 text-[11px] font-medium text-white">
              {t('common.noResults')}
            </span>
          </div>
        )}
      </div>

      {showLegend && (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {(Object.keys(STATUS_CLASSES) as SpaceStatus[]).map((status) => (
            <li key={status} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn('size-2.5 rounded-[3px] border border-black/10', STATUS_CLASSES[status].dot)} />
              {t(STATUS_KEYS[status])}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
