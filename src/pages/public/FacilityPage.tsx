import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  MessageSquare,
  MapPinned,
  Navigation,
  Phone,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  useCreateReview,
  useFacility,
  useFacilityReviews,
  useFacilities,
  useFloors,
  useSpaces,
  useZones,
} from '@/lib/api/hooks';
import { formatAmount, formatFullDateTime, formatRelative } from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { ParkingSpace } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AMENITY_ICONS, AMENITY_KEYS, CITY_LABELS, FACILITY_TYPE_KEYS, ZONE_TYPE_KEYS } from '@/components/facilities/facility-utils';
import { FacilityCard } from '@/components/facilities/FacilityCard';
import { FacilityImage } from '@/components/facilities/FacilityImage';
import { ParkingMap } from '@/components/map/ParkingMap';
import { Avatar, DetailRow, RatingStars } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';

function FacilitySkeleton() {
  return (
    <div className="page-container space-y-6 py-10">
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

function ReviewForm({ facilityId, onDone }: { facilityId: string; onDone: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const create = useCreateReview();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const location = useLocation();

  if (!user) {
    return (
      <EmptyState
        title={t('booking.loginRequired')}
        description={t('auth.loginSubtitle')}
        action={
          <Button asChild>
            <Link to="/login" state={{ from: location.pathname }}>
              {t('booking.loginCta')}
            </Link>
          </Button>
        }
      />
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (comment.trim().length < 5) {
      setError(t('errors.min', { min: 5 }));
      return;
    }
    create.mutate(
      { facilityId, userId: user.id, userName: user.fullName, rating, comment: comment.trim() },
      {
        onSuccess: () => {
          toast.success(t('facility.reviewSuccess'));
          setComment('');
          setRating(5);
          setError('');
          onDone();
        },
        onError: () => toast.error(t('common.somethingWrong'), t('errors.generic')),
      },
    );
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{t('facility.reviewRating')}</p>
        <RatingStars value={rating} onChange={setRating} size={20} />
      </div>
      <label htmlFor="review-comment" className="mt-3 block text-[13px] font-medium text-foreground">
        {t('facility.reviewComment')}
      </label>
      <Textarea
        id="review-comment"
        value={comment}
        onChange={(event) => {
          setComment(event.target.value);
          setError('');
        }}
        placeholder={t('user.reviewPlaceholder')}
        aria-invalid={Boolean(error)}
        className="mt-1.5 bg-card"
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="sm" loading={create.isPending}>
          {t('user.submitReview')}
        </Button>
      </div>
    </form>
  );
}

export function FacilityPage() {
  const { slug } = useParams();
  const { t, tx, language } = useI18n();
  const { user } = useAuth();
  const { data: facility, isLoading, isError, refetch } = useFacility(slug);
  const { data: allFacilities = [] } = useFacilities();
  const { data: floors = [] } = useFloors(facility?.id);
  const { data: reviews = [] } = useFacilityReviews(facility?.id);

  const [floorId, setFloorId] = useState<string>();
  const [zoneId, setZoneId] = useState<string>();
  const [selectedSpace, setSelectedSpace] = useState<ParkingSpace | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const { data: zones = [] } = useZones(floorId);
  const { data: spaces = [] } = useSpaces({ facilityId: facility?.id, floorId });

  useEffect(() => {
    if (!floorId && floors.length > 0) setFloorId(floors[0].id);
  }, [floorId, floors]);

  useEffect(() => {
    if (zones.length > 0 && !zones.some((zone) => zone.id === zoneId)) {
      setZoneId(zones[0].id);
    }
  }, [zones, zoneId]);

  useEffect(() => {
    setSelectedSpace(null);
  }, [floorId, zoneId]);

  const floorSpaces = useMemo(() => spaces.filter((space) => space.zoneId === zoneId), [spaces, zoneId]);
  const availableInZone = floorSpaces.filter((space) => space.status === 'AVAILABLE').length;
  const nearby = useMemo(
    () =>
      allFacilities
        .filter((item) => item.id !== facility?.id && (!facility || item.city === facility.city))
        .slice(0, 3),
    [allFacilities, facility],
  );

  usePageTitle(facility ? tx(facility.name) : t('facility.notFound'));

  if (isLoading) return <FacilitySkeleton />;

  if (isError || !facility) {
    return (
      <div className="page-container py-16">
        <EmptyState
          icon={<X />}
          title={t('facility.notFound')}
          description={t('facility.notFoundText')}
          action={
            <Button variant="outline" onClick={() => void refetch()} leftIcon={<ArrowLeft />}>
              {t('booking.backToSearch')}
            </Button>
          }
        />
      </div>
    );
  }

  const occupancy = Math.round(
    ((facility.occupiedSpaces + facility.reservedSpaces) / facility.totalSpaces) * 100,
  );
  const bookingParams = new URLSearchParams({
    ...(floorId ? { floorId } : {}),
    ...(zoneId ? { zoneId } : {}),
    ...(selectedSpace ? { spaceId: selectedSpace.id, spaceCode: selectedSpace.code } : {}),
  }).toString();
  const bookingUrl = `/booking/${facility.slug}${bookingParams ? `?${bookingParams}` : ''}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}`;

  const reserveLink = user ? (
    <Button asChild variant="accent" size="lg" className="w-full">
      <Link to={bookingUrl}>
        {t('facility.reserve')}
        <ArrowRight className="size-4" />
      </Link>
    </Button>
  ) : (
    <Button asChild variant="accent" size="lg" className="w-full">
      <Link to="/login" state={{ from: bookingUrl }}>
        {t('facility.reserve')}
        <ArrowRight className="size-4" />
      </Link>
    </Button>
  );

  return (
    <div className="bg-background">
      <div className="relative h-[300px] overflow-hidden bg-navy-950 sm:h-[340px]">
        <FacilityImage src={facility.image} alt={tx(facility.name)} className="absolute inset-0 size-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/60 to-navy-950/20" />
        <div className="page-container relative flex h-full flex-col justify-between py-5">
          <nav className="flex items-center gap-1.5 text-[12px] text-white/60" aria-label="Breadcrumb">
            <Link to="/search" className="transition-colors hover:text-white">
              {t('nav.search')}
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="truncate text-white/90">{tx(facility.name)}</span>
          </nav>
          <div className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="gold" className="bg-gold-500/20 text-gold-200">
                {t(FACILITY_TYPE_KEYS[facility.type])}
              </Badge>
              <Badge
                tone={facility.status === 'ACTIVE' ? 'success' : 'danger'}
                dot
                className="border-white/20 bg-white/10 text-white"
              >
                {facility.open24h ? t('search.open24') : facility.status === 'ACTIVE' ? t('facility.openNow') : t('facility.closedNow')}
              </Badge>
            </div>
            <h1 className="mt-2.5 font-display text-[30px] font-bold tracking-[-0.03em] text-white sm:text-[40px]">
              {tx(facility.name)}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-white/70">
              <span className="flex items-center gap-1.5">
                <Navigation className="size-4 text-gold-400" />
                {tx(facility.address)}, {tx(CITY_LABELS[facility.city])}
              </span>
              <span className="flex items-center gap-1.5">
                <Star className="size-4 fill-gold-400 text-gold-400" />
                {facility.rating.toFixed(1)} · {facility.reviewCount} {t('facility.reviews').toLowerCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="page-container py-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-8">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: t('facility.availableSpaces'),
                  value: facility.availableSpaces,
                  icon: Check,
                  tone: 'text-emerald-600 dark:text-emerald-400',
                },
                {
                  label: t('facility.hourly'),
                  value: formatAmount(facility.hourlyRate, language),
                  icon: CreditCard,
                  tone: 'text-navy-700 dark:text-navy-300',
                },
                {
                  label: t('facility.dailyCap'),
                  value: formatAmount(facility.dailyCap, language),
                  icon: CalendarDays,
                  tone: 'text-navy-700 dark:text-navy-300',
                },
                {
                  label: t('facility.openingHours'),
                  value: facility.open24h ? '24/7' : `${facility.openTime}–${facility.closeTime}`,
                  icon: Clock,
                  tone: 'text-navy-700 dark:text-navy-300',
                },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
                    <Icon className={cn('size-4', stat.tone)} />
                    <p className="mt-2 truncate font-display text-[15px] font-semibold text-foreground">{stat.value}</p>
                    <p className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                  </div>
                );
              })}
            </div>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">{t('facility.about')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tx(facility.description)}</p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">{t('facility.amenities')}</h2>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {facility.amenities.map((amenity) => {
                  const Icon = AMENITY_ICONS[amenity];
                  return (
                    <div
                      key={amenity}
                      className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-[13px] text-foreground"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-navy-700 dark:text-navy-300">
                        <Icon className="size-3.5" />
                      </span>
                      {t(AMENITY_KEYS[amenity])}
                    </div>
                  );
                })}
              </div>
            </section>

            <section id="map">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold text-foreground">{t('facility.viewOnMap')}</h2>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {t('facility.floor')} / {t('facility.zone')} · {t('search.spacesFree', { count: availableInZone })}
                  </p>
                </div>
                <Badge tone="navy" size="sm">
                  {t('facility.lastUpdated')}: {formatRelative(new Date(), language)}
                </Badge>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {floors.map((floor) => (
                  <button
                    key={floor.id}
                    type="button"
                    onClick={() => setFloorId(floor.id)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors',
                      floor.id === floorId
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {floor.name}
                  </button>
                ))}
                <span className="mx-1 h-5 w-px bg-border" />
                {zones.map((zone) => {
                  const count = spaces.filter(
                    (space) => space.zoneId === zone.id && space.status === 'AVAILABLE',
                  ).length;
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => setZoneId(zone.id)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors',
                        zone.id === zoneId
                          ? 'border-gold-400 bg-gold-50 text-gold-700 dark:bg-gold-500/10 dark:text-gold-300'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {zone.name} · {t(ZONE_TYPE_KEYS[zone.type])} ({count})
                    </button>
                  );
                })}
              </div>

              <ParkingMap
                className="mt-4"
                spaces={floorSpaces}
                selectedSpaceId={selectedSpace?.id ?? null}
                onSelectSpace={setSelectedSpace}
              />

              {selectedSpace && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-300 bg-gold-50 px-4 py-3 dark:border-gold-500/30 dark:bg-gold-500/10">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-700 dark:text-gold-300">
                      {t('booking.spaceSelected')}
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedSpace.code} · {formatAmount(facility.hourlyRate, language)} / {t('common.hours')}
                    </p>
                  </div>
                  {reserveLink}
                </div>
              )}
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">{t('facility.pricing')}</h2>
              <dl className="mt-3 divide-y divide-border rounded-xl border border-border bg-card px-5">
                <DetailRow label={t('facility.hourly')}>{formatAmount(facility.hourlyRate, language)}</DetailRow>
                <DetailRow label={t('facility.dailyCap')}>{formatAmount(facility.dailyCap, language)}</DetailRow>
                <DetailRow label={t('facility.reservationFee')}>{formatAmount(facility.reservationFee, language)}</DetailRow>
              </dl>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">{t('facility.rules')}</h2>
              <ul className="mt-3 space-y-2">
                {facility.rules.map((rule, index) => (
                  <li key={index} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-navy-600 dark:text-navy-300" />
                    {tx(rule)}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold text-foreground">{t('facility.reviews')}</h2>
                  <div className="mt-1 flex items-center gap-2">
                    <RatingStars value={facility.rating} size={15} />
                    <span className="text-[12px] text-muted-foreground">
                      {facility.rating.toFixed(1)} · {facility.reviewCount}
                    </span>
                  </div>
                </div>
                {!reviewOpen && (
                  <Button variant="outline" size="sm" leftIcon={<MessageSquare />} onClick={() => setReviewOpen(true)}>
                    {t('facility.writeReview')}
                  </Button>
                )}
              </div>

              {reviewOpen && (
                <div className="mt-4">
                  <ReviewForm facilityId={facility.id} onDone={() => setReviewOpen(false)} />
                </div>
              )}

              <div className="mt-4 space-y-3">
                {reviews.length === 0 ? (
                  <EmptyState title={t('facility.noReviews')} icon={<MessageSquare />} />
                ) : (
                  reviews.map((review) => (
                    <article key={review.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={review.userName} size="sm" />
                          <div>
                            <p className="text-[13px] font-semibold text-foreground">{review.userName}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatFullDateTime(review.createdAt, language)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }, (_, index) => (
                            <Star
                              key={index}
                              className={cn(
                                'size-3',
                                index < review.rating ? 'fill-accent text-accent' : 'fill-transparent text-ink-300',
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="mt-3 text-[13px] leading-relaxed text-foreground/90">{review.comment}</p>
                      {review.reply && (
                        <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-[12px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Parkovka: </span>
                          {review.reply}
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          <aside>
            <div className="sticky top-24 space-y-4">
              <div className="rounded-xl border border-border bg-card p-5 shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t('facility.fromPrice')}</p>
                    <p className="font-display text-2xl font-bold text-foreground">
                      {formatAmount(facility.hourlyRate, language)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">/ {t('common.hours')}</span>
                    </p>
                  </div>
                  <Badge tone={facility.availableSpaces > 0 ? 'success' : 'danger'} dot>
                    {facility.availableSpaces > 0 ? t('status.available') : t('status.occupied')}
                  </Badge>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{t('facility.occupancy')}</span>
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
                  <p className="text-[11px] text-muted-foreground">
                    {t('facility.availableSpaces')}: <strong className="text-foreground">{facility.availableSpaces}</strong> /{' '}
                    {facility.totalSpaces}
                  </p>
                </div>

                <div className="mt-4 space-y-2 border-t border-border pt-4">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    leftIcon={<Navigation />}
                    onClick={() => window.open(directionsUrl, '_blank', 'noopener,noreferrer')}
                  >
                    {t('facility.directions')}
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-start" leftIcon={<MapPinned />}>
                    <Link to={`/map?facility=${facility.slug}`}>{t('nav.map')}</Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    leftIcon={<Phone />}
                    onClick={() => {
                      window.location.href = `tel:${facility.phone.replace(/\s/g, '')}`;
                    }}
                  >
                    {facility.phone}
                  </Button>
                </div>

                <div className="mt-4">{reserveLink}</div>
                <p className="mt-2.5 text-center text-[10px] leading-relaxed text-muted-foreground">
                  {t('booking.holdNotice')}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface-sunken p-4">
                <div className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  {t('home.trust24')}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t('home.benefit2Text')}</p>
              </div>
            </div>
          </aside>
        </div>

        {nearby.length > 0 && (
          <section className="mt-14 border-t border-border pt-10">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-foreground">{t('facility.nearby')}</h2>
              <Link to="/search" className="text-[12px] font-medium text-navy-600 hover:underline dark:text-navy-300">
                {t('common.viewAll')}
              </Link>
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {nearby.map((item) => (
                <FacilityCard key={item.id} facility={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
