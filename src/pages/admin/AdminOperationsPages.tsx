import {
  Banknote,
  CalendarDays,
  Download,
  Eye,
  Plus,
  ReceiptText,
  ShieldCheck,
  Timer,
  UserCog,
  Users,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import {
  useAdminUsers,
  useAllPayments,
  useAllReservations,
  useCreateAdminUser,
  useFacilities,
  useSessions,
  useUpdateUser,
} from '@/lib/api/hooks';
import { ApiError } from '@/lib/api/errors';
import { formatAmount, formatDateTime, formatDuration } from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import type {
  Payment,
  PaymentMethod,
  ParkingSession,
  Reservation,
  ReservationStatus,
  Role,
  User,
} from '@/lib/types';
import { downloadTextFile } from '@/lib/utils';
import { Avatar } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckboxField } from '@/components/ui/controls';
import { ConfirmDialog, Modal } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { DetailRow, PageHeader, StatCard } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { PageSkeleton } from '@/components/ui/states';
import { RoleBadge, StatusBadge } from '@/components/ui/status-badge';
import { DataTable, type DataColumn } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';

const METHOD_KEYS: Record<PaymentMethod, TranslationKey> = {
  PAYME: 'booking.payme',
  CLICK: 'booking.click',
  UZCARD: 'booking.uzcard',
  HUMO: 'booking.humo',
  CASH: 'booking.cashAtExit',
};

const RESERVATION_STATUSES: ReservationStatus[] = [
  'PENDING',
  'CONFIRMED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'NO_SHOW',
];

const RESERVATION_STATUS_KEYS: Record<ReservationStatus, TranslationKey> = {
  PENDING: 'status.pending',
  CONFIRMED: 'status.confirmed',
  ACTIVE: 'status.active',
  COMPLETED: 'status.completed',
  CANCELLED: 'status.cancelled',
  EXPIRED: 'status.expired',
  NO_SHOW: 'status.noShow',
};

