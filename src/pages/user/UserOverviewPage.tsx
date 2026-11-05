import {
  ArrowRight,
  CalendarDays,
  Car,
  Clock3,
  CreditCard,
  MapPin,
  Plus,
  QrCode,
  Search,
  Ticket,
  Timer,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFacilities, useMyPayments, useMyReservations, useNotifications, useSessions, useVehicles } from '@/lib/api/hooks';
import { useAuth } from '@/lib/auth';
import { formatAmount, formatCompactAmount, formatRelative, formatTime } from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';
import { useI18n } from '@/lib/i18n';
import type { Reservation } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader, Progress, StatCard } from '@/components/ui/misc';
import { EmptyState, PageSkeleton } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';

const OPEN_STATUSES = new Set<Reservation['status']>(['PENDING', 'CONFIRMED', 'ACTIVE']);

export function UserOverviewPage() {
  const { t, tx, language } = useI18n();
  const { user } = useAuth();
  const reservations = useMyReservations();
  const payments = useMyPayments();
  const vehicles = useVehicles();
  const sessions = useSessions({ userId: user?.id });
  const notifications = useNotifications();
  const facilities = useFacilities();

  usePageTitle(t('user.overviewTitle'));

  const loading = reservations.isLoading || payments.isLoading || vehicles.isLoading;
  const paidTotal = (payments.data ?? [])
    .filter((payment) => payment.status === 'PAID')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const activeSession = (sessions.data ?? []).find((session) => session.status === 'ACTIVE');
  const upcoming = [...(reservations.data ?? [])]
    .filter((reservation) => OPEN_STATUSES.has(reservation.status))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

  const facilityById = new Map((facilities.data ?? []).map((facility) => [facility.id, facility]));
  const facilityName = (id: string | undefined) => {
    const facility = id ? facilityById.get(id) : undefined;
    return facility ? tx(facility.name) : (id ?? '—');
  };
  const upcomingFacility = upcoming ? facilityById.get(upcoming.facilityId) : undefined;
  const elapsedShare = upcoming
    ? Math.min(
        100,
        Math.max(
          0,
          ((Date.now() - new Date(upcoming.startsAt).getTime()) /
            Math.max(1, new Date(upcoming.endsAt).getTime() - new Date(upcoming.startsAt).getTime())) *
            100,
        ),
      )
    : 0;

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('nav.myArea')}
        title={t('user.greeting', { name: user?.fullName.split(' ')[0] ?? '' })}
        description={t('user.overviewSubtitle')}
        actions={
          <>
            <Button asChild variant="outline" leftIcon={<Search />}>
              <Link to="/search">{t('nav.search')}</Link>
            </Button>
            <Button asChild leftIcon={<Plus />}>
              <Link to="/booking">{t('user.bookNow')}</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('user.reservationsCount')}
          value={reservations.data?.length ?? 0}
          icon={CalendarDays}
          tone="navy"
          hint={`${upcoming ? t('user.upcomingBooking') : t('user.noActive')}`}
        />
        <StatCard
          label={t('user.vehiclesCount')}
          value={vehicles.data?.length ?? 0}
          icon={Car}
          tone="blue"
          hint={vehicles.data?.find((vehicle) => vehicle.isDefault)?.plate ?? t('user.noVehiclesTitle')}
        />
        <StatCard
          label={t('user.totalSpent')}
          value={formatCompactAmount(paidTotal, language)}
          icon={Wallet}
          tone="gold"
          hint={`${payments.data?.length ?? 0} ${t('nav.payments').toLowerCase()}`}
        />
        <StatCard
          label={t('user.activeSession')}
          value={activeSession ? activeSession.spaceCode : '—'}
          icon={Timer}
          tone={activeSession ? 'green' : 'navy'}
          hint={activeSession ? formatRelative(activeSession.entryAt, language) : t('user.noActive')}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
              <Ticket className="size-4 text-accent" />
              {t('user.upcomingBooking')}
            </h2>
            <Button asChild variant="ghost" size="sm" rightIcon={<ArrowRight />}>
              <Link to="/app/reservations">{t('common.viewAll')}</Link>
            </Button>
          </div>

          {upcoming ? (
            <div className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={upcoming.status} />
                    <Badge tone="outline" size="sm" className="font-mono">
                      {upcoming.reference}
                    </Badge>
                  </div>
                  <h3 className="mt-2.5 font-display text-lg font-semibold text-foreground">
                    {facilityName(upcoming.facilityId)}
                  </h3>
                  <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <MapPin className="size-3.5" />
                    {upcomingFacility ? tx(upcomingFacility.address) : '—'}
                  </p>
                </div>
                <Link
                  to={`/ticket/${upcoming.id}`}
                  className="group flex shrink-0 items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 transition-colors hover:bg-muted"
                >
                  <QrCode className="size-8 text-navy-800 dark:text-gold-300" />
                  <span>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('user.viewTicket')}
                    </span>
                    <span className="font-mono text-xs font-semibold text-foreground">{upcoming.qrToken}</span>
                  </span>
                </Link>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('booking.startAt')}
                  </dt>
                  <dd className="mt-0.5 text-[13px] font-semibold text-foreground">
                    {formatRelative(upcoming.startsAt, language)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('booking.space')}
                  </dt>
                  <dd className="mt-0.5 font-mono text-[13px] font-semibold text-foreground">{upcoming.spaceCode}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('booking.vehicle')}
                  </dt>
                  <dd className="mt-0.5 font-mono text-[13px] font-semibold text-foreground">{upcoming.vehiclePlate}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('booking.total')}
                  </dt>
                  <dd className="mt-0.5 text-[13px] font-semibold text-foreground">
                    {formatAmount(upcoming.totalAmount, language)}
                  </dd>
                </div>
              </dl>
              {upcoming.status !== 'PENDING' && (
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{t('user.validUntil')}</span>
                    <span>{formatTime(upcoming.endsAt, language)}</span>
                  </div>
                  <Progress value={elapsedShare} tone="gold" label={t('user.validUntil')} />
                </div>
              )}
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                icon={<Clock3 />}
                title={t('user.noActive')}
                description={t('user.noActiveText')}
                action={
                  <Button asChild leftIcon={<Plus />}>
                    <Link to="/booking">{t('user.bookNow')}</Link>
                  </Button>
                }
                className="border-0 bg-transparent py-8"
              />
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="font-display text-sm font-semibold text-foreground">{t('user.recentActivity')}</h2>
            <Button asChild variant="ghost" size="icon-sm" aria-label={t('common.viewAll')}>
              <Link to="/app/notifications">
                <ArrowRight />
              </Link>
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {(notifications.data ?? []).slice(0, 5).map((notification) => (
              <li key={notification.id} className="flex gap-3 px-5 py-3.5">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  {notification.kind === 'PAYMENT' ? (
                    <CreditCard className="size-4" />
                  ) : notification.kind === 'ENTRY' || notification.kind === 'EXIT' ? (
                    <Timer className="size-4" />
                  ) : (
                    <CalendarDays className="size-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">{tx(notification.title)}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{tx(notification.body)}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground/80">
                    {formatRelative(notification.createdAt, language)}
                  </p>
                </div>
                {!notification.read && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />}
              </li>
            ))}
            {(notifications.data ?? []).length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-muted-foreground">{t('user.activityEmpty')}</li>
            )}
          </ul>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.55fr]">
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="font-display text-sm font-semibold text-foreground">{t('user.savedVehicles')}</h2>
            <Button asChild variant="ghost" size="sm" rightIcon={<Plus />}>
              <Link to="/app/vehicles">{t('common.add')}</Link>
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {(vehicles.data ?? []).map((vehicle) => (
              <li key={vehicle.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid size-9 place-items-center rounded-lg bg-navy-50 text-navy-700 dark:bg-navy-500/15 dark:text-navy-200">
                  <Car className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[13px] font-semibold text-foreground">{vehicle.plate}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {vehicle.make} {vehicle.model} · {vehicle.color}
                  </p>
                </div>
                {vehicle.isDefault && <Badge tone="gold" size="sm">{t('user.defaultVehicle')}</Badge>}
              </li>
            ))}
            {(vehicles.data ?? []).length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-muted-foreground">{t('user.noVehiclesTitle')}</li>
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="font-display text-sm font-semibold text-foreground">{t('nav.reservations')}</h2>
            <Button asChild variant="ghost" size="sm" rightIcon={<ArrowRight />}>
              <Link to="/app/reservations">{t('common.viewAll')}</Link>
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {(reservations.data ?? []).slice(0, 4).map((reservation) => (
              <li key={reservation.id}>
                <Link
                  to={`/ticket/${reservation.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {facilityName(reservation.facilityId)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {reservation.spaceCode} · {formatRelative(reservation.startsAt, language)}
                    </p>
                  </div>
                  <StatusBadge status={reservation.status} />
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
            {(reservations.data ?? []).length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-muted-foreground">{t('user.noReservationsTitle')}</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
