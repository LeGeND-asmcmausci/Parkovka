import { ArrowLeft, CalendarClock, MapPin, ShieldCheck, Ticket } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useFacility, useReservation } from '@/lib/api/hooks';
import { formatFullDateTime } from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { LanguageSwitcher, ThemeToggle } from '@/components/ui/preferences';
import { ErrorState, PageSkeleton } from '@/components/ui/states';
import { TicketCard } from '@/components/tickets/TicketCard';

export function TicketPage() {
  const { id } = useParams();
  const { t, tx, language } = useI18n();
  const reservation = useReservation(id);
  const facility = useFacility(reservation.data?.facilityId);

  usePageTitle(reservation.data ? `${t('qr.ticket')} ${reservation.data.reference}` : t('qr.ticket'));

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border bg-card/85 backdrop-blur-lg print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link to="/" aria-label={t('common.appName')}>
              <Logo />
            </Link>
            <span className="hidden h-5 w-px bg-border sm:block" />
            <span className="hidden items-center gap-1.5 text-[12px] font-medium text-muted-foreground sm:flex">
              <Ticket className="size-3.5" />
              {t('qr.title')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <LanguageSwitcher compact />
            <ThemeToggle />
            <Button asChild variant="outline" size="sm" className="ml-1" leftIcon={<ArrowLeft />}>
              <Link to="/app/tickets">{t('common.back')}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {reservation.isLoading ? (
          <PageSkeleton />
        ) : reservation.isError || !reservation.data ? (
          <ErrorState
            title={t('common.somethingWrong')}
            description={t('qr.invalid')}
            onRetry={() => void reservation.refetch()}
            retryLabel={t('common.tryAgain')}
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr] lg:items-start">
            <div>
              <TicketCard reservation={reservation.data} facility={facility.data} />
            </div>

            <div className="space-y-5 print:hidden">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                  {t('qr.title')}
                </p>
                <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
                  {reservation.data.reference}
                </h1>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {t('qr.subtitle')}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card shadow-sm">
                <div className="border-b border-border px-5 py-4">
                  <h2 className="font-display text-sm font-semibold text-foreground">{t('user.reservationDetails')}</h2>
                </div>
                <dl className="divide-y divide-border px-5">
                  <div className="flex items-start justify-between gap-4 py-3.5">
                    <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="size-4" /> {t('qr.facility')}
                    </dt>
                    <dd className="max-w-[60%] text-right text-sm font-medium text-foreground">
                      {facility.data ? (
                        <Link to={`/facilities/${facility.data.slug}`} className="hover:underline">
                          {tx(facility.data.name)}
                        </Link>
                      ) : (
                        reservation.data.facilityId
                      )}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-3.5">
                    <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarClock className="size-4" /> {t('booking.time')}
                    </dt>
                    <dd className="max-w-[60%] text-right text-sm font-medium text-foreground">
                      {formatFullDateTime(reservation.data.startsAt, language)}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {formatFullDateTime(reservation.data.endsAt, language)}
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-3.5">
                    <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Ticket className="size-4" /> {t('qr.space')}
                    </dt>
                    <dd className="text-right font-mono text-sm font-semibold text-foreground">
                      {reservation.data.spaceCode}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-3.5">
                    <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ShieldCheck className="size-4" /> {t('guard.vehiclePlate')}
                    </dt>
                    <dd className="text-right font-mono text-sm font-semibold text-foreground">
                      {reservation.data.vehiclePlate}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-gold-300/60 bg-gold-50/60 p-4 text-[13px] leading-relaxed text-gold-900 dark:border-gold-500/30 dark:bg-gold-500/10 dark:text-gold-200">
                {t('qr.showThisCode')}. {t('user.qrHint')}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