function csvCell(value: string | number) {
  const text = String(value).replace(/"/g, '""');
  return /[",\n;]/.test(text) ? `"${text}"` : text;
}

function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const content = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  downloadTextFile(filename, content, 'text/csv');
}

function useFacilityLookup() {
  const { tx } = useI18n();
  const facilities = useFacilities();
  const map = useMemo(
    () => new Map((facilities.data ?? []).map((facility) => [facility.id, facility])),
    [facilities.data],
  );
  return {
    data: facilities.data ?? [],
    get: (id: string) => map.get(id),
    name: (id: string) => {
      const facility = map.get(id);
      return facility ? tx(facility.name) : id;
    },
  };
}

function useUserLookup() {
  const users = useAdminUsers();
  const map = useMemo(
    () => new Map((users.data ?? []).map((user) => [user.id, user])),
    [users.data],
  );
  return {
    data: users.data ?? [],
    name: (id?: string) => (id ? map.get(id)?.fullName ?? '—' : '—'),
    get: (id?: string) => (id ? map.get(id) : undefined),
  };
}

// ---------- Reservations ----------

export function AdminReservationsPage() {
  const { t, tx, language } = useI18n();
  const toast = useToast();
  const facilities = useFacilityLookup();
  const users = useUserLookup();
  const [facilityId, setFacilityId] = useState('all');
  const [status, setStatus] = useState<'ALL' | ReservationStatus>('ALL');
  const [selected, setSelected] = useState<Reservation | null>(null);

  usePageTitle(t('admin.reservationsTitle'));

  const reservations = useAllReservations(facilityId === 'all' ? undefined : facilityId);
  const rows = useMemo(
    () =>
      (reservations.data ?? []).filter(
        (reservation) => status === 'ALL' || reservation.status === status,
      ),
    [reservations.data, status],
  );

  const exportCsv = () => {
    downloadCsv(
      'parkovka-reservations.csv',
      ['Reference', 'Customer', 'Facility', 'Space', 'Plate', 'Start', 'End', 'Amount', 'Status'],
      rows.map((reservation) => [
        reservation.reference,
        users.name(reservation.userId),
        facilities.name(reservation.facilityId),
        reservation.spaceCode,
        reservation.vehiclePlate,
        formatDateTime(reservation.startsAt, language),
        formatDateTime(reservation.endsAt, language),
        reservation.totalAmount,
        reservation.status,
      ]),
    );
    toast.success(t('admin.fileDownloaded'));
  };

  const columns: DataColumn<Reservation>[] = [
    {
      id: 'reference',
      header: t('qr.reference'),
      primary: true,
      cell: (reservation) => (
        <div>
          <p className="font-mono text-[12px] font-semibold text-foreground">{reservation.reference}</p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{reservation.vehiclePlate}</p>
        </div>
      ),
      sortValue: (reservation) => reservation.reference,
    },
    {
      id: 'customer',
      header: t('auth.fullName'),
      cell: (reservation) => (
        <span className="text-[13px] text-foreground">{users.name(reservation.userId)}</span>
      ),
      sortValue: (reservation) => users.name(reservation.userId),
    },
    {
      id: 'facility',
      header: t('admin.facility'),
      cell: (reservation) => (
        <div>
          <p className="text-[13px] text-foreground">{facilities.name(reservation.facilityId)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{reservation.spaceCode}</p>
        </div>
      ),
      sortValue: (reservation) => facilities.name(reservation.facilityId),
      mobileHidden: true,
    },
    {
      id: 'window',
      header: t('booking.time'),
      cell: (reservation) => (
        <div>
          <p className="text-[12px] text-foreground">{formatDateTime(reservation.startsAt, language)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {formatDateTime(reservation.endsAt, language)}
          </p>
        </div>
      ),
      sortValue: (reservation) => reservation.startsAt,
      mobileHidden: true,
    },
    {
      id: 'amount',
      header: t('admin.amount'),
      align: 'right',
      cell: (reservation) => (
        <span className="text-[13px] font-semibold text-foreground">
          {formatAmount(reservation.totalAmount, language)}
        </span>
      ),
      sortValue: (reservation) => reservation.totalAmount,
    },
    {
      id: 'status',
      header: t('common.status'),
      cell: (reservation) => <StatusBadge status={reservation.status} />,
      sortValue: (reservation) => reservation.status,
    },
    {
      id: 'actions',
      header: t('common.actions'),
      align: 'right',
      cell: (reservation) => (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('common.view')}
          onClick={(event) => {
            event.stopPropagation();
            setSelected(reservation);
          }}
        >
          <Eye />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.reservationsTitle')}
        description={t('admin.reservationsSubtitle')}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download />
            {t('admin.exportCsv')}
          </Button>
        }
      />

      {reservations.isLoading ? (
        <PageSkeleton />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(reservation) => reservation.id}
          pageSize={10}
          onRowClick={setSelected}
          searchPlaceholder={`${t('common.search')}…`}
          searchFn={(reservation, query) =>
            [
              reservation.reference,
              reservation.vehiclePlate,
              reservation.spaceCode,
              users.name(reservation.userId),
              facilities.name(reservation.facilityId),
            ]
              .join(' ')
              .toLowerCase()
              .includes(query)
          }
          toolbar={
            <>
              <Select
                value={facilityId}
                onChange={(event) => setFacilityId(event.target.value)}
                aria-label={t('admin.facility')}
                containerClassName="w-full sm:w-48"
              >
                <option value="all">{t('admin.allFacilities')}</option>
                {facilities.data.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {tx(facility.name)}
                  </option>
                ))}
              </Select>
              <Select
                value={status}
                onChange={(event) => setStatus(event.target.value as 'ALL' | ReservationStatus)}
                aria-label={t('common.status')}
                containerClassName="w-full sm:w-40"
              >
                <option value="ALL">{t('common.all')}</option>
                {RESERVATION_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {t(RESERVATION_STATUS_KEYS[item])}
                  </option>
                ))}
              </Select>
            </>
          }
          emptyTitle={t('user.noReservationsTitle')}
          emptyText={t('user.noReservationsText')}
        />
      )}

      <Modal
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={t('user.reservationDetails')}
        description={selected?.reference}
        footer={
          <Button variant="outline" onClick={() => setSelected(null)}>
            {t('common.close')}
          </Button>
        }
      >
        {selected && (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-mono text-sm font-semibold text-foreground">{selected.reference}</p>
              <StatusBadge status={selected.status} />
            </div>
            <dl className="divide-y divide-border">
              <DetailRow label={t('auth.fullName')}>{users.name(selected.userId)}</DetailRow>
              <DetailRow label={t('auth.phone')}>{users.get(selected.userId)?.phone ?? '—'}</DetailRow>
              <DetailRow label={t('admin.facility')}>{facilities.name(selected.facilityId)}</DetailRow>
              <DetailRow label={t('booking.space')}>{selected.spaceCode}</DetailRow>
              <DetailRow label={t('guard.vehiclePlate')}>
                <span className="font-mono">{selected.vehiclePlate}</span>
              </DetailRow>
              <DetailRow label={t('booking.startAt')}>
                {formatDateTime(selected.startsAt, language)}
              </DetailRow>
              <DetailRow label={t('booking.endAt')}>{formatDateTime(selected.endsAt, language)}</DetailRow>
              <DetailRow label={t('booking.total')}>
                {formatAmount(selected.totalAmount, language)}
              </DetailRow>
              <DetailRow label={t('guard.paymentStatus')}>
                <StatusBadge status={selected.paymentStatus} />
              </DetailRow>
            </dl>
          </>
        )}
      </Modal>
    </div>
  );
}

