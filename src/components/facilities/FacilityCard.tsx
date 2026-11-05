import { ArrowUpRight, Clock, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatAmount } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { FacilityWithAvailability } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { RatingStars } from '@/components/ui/misc';
import { CITY_LABELS, FACILITY_TYPE_KEYS } from './facility-utils';
import { FacilityImage } from './FacilityImage';

export function FacilityCard({
  facility,
  className,
}: {
  facility: FacilityWithAvailability;
  className?: string;
}) {
  const { t, tx, language } = useI18n();
  const available = facility.availableSpaces;
  const occupancy = facility.totalSpaces
    ? Math.round(((facility.occupiedSpaces + facility.reservedSpaces) / facility.totalSpaces) * 100)
    : 0;

  return (
    <Link
      to={`/facilities/${facility.slug}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-lg dark:hover:border-navy-700',
        className,
      )}
    >
      <div className="relative">
        <FacilityImage
          src={facility.image}
          alt={tx(facility.name)}
          className="aspect-[16/10] w-full"
          imgClassName="transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <Badge tone={available > 0 ? 'success' : 'danger'} dot className="bg-white/95 text-ink-800 shadow-sm backdrop-blur dark:bg-navy-950/90 dark:text-white">
            {available > 0 ? t('search.spacesFree', { count: available }) : t('status.occupied')}
          </Badge>
          <Badge tone="gold" className="bg-navy-950/80 text-gold-200 shadow-sm backdrop-blur">
            {t(FACILITY_TYPE_KEYS[facility.type])}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-[15px] font-semibold text-foreground">
              {tx(facility.name)}
            </h3>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">
                {tx(CITY_LABELS[facility.city])} · {tx(facility.district)}
              </span>
            </p>
          </div>
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
            <ArrowUpRight className="size-4" />
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <RatingStars value={facility.rating} size={14} />
          <span className="text-[11px] text-muted-foreground">
            {facility.reviewCount} {t('facility.reviews').toLowerCase()}
          </span>
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {t('facility.availableSpaces')}: <strong className="font-semibold text-foreground">{available}</strong> /{' '}
              {facility.totalSpaces}
            </span>
            <span>{occupancy}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full',
                occupancy >= 90 ? 'bg-red-500' : occupancy >= 70 ? 'bg-amber-500' : 'bg-emerald-500',
              )}
              style={{ width: `${Math.min(100, occupancy)}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('search.perHour')}
            </p>
            <p className="font-display text-[15px] font-bold text-foreground">
              {formatAmount(facility.hourlyRate, language)}
            </p>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Clock className="size-3.5" />
            {facility.open24h ? t('search.open24') : `${facility.openTime}–${facility.closeTime}`}
          </span>
        </div>
      </div>
    </Link>
  );
}
