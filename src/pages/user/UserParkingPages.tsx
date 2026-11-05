import {
  ArrowRight,
  Car,
  CreditCard,
  Download,
  MapPin,
  Plus,
  QrCode,
  ReceiptText,
  Ticket,
  Timer,
  Wallet,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useCancelReservation,
  useFacilities,
  useMyPayments,
  useMyReservations,
  useSessions,
} from '@/lib/api/hooks';
import { ApiError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth';
import {
  formatAmount,
  formatCompactAmount,
  formatDuration,
  formatFullDateTime,
  formatRelative,
} from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';
import { useI18n } from '@/lib/i18n';
import type { Payment, Reservation, ReservationStatus } from '@/lib/types';
import { downloadTextFile, hoursBetween } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { PageHeader, SegmentedControl, StatCard } from '@/components/ui/misc';
import { EmptyState, PageSkeleton } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable, type DataColumn } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';

function useFacilityNames() {
  const facilities = useFacilities();
  const { tx } = useI18n();
  const byId = useMemo(
    () => new Map((facilities.data ?? []).map((facility) => [facility.id, facility])),
    [facilities.data],
  );
  return {
    name: (id: string | undefined) => {
      const facility = id ? byId.get(id) : undefined;
      return facility ? tx(facility.name) : (id ?? '—');
    },
  };
}