// ---------- Sessions ----------

export function AdminSessionsPage() {
  const { t, tx, language } = useI18n();
  const toast = useToast();
  const facilities = useFacilityLookup();
  const [facilityId, setFacilityId] = useState('all');
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [selected, setSelected] = useState<ParkingSession | null>(null);

  usePageTitle(t('admin.sessionsTitle'));

  const sessions = useSessions(facilityId === 'all' ? {} : { facilityId });
  const rows = useMemo(
    () =>
      (sessions.data ?? []).filter((session) => status === 'ALL' || session.status === status),
    [sessions.data, status],
  );

  const stats = useMemo(() => {
    const all = sessions.data ?? [];
    const active = all.filter((session) => session.status === 'ACTIVE');
    const completed = all.filter((session) => session.status === 'COMPLETED');
    const durationHours = completed.reduce((sum, session) => {
      if (!session.exitAt) return sum;
      return sum + (new Date(session.exitAt).getTime() - new Date(session.entryAt).getTime()) / 3_600_000;
    }, 0);
    return {
      active: active.length,
      completed: completed.length,
      avgDuration: completed.length ? durationHours / completed.length : 0,
      revenue: all.reduce((sum, session) => sum + session.amount, 0),
    };
  }, [sessions.data]);

  const exportCsv = () => {
    downloadCsv(
      'parkovka-sessions.csv',
      ['Reference', 'Plate', 'Facility', 'Space', 'Entry', 'Exit', 'Amount', 'Paid', 'Status'],
      rows.map((session) => [
        session.reference,
        session.vehiclePlate,
        facilities.name(session.facilityId),
        session.spaceCode,
        formatDateTime(session.entryAt, language),
        session.exitAt ? formatDateTime(session.exitAt, language) : '',
        session.amount,
        session.paid ? 'PAID' : 'UNPAID',
        session.status,
      ]),
    );
    toast.success(t('admin.fileDownloaded'));
  };

  const columns: DataColumn<ParkingSession>[] = [
    {
      id: 'reference',
      header: t('qr.reference'),
      primary: true,
      cell: (session) => (
        <div>
          <p className="font-mono text-[12px] font-semibold text-foreground">{session.reference}</p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{session.vehiclePlate}</p>
        </div>
      ),
      sortValue: (session) => session.reference,
    },
    {
      id: 'facility',
      header: t('admin.facility'),
      cell: (session) => (
        <div>
          <p className="text-[13px] text-foreground">{facilities.name(session.facilityId)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{session.spaceCode}</p>
        </div>
      ),
      sortValue: (session) => facilities.name(session.facilityId),
      mobileHidden: true,
    },
    {
      id: 'entry',
      header: t('guard.entryTime'),
      cell: (session) => (
        <span className="text-[12px] text-foreground">{formatDateTime(session.entryAt, language)}</span>
      ),
      sortValue: (session) => session.entryAt,
    },
    {
      id: 'exit',
      header: t('guard.exitTime'),
      cell: (session) =>
        session.exitAt ? (
          <span className="text-[12px] text-foreground">{formatDateTime(session.exitAt, language)}</span>
        ) : (
          <Badge tone="success" size="sm" dot>
            {t('user.activeNow')}
          </Badge>
        ),
      sortValue: (session) => session.exitAt ?? '',
      mobileHidden: true,
    },
    {
      id: 'duration',
      header: t('guard.duration'),
      cell: (session) => {
        const end = session.exitAt ? new Date(session.exitAt).getTime() : Date.now();
        const hours = (end - new Date(session.entryAt).getTime()) / 3_600_000;
        return <span className="text-[12px] text-muted-foreground">{formatDuration(hours, language)}</span>;
      },
      sortValue: (session) => new Date(session.entryAt).getTime(),
      mobileHidden: true,
    },
    {
      id: 'amount',
      header: t('admin.amount'),
      align: 'right',
      cell: (session) => (
        <div>
          <p className="text-[13px] font-semibold text-foreground">{formatAmount(session.amount, language)}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {session.paid ? t('status.paid') : t('status.unpaid')}
          </p>
        </div>
      ),
      sortValue: (session) => session.amount,
    },
    {
      id: 'status',
      header: t('common.status'),
      cell: (session) => <StatusBadge status={session.status} />,
      sortValue: (session) => session.status,
    },
    {
      id: 'actions',
      header: t('common.actions'),
      align: 'right',
      cell: (session) => (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('common.view')}
          onClick={(event) => {
            event.stopPropagation();
            setSelected(session);
          }}
        >
          <Eye />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.sessionsTitle')}
        description={t('admin.sessionsSubtitle')}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download />
            {t('admin.exportCsv')}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('admin.activeSessions')} value={stats.active} icon={Timer} tone="green" />
        <StatCard label={t('admin.todaySessions')} value={stats.completed} icon={ReceiptText} tone="navy" />
        <StatCard
          label={t('admin.avgDuration')}
          value={formatDuration(stats.avgDuration, language)}
          icon={CalendarDays}
          tone="violet"
        />
        <StatCard
          label={t('admin.revenue')}
          value={formatAmount(stats.revenue, language)}
          icon={Banknote}
          tone="gold"
        />
      </div>

      {sessions.isLoading ? (
        <PageSkeleton />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(session) => session.id}
          pageSize={10}
          onRowClick={setSelected}
          searchPlaceholder={`${t('common.search')}…`}
          searchFn={(session, query) =>
            [session.reference, session.vehiclePlate, session.spaceCode]
              .join(' ')
              .toLowerCase()
              .includes(query)
          }
          toolbar={
            <>
              <Select
                value={facilityId}
                onChange={(event) => setFacilityId(event.target.value)}
                aria-label={t('admin.facility')}
                containerClassName="w-full sm:w-48"
              >
                <option value="all">{t('admin.allFacilities')}</option>
                {facilities.data.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {tx(facility.name)}
                  </option>
                ))}
              </Select>
              <Select
                value={status}
                onChange={(event) => setStatus(event.target.value as 'ALL' | 'ACTIVE' | 'COMPLETED')}
                aria-label={t('common.status')}
                containerClassName="w-full sm:w-40"
              >
                <option value="ALL">{t('common.all')}</option>
                <option value="ACTIVE">{t('status.active')}</option>
                <option value="COMPLETED">{t('status.completed')}</option>
              </Select>
            </>
          }
          emptyTitle={t('guard.noActiveSession')}
          emptyText={t('guard.noSessionText')}
        />
      )}

      <Modal
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={t('guard.sessionDetails')}
        description={selected?.reference}
        footer={
          <Button variant="outline" onClick={() => setSelected(null)}>
            {t('common.close')}
          </Button>
        }
      >
        {selected && (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-mono text-sm font-semibold text-foreground">{selected.reference}</p>
              <StatusBadge status={selected.status} />
            </div>
            <dl className="divide-y divide-border">
              <DetailRow label={t('guard.vehiclePlate')}>
                <span className="font-mono">{selected.vehiclePlate}</span>
              </DetailRow>
              <DetailRow label={t('admin.facility')}>{facilities.name(selected.facilityId)}</DetailRow>
              <DetailRow label={t('guard.spaceAssigned')}>{selected.spaceCode}</DetailRow>
              <DetailRow label={t('guard.entryTime')}>
                {formatDateTime(selected.entryAt, language)}
              </DetailRow>
              <DetailRow label={t('guard.exitTime')}>
                {selected.exitAt ? formatDateTime(selected.exitAt, language) : '—'}
              </DetailRow>
              <DetailRow label={t('admin.amount')}>{formatAmount(selected.amount, language)}</DetailRow>
              <DetailRow label={t('guard.paymentStatus')}>
                <StatusBadge status={selected.paid ? 'PAID' : 'UNPAID'} />
              </DetailRow>
            </dl>
          </>
        )}
      </Modal>
    </div>
  );
}

// ---------- Payments ----------

export function AdminPaymentsPage() {
  const { t, tx, language } = useI18n();
  const toast = useToast();
  const facilities = useFacilityLookup();
  const users = useUserLookup();
  const [facilityId, setFacilityId] = useState('all');
  const [method, setMethod] = useState<'ALL' | PaymentMethod>('ALL');
  const [selected, setSelected] = useState<Payment | null>(null);

  usePageTitle(t('admin.paymentsTitle'));

  const payments = useAllPayments(facilityId === 'all' ? undefined : facilityId);
  const rows = useMemo(
    () =>
      (payments.data ?? []).filter((payment) => method === 'ALL' || payment.method === method),
    [payments.data, method],
  );

  const stats = useMemo(() => {
    const all = payments.data ?? [];
    return {
      paid: all.filter((payment) => payment.status === 'PAID').reduce((sum, payment) => sum + payment.amount, 0),
      refunded: all.filter((payment) => payment.status === 'REFUNDED').length,
      count: all.length,
    };
  }, [payments.data]);

  const exportCsv = () => {
    downloadCsv(
      'parkovka-payments.csv',
      ['Reference', 'Customer', 'Facility', 'Method', 'Amount', 'Status', 'Created'],
      rows.map((payment) => [
        payment.reference,
        users.name(payment.userId),
        facilities.name(payment.facilityId),
        payment.method,
        payment.amount,
        payment.status,
        formatDateTime(payment.createdAt, language),
      ]),
    );
    toast.success(t('admin.fileDownloaded'));
  };

  const columns: DataColumn<Payment>[] = [
    {
      id: 'reference',
      header: t('qr.reference'),
      primary: true,
      cell: (payment) => (
        <span className="font-mono text-[12px] font-semibold text-foreground">{payment.reference}</span>
      ),
      sortValue: (payment) => payment.reference,
    },
    {
      id: 'customer',
      header: t('auth.fullName'),
      cell: (payment) => (
        <div>
          <p className="text-[13px] text-foreground">{users.name(payment.userId)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{facilities.name(payment.facilityId)}</p>
        </div>
      ),
      sortValue: (payment) => users.name(payment.userId),
    },
    {
      id: 'method',
      header: t('admin.paymentMethod'),
      cell: (payment) => <Badge tone="navy" size="sm">{t(METHOD_KEYS[payment.method])}</Badge>,
      sortValue: (payment) => payment.method,
      mobileHidden: true,
    },
    {
      id: 'amount',
      header: t('admin.amount'),
      align: 'right',
      cell: (payment) => (
        <span className="text-[13px] font-semibold text-foreground">
          {formatAmount(payment.amount, language)}
        </span>
      ),
      sortValue: (payment) => payment.amount,
    },
    {
      id: 'status',
      header: t('common.status'),
      cell: (payment) => <StatusBadge status={payment.status} />,
      sortValue: (payment) => payment.status,
    },
    {
      id: 'created',
      header: t('admin.date'),
      cell: (payment) => (
        <span className="text-[12px] text-muted-foreground">{formatDateTime(payment.createdAt, language)}</span>
      ),
      sortValue: (payment) => payment.createdAt,
      mobileHidden: true,
    },
    {
      id: 'actions',
      header: t('common.actions'),
      align: 'right',
      cell: (payment) => (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('common.view')}
          onClick={(event) => {
            event.stopPropagation();
            setSelected(payment);
          }}
        >
          <Eye />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.paymentsTitle')}
        description={t('admin.paymentsSubtitle')}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download />
            {t('admin.exportCsv')}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t('admin.totalRevenue')}
          value={formatAmount(stats.paid, language)}
          icon={Banknote}
          tone="green"
        />
        <StatCard label={t('admin.paymentsTitle')} value={stats.count} icon={ReceiptText} tone="navy" />
        <StatCard label={t('status.refunded')} value={stats.refunded} icon={ShieldCheck} tone="gold" />
      </div>

      {payments.isLoading ? (
        <PageSkeleton />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(payment) => payment.id}
          pageSize={10}
          onRowClick={setSelected}
          searchPlaceholder={`${t('common.search')}…`}
          searchFn={(payment, query) =>
            [
              payment.reference,
              payment.method,
              payment.status,
              users.name(payment.userId),
              facilities.name(payment.facilityId),
            ]
              .join(' ')
              .toLowerCase()
              .includes(query)
          }
          toolbar={
            <>
              <Select
                value={facilityId}
                onChange={(event) => setFacilityId(event.target.value)}
                aria-label={t('admin.facility')}
                containerClassName="w-full sm:w-48"
              >
                <option value="all">{t('admin.allFacilities')}</option>
                {facilities.data.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {tx(facility.name)}
                  </option>
                ))}
              </Select>
              <Select
                value={method}
                onChange={(event) => setMethod(event.target.value as 'ALL' | PaymentMethod)}
                aria-label={t('admin.paymentMethod')}
                containerClassName="w-full sm:w-40"
              >
                <option value="ALL">{t('common.all')}</option>
                {(Object.keys(METHOD_KEYS) as PaymentMethod[]).map((item) => (
                  <option key={item} value={item}>
                    {t(METHOD_KEYS[item])}
                  </option>
                ))}
              </Select>
            </>
          }
          emptyTitle={t('user.noPaymentsTitle')}
          emptyText={t('user.noPaymentsText')}
        />
      )}

      <Modal
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={t('user.receiptTitle')}
        description={selected?.reference}
        footer={
          <Button variant="outline" onClick={() => setSelected(null)}>
            {t('common.close')}
          </Button>
        }
      >
        {selected && (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-mono text-sm font-semibold text-foreground">{selected.reference}</p>
              <StatusBadge status={selected.status} />
            </div>
            <dl className="divide-y divide-border">
              <DetailRow label={t('auth.fullName')}>{users.name(selected.userId)}</DetailRow>
              <DetailRow label={t('admin.facility')}>{facilities.name(selected.facilityId)}</DetailRow>
              <DetailRow label={t('admin.paymentMethod')}>{t(METHOD_KEYS[selected.method])}</DetailRow>
              <DetailRow label={t('admin.amount')}>{formatAmount(selected.amount, language)}</DetailRow>
              <DetailRow label={t('admin.date')}>{formatDateTime(selected.createdAt, language)}</DetailRow>
              <DetailRow label={t('guard.paymentStatus')}>
                {selected.paidAt ? formatDateTime(selected.paidAt, language) : '—'}
              </DetailRow>
            </dl>
          </>
        )}
      </Modal>
    </div>
  );
}