export function ActiveParkingPage() {
  const { t, tx, language } = useI18n();
  const { user } = useAuth();
  const sessions = useSessions({ userId: user?.id });
  const facilities = useFacilities();
  usePageTitle(t('nav.activeParking'));

  const facilityById = new Map((facilities.data ?? []).map((facility) => [facility.id, facility]));
  const active = (sessions.data ?? []).filter((session) => session.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('nav.myArea')}
        title={t('nav.activeParking')}
        description={t('user.overviewSubtitle')}
        actions={
          <Button asChild variant="outline" leftIcon={<Plus />}>
            <Link to="/booking">{t('user.bookNow')}</Link>
          </Button>
        }
      />

      {sessions.isLoading ? (
        <PageSkeleton />
      ) : active.length === 0 ? (
        <EmptyState
          icon={<Timer />}
          title={t('user.noActive')}
          description={t('user.noActiveText')}
          action={
            <Button asChild leftIcon={<Plus />}>
              <Link to="/booking">{t('user.bookNow')}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {active.map((session) => {
            const facility = facilityById.get(session.facilityId);
            const hours = hoursBetween(session.entryAt, new Date().toISOString());
            return (
              <article key={session.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="relative bg-navy-950 px-5 py-4 text-white">
                  <div className="grid-lines pointer-events-none absolute inset-0 opacity-40" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                        {t('user.activeSession')}
                      </p>
                      <h2 className="mt-1 font-display text-lg font-semibold">{tx(facility?.name)}</h2>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-white/60">
                        <MapPin className="size-3" /> {facility ? tx(facility.address) : '—'}
                      </p>
                    </div>
                    <Badge tone="success" dot className="border-white/15 bg-white/10 text-white">
                      {t('status.active')}
                    </Badge>
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('guard.spaceAssigned')}
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-foreground">{session.spaceCode}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('guard.vehiclePlate')}
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-foreground">{session.vehiclePlate}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('guard.entryTime')}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">
                        {formatFullDateTime(session.entryAt, language)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('guard.duration')}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">{formatDuration(hours, language)}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t('guard.finalPrice')}:</span>
                      <span className="font-display text-lg font-semibold text-foreground">
                        {formatAmount(session.amount, language)}
                      </span>
                      <StatusBadge status={session.paid ? 'PAID' : 'UNPAID'} />
                    </div>
                    <div className="flex gap-2">
                      {session.reservationId && (
                        <Button asChild variant="outline" size="sm" leftIcon={<QrCode />}>
                          <Link to={`/ticket/${session.reservationId}`}>{t('user.viewTicket')}</Link>
                        </Button>
                      )}
                      <Button asChild size="sm" leftIcon={<Wallet />}>
                        <Link to="/app/payments">{t('nav.payments')}</Link>
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                    {language === 'uz'
                      ? 'Chiqishda darvozadagi qo‘riqchiga avtomobil raqamini ko‘rsating.'
                      : language === 'ru'
                        ? 'При выезде покажите номер автомобиля охраннику на выезде.'
                        : 'Show your plate to the guard at the exit gate.'}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

const RESERVATION_FILTERS: { value: 'ALL' | ReservationStatus; labelKey: 'common.all' | 'status.pending' | 'status.confirmed' | 'status.active' | 'status.completed' | 'status.cancelled' }[] = [
  { value: 'ALL', labelKey: 'common.all' },
  { value: 'CONFIRMED', labelKey: 'status.confirmed' },
  { value: 'ACTIVE', labelKey: 'status.active' },
  { value: 'COMPLETED', labelKey: 'status.completed' },
  { value: 'CANCELLED', labelKey: 'status.cancelled' },
];

export function ReservationsPage() {
  const { t, language } = useI18n();
  const { name } = useFacilityNames();
  const reservations = useMyReservations();
  const cancel = useCancelReservation();
  const toast = useToast();
  const [filter, setFilter] = useState<'ALL' | ReservationStatus>('ALL');
  const [pending, setPending] = useState<Reservation | null>(null);
  usePageTitle(t('nav.reservations'));

  const rows = (reservations.data ?? []).filter(
    (reservation) => filter === 'ALL' || reservation.status === filter,
  );

  const columns: DataColumn<Reservation>[] = [
    {
      id: 'reference',
      header: t('booking.ticketNumber'),
      cell: (row) => (
        <div>
          <p className="font-mono text-[13px] font-semibold text-foreground">{row.reference}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{name(row.facilityId)}</p>
        </div>
      ),
      sortValue: (row) => row.reference,
    },
    {
      id: 'space',
      header: t('booking.space'),
      cell: (row) => (
        <div>
          <p className="font-mono text-[13px] font-semibold text-foreground">{row.spaceCode}</p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{row.vehiclePlate}</p>
        </div>
      ),
    },
    {
      id: 'time',
      header: t('booking.time'),
      cell: (row) => (
        <div>
          <p className="text-[13px] text-foreground">{formatFullDateTime(row.startsAt, language)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatFullDateTime(row.endsAt, language)}</p>
        </div>
      ),
      sortValue: (row) => row.startsAt,
    },
    {
      id: 'amount',
      header: t('booking.total'),
      cell: (row) => (
        <div>
          <p className="text-[13px] font-semibold text-foreground">{formatAmount(row.totalAmount, language)}</p>
          <StatusBadge status={row.paymentStatus} />
        </div>
      ),
      sortValue: (row) => row.totalAmount,
      align: 'right',
    },
    {
      id: 'status',
      header: t('common.status'),
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: 'actions',
      header: t('common.actions'),
      mobileHidden: true,
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button asChild variant="outline" size="sm">
            <Link to={`/ticket/${row.id}`}>{t('common.view')}</Link>
          </Button>
          {(row.status === 'PENDING' || row.status === 'CONFIRMED') && (
            <Button variant="danger-ghost" size="sm" onClick={() => setPending(row)}>
              {t('common.cancel')}
            </Button>
          )}
        </div>
      ),
      align: 'right',
    },
  ];

  const confirmCancel = () => {
    if (!pending) return;
    cancel.mutate(pending.id, {
      onSuccess: () => {
        toast.success(t('user.cancelled'));
        setPending(null);
      },
      onError: (error) => {
        toast.error(t('common.somethingWrong'), error instanceof ApiError ? error.message : undefined);
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('nav.myArea')}
        title={t('nav.reservations')}
        description={t('user.overviewSubtitle')}
        actions={
          <Button asChild leftIcon={<Plus />}>
            <Link to="/booking">{t('user.bookNow')}</Link>
          </Button>
        }
      />

      <SegmentedControl
        options={RESERVATION_FILTERS.map((item) => ({ value: item.value, label: t(item.labelKey) }))}
        value={filter}
        onChange={setFilter}
        ariaLabel={t('common.filters')}
      />

      {reservations.isLoading ? (
        <PageSkeleton />
      ) : reservations.isError ? (
        <EmptyState
          title={t('common.somethingWrong')}
          description={t('errors.network')}
          action={
            <Button variant="outline" onClick={() => void reservations.refetch()}>
              {t('common.tryAgain')}
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Ticket />}
          title={t('user.noReservationsTitle')}
          description={t('user.noReservationsText')}
          action={
            <Button asChild leftIcon={<Plus />}>
              <Link to="/booking">{t('user.bookNow')}</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <DataTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.id}
            searchPlaceholder={t('common.search')}
            searchFn={(row, query) =>
              [row.reference, row.spaceCode, row.vehiclePlate, name(row.facilityId)]
                .join(' ')
                .toLowerCase()
                .includes(query)
            }
            pageSize={8}
          />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => !open && setPending(null)}
        title={t('user.cancelReservation')}
        description={t('user.cancelConfirm')}
        confirmLabel={t('user.cancelReservation')}
        cancelLabel={t('common.back')}
        onConfirm={confirmCancel}
        loading={cancel.isPending}
        tone="danger"
      />
    </div>
  );
}

export function TicketsPage() {
  const { t, language } = useI18n();
  const { name } = useFacilityNames();
  const reservations = useMyReservations();
  usePageTitle(t('nav.tickets'));

  const tickets = (reservations.data ?? []).filter((reservation) =>
    ['PENDING', 'CONFIRMED', 'ACTIVE'].includes(reservation.status),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('nav.myArea')}
        title={t('user.qrTitle')}
        description={t('user.qrSubtitle')}
        actions={
          <Button asChild variant="outline" leftIcon={<Plus />}>
            <Link to="/booking">{t('user.bookNow')}</Link>
          </Button>
        }
      />

      {reservations.isLoading ? (
        <PageSkeleton />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<QrCode />}
          title={t('user.noReservationsTitle')}
          description={t('user.noReservationsText')}
          action={
            <Button asChild leftIcon={<Plus />}>
              <Link to="/booking">{t('user.bookNow')}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tickets.map((reservation) => (
            <article
              key={reservation.id}
              className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
                <span className="font-mono text-xs font-semibold text-foreground">{reservation.reference}</span>
                <StatusBadge status={reservation.status} />
              </div>
              <div className="flex items-center gap-4 p-4">
                <div className="shrink-0 rounded-lg border border-border bg-white p-2">
                  <QRCodeSVG
                    value={reservation.qrToken}
                    size={84}
                    level="M"
                    marginSize={0}
                    bgColor="#ffffff"
                    fgColor="#0b1b33"
                    aria-label={reservation.qrToken}
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {name(reservation.facilityId)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatFullDateTime(reservation.startsAt, language)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {reservation.spaceCode} · {reservation.vehiclePlate}
                  </p>
                  <p className="mt-2 font-mono text-[11px] font-semibold tracking-wider text-accent">
                    {reservation.qrToken}
                  </p>
                </div>
              </div>
              <div className="border-t border-border px-4 py-3">
                <Link
                  to={`/ticket/${reservation.id}`}
                  className="flex items-center justify-between text-[13px] font-medium text-navy-700 transition-colors hover:text-navy-900 dark:text-gold-300"
                >
                  {t('user.viewTicket')}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

const METHOD_LABEL: Record<Payment['method'], string> = {
  PAYME: 'Payme',
  CLICK: 'Click',
  UZCARD: 'Uzcard',
  HUMO: 'Humo',
  CASH: 'Naqd',
};

export function PaymentsPage() {
  const { t, language } = useI18n();
  const { name } = useFacilityNames();
  const payments = useMyPayments();
  const toast = useToast();
  usePageTitle(t('nav.payments'));

  const rows = payments.data ?? [];
  const paid = rows.filter((payment) => payment.status === 'PAID');
  const total = paid.reduce((sum, payment) => sum + payment.amount, 0);
  const monthTotal = paid
    .filter((payment) => new Date(payment.createdAt).getMonth() === new Date().getMonth())
    .reduce((sum, payment) => sum + payment.amount, 0);

  const downloadReceipt = (payment: Payment) => {
    const lines = [
      'PARKOVKA — KVITANSIYA',
      '=====================',
      `${t('qr.reference')}: ${payment.reference}`,
      `${t('qr.facility')}: ${name(payment.facilityId)}`,
      `${t('admin.date')}: ${formatFullDateTime(payment.paidAt ?? payment.createdAt, language)}`,
      `${t('admin.paymentMethod')}: ${METHOD_LABEL[payment.method]}`,
      `${t('admin.amount')}: ${formatAmount(payment.amount, language)}`,
      `${t('common.status')}: ${payment.status}`,
      '',
      'Hello@parkovka.uz · +998 71 200 05 55',
    ];
    downloadTextFile(`${payment.reference}.txt`, lines.join('\n'));
    toast.success(t('admin.fileDownloaded'));
  };

  const columns: DataColumn<Payment>[] = [
    {
      id: 'reference',
      header: t('qr.reference'),
      cell: (row) => (
        <div>
          <p className="font-mono text-[13px] font-semibold text-foreground">{row.reference}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{name(row.facilityId)}</p>
        </div>
      ),
      sortValue: (row) => row.reference,
    },
    {
      id: 'date',
      header: t('admin.date'),
      cell: (row) => (
        <span className="text-[13px] text-foreground">
          {formatFullDateTime(row.paidAt ?? row.createdAt, language)}
        </span>
      ),
      sortValue: (row) => row.createdAt,
    },
    {
      id: 'method',
      header: t('admin.paymentMethod'),
      cell: (row) => <Badge tone="outline">{METHOD_LABEL[row.method]}</Badge>,
    },
    {
      id: 'amount',
      header: t('admin.amount'),
      cell: (row) => (
        <span className="font-semibold text-foreground">{formatAmount(row.amount, language)}</span>
      ),
      sortValue: (row) => row.amount,
      align: 'right',
    },
    {
      id: 'status',
      header: t('common.status'),
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: 'actions',
      header: t('common.actions'),
      mobileHidden: true,
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          {row.status === 'PAID' && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download />}
              onClick={() => downloadReceipt(row)}
            >
              {t('user.downloadReceipt')}
            </Button>
          )}
          {row.reservationId && (
            <Button asChild variant="ghost" size="sm">
              <Link to={`/ticket/${row.reservationId}`}>{t('common.view')}</Link>
            </Button>
          )}
        </div>
      ),
      align: 'right',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('nav.myArea')}
        title={t('nav.payments')}
        description={t('user.receiptSubtitle')}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('common.total')} value={formatCompactAmount(total, language)} icon={Wallet} tone="gold" />
        <StatCard label={t('admin.todayRevenue')} value={formatCompactAmount(monthTotal, language)} icon={CreditCard} tone="blue" />
        <StatCard label={t('nav.receipts')} value={paid.length} icon={ReceiptText} tone="navy" />
      </div>

      {payments.isLoading ? (
        <PageSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ReceiptText />}
          title={t('user.noPaymentsTitle')}
          description={t('user.noPaymentsText')}
          action={
            <Button asChild leftIcon={<Car />}>
              <Link to="/search">{t('nav.search')}</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <DataTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.id}
            searchPlaceholder={t('common.search')}
            searchFn={(row, query) =>
              [row.reference, row.method, METHOD_LABEL[row.method], name(row.facilityId)]
                .join(' ')
                .toLowerCase()
                .includes(query)
            }
            pageSize={8}
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {formatRelative(new Date().toISOString(), language)} · {t('admin.lastSynced')}
      </p>
    </div>
  );
}