// ---------- Users & guards ----------

type UserFormState = {
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  facilityIds: string[];
};

const emptyUserForm = (role: Role): UserFormState => ({
  fullName: '',
  email: '',
  phone: '',
  role,
  facilityIds: [],
});

function UserManagementPage({ fixedRole }: { fixedRole?: Role }) {
  const { t, tx, language } = useI18n();
  const toast = useToast();
  const facilities = useFacilityLookup();
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyUserForm(fixedRole ?? 'USER'));
  const [formError, setFormError] = useState('');
  const [statusTarget, setStatusTarget] = useState<User | null>(null);

  const users = useAdminUsers(fixedRole ?? (roleFilter === 'ALL' ? undefined : roleFilter));
  const createUser = useCreateAdminUser();
  const updateUser = useUpdateUser();

  const rows = useMemo(
    () => (users.data ?? []).filter((user) => (fixedRole ? user.role === fixedRole : true)),
    [users.data, fixedRole],
  );

  const stats = useMemo(() => {
    const all = users.data ?? [];
    return {
      total: all.length,
      active: all.filter((user) => user.status === 'ACTIVE').length,
      guards: all.filter((user) => user.role === 'GUARD').length,
      admins: all.filter((user) => user.role === 'ADMIN').length,
    };
  }, [users.data]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyUserForm(fixedRole ?? (roleFilter === 'ALL' ? 'USER' : roleFilter)));
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      facilityIds: user.facilityIds ?? [],
    });
    setFormError('');
    setFormOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) {
      setFormError(t('errors.required'));
      return;
    }
    const onError = (error: unknown) =>
      setFormError(error instanceof ApiError ? error.message : t('errors.generic'));

    if (editing) {
      updateUser.mutate(
        {
          id: editing.id,
          patch: {
            fullName: form.fullName.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim(),
            role: form.role,
            facilityIds: form.role === 'GUARD' ? form.facilityIds : undefined,
          },
        },
        {
          onSuccess: () => {
            toast.success(t('user.profileUpdated'));
            setFormOpen(false);
          },
          onError,
        },
      );
      return;
    }

    createUser.mutate(
      {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        role: form.role,
        facilityIds: form.role === 'GUARD' ? form.facilityIds : undefined,
      },
      {
        onSuccess: () => {
          toast.success(t('user.saved'));
          setFormOpen(false);
        },
        onError,
      },
    );
  };

  const toggleStatus = () => {
    if (!statusTarget) return;
    updateUser.mutate(
      {
        id: statusTarget.id,
        patch: { status: statusTarget.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' },
      },
      {
        onSuccess: () => {
          toast.success(t('user.saved'));
          setStatusTarget(null);
        },
        onError: (error) =>
          toast.error(t('common.somethingWrong'), error instanceof ApiError ? error.message : undefined),
      },
    );
  };

  const columns: DataColumn<User>[] = [
    {
      id: 'name',
      header: t('auth.fullName'),
      primary: true,
      cell: (user) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={user.fullName} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">{user.fullName}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ),
      sortValue: (user) => user.fullName,
    },
    ...(fixedRole
      ? []
      : [
          {
            id: 'role',
            header: t('admin.role'),
            cell: (user: User) => <RoleBadge role={user.role} />,
            sortValue: (user: User) => user.role,
          },
        ]),
    {
      id: 'phone',
      header: t('admin.phone'),
      cell: (user) => <span className="text-[12px] text-muted-foreground">{user.phone}</span>,
      sortValue: (user) => user.phone,
      mobileHidden: true,
    },
    ...(fixedRole === 'GUARD'
      ? [
          {
            id: 'facilities',
            header: t('admin.facilities'),
            cell: (user: User) =>
              user.facilityIds && user.facilityIds.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {user.facilityIds.map((facilityId) => (
                    <Badge key={facilityId} tone="outline" size="sm">
                      {facilities.name(facilityId)}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-[12px] text-muted-foreground">{t('admin.noData')}</span>
              ),
            sortValue: (user: User) => user.facilityIds?.length ?? 0,
            mobileHidden: true,
          },
        ]
      : []),
    {
      id: 'status',
      header: t('common.status'),
      cell: (user) => <StatusBadge status={user.status} />,
      sortValue: (user) => user.status,
    },
    {
      id: 'created',
      header: t('admin.date'),
      cell: (user) => (
        <span className="text-[12px] text-muted-foreground">{formatDateTime(user.createdAt, language)}</span>
      ),
      sortValue: (user) => user.createdAt,
      mobileHidden: true,
    },
    {
      id: 'actions',
      header: t('common.actions'),
      align: 'right',
      cell: (user) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('common.edit')}
            onClick={(event) => {
              event.stopPropagation();
              openEdit(user);
            }}
          >
            <UserCog />
          </Button>
          <Button
            variant={user.status === 'ACTIVE' ? 'danger-ghost' : 'ghost'}
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              setStatusTarget(user);
            }}
          >
            {user.status === 'ACTIVE' ? t('admin.suspend') : t('admin.activate')}
          </Button>
        </div>
      ),
    },
  ];

  const title = fixedRole === 'GUARD' ? t('admin.guardsTitle') : t('admin.usersTitle');
  const description = fixedRole === 'GUARD' ? t('admin.guardsSubtitle') : t('admin.usersSubtitle');

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button onClick={openCreate}>
            <Plus />
            {fixedRole === 'GUARD' ? t('admin.addGuard') : t('admin.addUser')}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('admin.usersTitle')} value={stats.total} icon={Users} tone="navy" />
        <StatCard label={t('status.active')} value={stats.active} icon={ShieldCheck} tone="green" />
        <StatCard label={t('admin.guardsTitle')} value={stats.guards} icon={ShieldCheck} tone="gold" />
        <StatCard label={t('auth.roleAdmin')} value={stats.admins} icon={UserCog} tone="violet" />
      </div>

      {users.isLoading ? (
        <PageSkeleton />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(user) => user.id}
          pageSize={10}
          onRowClick={openEdit}
          searchPlaceholder={`${t('common.search')}…`}
          searchFn={(user, query) =>
            [user.fullName, user.email, user.phone, user.role].join(' ').toLowerCase().includes(query)
          }
          toolbar={
            fixedRole ? undefined : (
              <Select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as 'ALL' | Role)}
                aria-label={t('admin.role')}
                containerClassName="w-full sm:w-44"
              >
                <option value="ALL">{t('common.all')}</option>
                <option value="USER">{t('auth.roleUser')}</option>
                <option value="GUARD">{t('auth.roleGuard')}</option>
                <option value="ADMIN">{t('auth.roleAdmin')}</option>
              </Select>
            )
          }
          emptyTitle={t('admin.noData')}
          emptyText={t('common.noResults')}
        />
      )}

      <Modal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setFormError('');
        }}
        title={
          editing
            ? t('admin.editUser')
            : fixedRole === 'GUARD'
              ? t('admin.addGuard')
              : t('admin.addUser')
        }
        description={editing ? editing.email : t('auth.demoHint')}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={createUser.isPending || updateUser.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              loading={createUser.isPending || updateUser.isPending}
              type="submit"
              form="admin-user-form"
            >
              {editing ? t('common.save') : t('common.create')}
            </Button>
          </>
        }
      >
        <form id="admin-user-form" onSubmit={submit} className="space-y-4" noValidate>
          <Field label={t('auth.fullName')} htmlFor="user-fullname" required>
            <Input
              id="user-fullname"
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
              autoComplete="name"
            />
          </Field>
          <Field label={t('admin.email')} htmlFor="user-email" required>
            <Input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              autoComplete="email"
            />
          </Field>
          <Field label={t('admin.phone')} htmlFor="user-phone" required>
            <Input
              id="user-phone"
              type="tel"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="+998 90 123 45 67"
              autoComplete="tel"
            />
          </Field>
          <Field label={t('admin.role')} htmlFor="user-role" required>
            <Select
              id="user-role"
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as Role }))}
              disabled={Boolean(fixedRole)}
            >
              <option value="USER">{t('auth.roleUser')}</option>
              <option value="GUARD">{t('auth.roleGuard')}</option>
              <option value="ADMIN">{t('auth.roleAdmin')}</option>
            </Select>
          </Field>
          {form.role === 'GUARD' && (
            <Field label={t('admin.facilities')} hint={t('admin.guardAssigned')}>
              <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
                {facilities.data.map((facility) => {
                  const checked = form.facilityIds.includes(facility.id);
                  return (
                    <CheckboxField
                      key={facility.id}
                      id={`guard-facility-${facility.id}`}
                      checked={checked}
                      onCheckedChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          facilityIds:
                            value === true
                              ? [...current.facilityIds, facility.id]
                              : current.facilityIds.filter((id) => id !== facility.id),
                        }))
                      }
                      label={tx(facility.name)}
                    />
                  );
                })}
              </div>
            </Field>
          )}
          {formError && (
            <p
              className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] font-medium text-destructive"
              role="alert"
            >
              {formError}
            </p>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={statusTarget !== null}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        title={statusTarget?.status === 'ACTIVE' ? t('admin.suspend') : t('admin.activate')}
        description={
          statusTarget
            ? `${statusTarget.fullName} · ${statusTarget.email}`
            : t('guard.confirmCritical')
        }
        confirmLabel={statusTarget?.status === 'ACTIVE' ? t('admin.suspend') : t('admin.activate')}
        cancelLabel={t('common.cancel')}
        tone={statusTarget?.status === 'ACTIVE' ? 'danger' : 'default'}
        loading={updateUser.isPending}
        onConfirm={toggleStatus}
      />
    </div>
  );
}

export function AdminUsersPage() {
  const { t } = useI18n();
  usePageTitle(t('admin.usersTitle'));
  return <UserManagementPage />;
}

export function AdminGuardsPage() {
  const { t } = useI18n();
  usePageTitle(t('admin.guardsTitle'));
  return <UserManagementPage fixedRole="GUARD" />;
}
