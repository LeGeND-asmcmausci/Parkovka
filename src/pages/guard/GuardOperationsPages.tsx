import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Clock,
  History,
  ListChecks,
  Plus,
  ShieldAlert,
  Timer,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  useAllReservations,
  useCreateIncident,
  useFacilities,
  useGuardSummary,
  useIncidents,
  useSessions,
} from '@/lib/api/hooks';
import { ApiError } from '@/lib/api/errors';
import { formatAmount, formatDateTime, formatDuration, formatRelative } from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';
import { useAuth } from '@/lib/auth';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import type { Incident, Reservation, ParkingSession } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { PageHeader, StatCard } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { EmptyState, PageSkeleton } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable, type DataColumn } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';

const INCIDENT_TYPE_KEYS: Record<Incident['type'], TranslationKey> = {
  DAMAGE: 'guard.incidentDamage',
  THEFT: 'guard.incidentTheft',
  BLOCKING: 'guard.incidentBlocking',
  EQUIPMENT: 'guard.incidentEquipment',
  OTHER: 'guard.incidentOther',
};

const INCIDENT_TYPES: Incident['type'][] = ['DAMAGE', 'THEFT', 'BLOCKING', 'EQUIPMENT', 'OTHER'];
const INCIDENT_SEVERITIES: Incident['severity'][] = ['LOW', 'MEDIUM', 'HIGH'];

function useScopedFacilities() {
  const { user } = useAuth();
  const facilities = useFacilities();
  const data = useMemo(() => {
    const all = facilities.data ?? [];
    const ids = user?.facilityIds ?? [];
    return ids.length > 0 ? all.filter((facility) => ids.includes(facility.id)) : all;
  }, [facilities.data, user?.facilityIds]);
  return { data, isLoading: facilities.isLoading };
}

function useGuardFacilityFilter(defaultAll = true) {
  const facilities = useScopedFacilities();
  const [facilityId, setFacilityId] = useState(defaultAll ? 'all' : '');
  useEffect(() => {
    if (!defaultAll && !facilityId && facilities.data.length > 0) {
      setFacilityId(facilities.data[0].id);
    }
  }, [defaultAll, facilityId, facilities.data]);
  return { facilityId, setFacilityId, facilities };
}

function FacilitySelect({
  value,
  onChange,
  facilities,
  includeAll = true,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  facilities: ReturnType<typeof useScopedFacilities>;
  includeAll?: boolean;
  label?: string;
}) {
  const { t, tx } = useI18n();
  return (
    <Select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label ?? t('guard.facilitySelect')}
      containerClassName="w-full sm:w-52"
    >
      {includeAll && <option value="all">{t('admin.allFacilities')}</option>}
      {facilities.data.map((facility) => (
        <option key={facility.id} value={facility.id}>
          {tx(facility.name)}
        </option>
      ))}
    </Select>
  );
}

function isToday(value: string) {
  return new Date(value).toDateString() === new Date().toDateString();
}

function durationHours(session: ParkingSession) {
  const end = session.exitAt ? new Date(session.exitAt).getTime() : Date.now();
  return Math.max(0, (end - new Date(session.entryAt).getTime()) / 3_600_000);
}

// ---------- Sessions ----------

export function GuardSessionsPage() {
  const { t, tx, language } = useI18n();
  const { user } = useAuth();
  const summary = useGuardSummary(user?.facilityIds);
  const facilities = useScopedFacilities();
  const { facilityId, setFacilityId } = useGuardFacilityFilter();
  const sessions = useSessions({ status: 'ACTIVE' });

  usePageTitle(t('guard.sessionsTitle'));

  const rows = useMemo(() => {
    const ids = user?.facilityIds ?? [];
    return (sessions.data ?? [])
      .filter((session) => ids.length === 0 || ids.includes(session.facilityId))
      .filter((session) => facilityId === 'all' || session.facilityId === facilityId);
  }, [sessions.data, user?.facilityIds, facilityId]);

  const columns: DataColumn<ParkingSession>[] = [
    {
      id: 'plate',
      header: t('guard.vehiclePlate'),
      primary: true,
      cell: (session) => (
        <div>
          <p className="font-mono text-[13px] font-semibold text-foreground">{session.vehiclePlate}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{session.reference}</p>
        </div>
      ),
      sortValue: (session) => session.vehiclePlate,
    },
    {
      id: 'facility',
      header: t('guard.spaceAssigned'),
      cell: (session) => {
        const facility = facilities.data.find((item) => item.id === session.facilityId);
        return (
          <div>
            <p className="text-[12px] text-foreground">{session.spaceCode}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {facility ? tx(facility.name) : session.facilityId}
            </p>
          </div>
        );
      },
      sortValue: (session) => session.spaceCode,
    },
    {
      id: 'entry',
      header: t('guard.entryTime'),
      cell: (session) => (
        <span className="text-[12px] text-foreground">{formatDateTime(session.entryAt, language)}</span>
      ),
      sortValue: (session) => session.entryAt,
      mobileHidden: true,
    },
    {
      id: 'duration',
      header: t('guard.duration'),
      cell: (session) => (
        <span className="text-[12px] text-muted-foreground">
          {formatDuration(durationHours(session), language)}
        </span>
      ),
      sortValue: (session) => durationHours(session),
    },
    {
      id: 'amount',
      header: t('guard.finalPrice'),
      align: 'right',
      cell: (session) => (
        <div>
          <p className="text-[13px] font-semibold text-foreground">
            {formatAmount(session.amount, language)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {session.paid ? t('status.paid') : t('status.unpaid')}
          </p>
        </div>
      ),
      sortValue: (session) => session.amount,
    },
    {
      id: 'actions',
      header: t('common.actions'),
      align: 'right',
      cell: (session) => (
        <Button asChild variant="outline" size="sm">
          <Link to={`/guard/exit?plate=${encodeURIComponent(session.vehiclePlate)}`}>
            <ArrowUpFromLine />
            {t('guard.confirmExit')}
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('guard.sessionsTitle')} description={t('guard.subtitle')} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t('guard.openSessions')}
          value={summary.data?.activeSessions ?? rows.length}
          icon={ListChecks}
          tone="navy"
        />
        <StatCard
          label={t('guard.entriesToday')}
          value={summary.data?.entriesToday ?? 0}
          icon={ArrowDownToLine}
          tone="green"
        />
        <StatCard
          label={t('guard.freeSpaces')}
          value={summary.data?.freeSpaces ?? 0}
          icon={Timer}
          tone="violet"
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
          searchPlaceholder={`${t('common.search')}…`}
          searchFn={(session, query) =>
            [session.vehiclePlate, session.reference, session.spaceCode]
              .join(' ')
              .toLowerCase()
              .includes(query)
          }
          toolbar={
            <FacilitySelect value={facilityId} onChange={setFacilityId} facilities={facilities} />
          }
          emptyTitle={t('guard.noActiveSession')}
          emptyText={t('guard.noSessionText')}
        />
      )}
    </div>
  );
}

// ---------- Arrivals ----------

export function GuardArrivalsPage() {
  const { t, tx, language } = useI18n();
  const { user } = useAuth();
  const facilities = useScopedFacilities();
  const { facilityId, setFacilityId } = useGuardFacilityFilter();
  const reservations = useAllReservations(facilityId === 'all' ? undefined : facilityId);

  usePageTitle(t('guard.arrivalsTitle'));

  const rows = useMemo(() => {
    const ids = user?.facilityIds ?? [];
    return (reservations.data ?? [])
      .filter((reservation) => ids.length === 0 || ids.includes(reservation.facilityId))
      .filter((reservation) => facilityId === 'all' || reservation.facilityId === facilityId)
      .filter(
        (reservation) =>
          (reservation.status === 'CONFIRMED' || reservation.status === 'PENDING') &&
          isToday(reservation.startsAt),
      )
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [reservations.data, user?.facilityIds, facilityId]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: rows.length,
      late: rows.filter((reservation) => new Date(reservation.startsAt).getTime() < now).length,
      upcoming: rows.filter((reservation) => new Date(reservation.startsAt).getTime() >= now).length,
    };
  }, [rows]);

  const columns: DataColumn<Reservation>[] = [
    {
      id: 'plate',
      header: t('guard.vehiclePlate'),
      primary: true,
      cell: (reservation) => (
        <div>
          <p className="font-mono text-[13px] font-semibold text-foreground">
            {reservation.vehiclePlate}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{reservation.reference}</p>
        </div>
      ),
      sortValue: (reservation) => reservation.vehiclePlate,
    },
    {
      id: 'facility',
      header: t('guard.spaceAssigned'),
      cell: (reservation) => {
        const facility = facilities.data.find((item) => item.id === reservation.facilityId);
        return (
          <div>
            <p className="text-[12px] text-foreground">{reservation.spaceCode}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {facility ? tx(facility.name) : reservation.facilityId}
            </p>
          </div>
        );
      },
      sortValue: (reservation) => reservation.spaceCode,
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
      id: 'status',
      header: t('common.status'),
      cell: (reservation) => (
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge status={reservation.status} />
          {new Date(reservation.startsAt).getTime() < Date.now() && (
            <Badge tone="danger" size="sm">
              {t('guard.late')}
            </Badge>
          )}
        </div>
      ),
      sortValue: (reservation) => reservation.startsAt,
    },
    {
      id: 'actions',
      header: t('common.actions'),
      align: 'right',
      cell: (reservation) => (
        <Button asChild variant="outline" size="sm">
          <Link to={`/guard/entry?plate=${encodeURIComponent(reservation.vehiclePlate)}`}>
            <ArrowDownToLine />
            {t('guard.confirmEntry')}
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('guard.arrivalsTitle')} description={t('guard.expectedArrivals')} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('guard.expectedArrivals')} value={stats.total} icon={Clock} tone="navy" />
        <StatCard label={t('guard.upcoming')} value={stats.upcoming} icon={ArrowDownToLine} tone="green" />
        <StatCard label={t('guard.late')} value={stats.late} icon={TriangleAlert} tone="red" />
      </div>

      {reservations.isLoading ? (
        <PageSkeleton />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(reservation) => reservation.id}
          pageSize={10}
          searchPlaceholder={`${t('common.search')}…`}
          searchFn={(reservation, query) =>
            [reservation.vehiclePlate, reservation.reference, reservation.spaceCode]
              .join(' ')
              .toLowerCase()
              .includes(query)
          }
          toolbar={
            <FacilitySelect value={facilityId} onChange={setFacilityId} facilities={facilities} />
          }
          emptyTitle={t('common.noResults')}
          emptyText={t('guard.noArrivals')}
        />
      )}
    </div>
  );
}

// ---------- Departures ----------

type DepartureRow = {
  session: ParkingSession;
  expectedExit?: string;
  overstay: boolean;
};

export function GuardDeparturesPage() {
  const { t, tx, language } = useI18n();
  const { user } = useAuth();
  const facilities = useScopedFacilities();
  const { facilityId, setFacilityId } = useGuardFacilityFilter();
  const sessions = useSessions({ status: 'ACTIVE' });
  const reservations = useAllReservations();

  usePageTitle(t('guard.departuresTitle'));

  const rows = useMemo<DepartureRow[]>(() => {
    const ids = user?.facilityIds ?? [];
    const reservationMap = new Map(
      (reservations.data ?? []).map((reservation) => [reservation.id, reservation]),
    );
    return (sessions.data ?? [])
      .filter((session) => ids.length === 0 || ids.includes(session.facilityId))
      .filter((session) => facilityId === 'all' || session.facilityId === facilityId)
      .map((session) => {
        const reservation = session.reservationId ? reservationMap.get(session.reservationId) : undefined;
        const expectedExit = reservation?.endsAt;
        return {
          session,
          expectedExit,
          overstay: Boolean(expectedExit && new Date(expectedExit).getTime() < Date.now()),
        };
      })
      .sort((a, b) => {
        if (!a.expectedExit && !b.expectedExit) return 0;
        if (!a.expectedExit) return 1;
        if (!b.expectedExit) return -1;
        return new Date(a.expectedExit).getTime() - new Date(b.expectedExit).getTime();
      });
  }, [sessions.data, reservations.data, user?.facilityIds, facilityId]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      today: rows.filter((row) => (row.expectedExit ? isToday(row.expectedExit) : false)).length,
      overstay: rows.filter((row) => row.overstay).length,
    }),
    [rows],
  );

  const columns: DataColumn<DepartureRow>[] = [
    {
      id: 'plate',
      header: t('guard.vehiclePlate'),
      primary: true,
      cell: ({ session }) => (
        <div>
          <p className="font-mono text-[13px] font-semibold text-foreground">{session.vehiclePlate}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{session.reference}</p>
        </div>
      ),
      sortValue: ({ session }) => session.vehiclePlate,
    },
    {
      id: 'space',
      header: t('guard.spaceAssigned'),
      cell: ({ session }) => {
        const facility = facilities.data.find((item) => item.id === session.facilityId);
        return (
          <div>
            <p className="text-[12px] text-foreground">{session.spaceCode}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {facility ? tx(facility.name) : session.facilityId}
            </p>
          </div>
        );
      },
      sortValue: ({ session }) => session.spaceCode,
    },
    {
      id: 'entry',
      header: t('guard.entryTime'),
      cell: ({ session }) => (
        <span className="text-[12px] text-foreground">{formatDateTime(session.entryAt, language)}</span>
      ),
      sortValue: ({ session }) => session.entryAt,
      mobileHidden: true,
    },
    {
      id: 'expected',
      header: t('guard.expectedExit'),
      cell: ({ expectedExit, overstay }) =>
        expectedExit ? (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[12px] text-foreground">{formatDateTime(expectedExit, language)}</span>
            {overstay && (
              <Badge tone="danger" size="sm">
                {t('guard.overstay')}
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-[12px] text-muted-foreground">—</span>
        ),
      sortValue: ({ expectedExit }) => expectedExit ?? '',
    },
    {
      id: 'duration',
      header: t('guard.duration'),
      cell: ({ session }) => (
        <span className="text-[12px] text-muted-foreground">
          {formatDuration(durationHours(session), language)}
        </span>
      ),
      sortValue: ({ session }) => durationHours(session),
      mobileHidden: true,
    },
    {
      id: 'actions',
      header: t('common.actions'),
      align: 'right',
      cell: ({ session }) => (
        <Button asChild variant="outline" size="sm">
          <Link to={`/guard/exit?plate=${encodeURIComponent(session.vehiclePlate)}`}>
            <ArrowUpFromLine />
            {t('guard.confirmExit')}
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('guard.departuresTitle')} description={t('guard.expectedDepartures')} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('guard.expectedDepartures')} value={stats.total} icon={Clock} tone="navy" />
        <StatCard label={t('common.today')} value={stats.today} icon={ArrowUpFromLine} tone="green" />
        <StatCard label={t('guard.overstay')} value={stats.overstay} icon={TriangleAlert} tone="red" />
      </div>

      {sessions.isLoading ? (
        <PageSkeleton />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(row) => row.session.id}
          pageSize={10}
          searchPlaceholder={`${t('common.search')}…`}
          searchFn={(row, query) =>
            [row.session.vehiclePlate, row.session.reference, row.session.spaceCode]
              .join(' ')
              .toLowerCase()
              .includes(query)
          }
          toolbar={
            <FacilitySelect value={facilityId} onChange={setFacilityId} facilities={facilities} />
          }
          emptyTitle={t('common.noResults')}
          emptyText={t('guard.noDepartures')}
        />
      )}
    </div>
  );
}

// ---------- Incidents ----------

type IncidentForm = {
  facilityId: string;
  type: Incident['type'];
  severity: Incident['severity'];
  description: string;
  plate: string;
};

export function GuardIncidentsPage() {
  const { t, tx, language } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const facilities = useScopedFacilities();
  const { facilityId, setFacilityId } = useGuardFacilityFilter();
  const incidents = useIncidents(facilityId === 'all' ? undefined : facilityId);
  const createIncident = useCreateIncident();

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<IncidentForm>({
    facilityId: facilities.data[0]?.id ?? '',
    type: 'DAMAGE',
    severity: 'MEDIUM',
    description: '',
    plate: '',
  });
  const [formError, setFormError] = useState('');

  usePageTitle(t('guard.incidentsTitle'));

  const rows = useMemo(() => {
    const ids = user?.facilityIds ?? [];
    return (incidents.data ?? []).filter(
      (incident) => ids.length === 0 || ids.includes(incident.facilityId),
    );
  }, [incidents.data, user?.facilityIds]);

  const stats = useMemo(
    () => ({
      open: rows.filter((incident) => incident.status === 'OPEN').length,
      high: rows.filter(
        (incident) => incident.status === 'OPEN' && incident.severity === 'HIGH',
      ).length,
      resolved: rows.filter((incident) => incident.status === 'RESOLVED').length,
    }),
    [rows],
  );

  const openForm = () => {
    setForm({
      facilityId:
        facilityId !== 'all' ? facilityId : facilities.data[0]?.id ?? '',
      type: 'DAMAGE',
      severity: 'MEDIUM',
      description: '',
      plate: '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!form.facilityId) {
      setFormError(t('errors.required'));
      return;
    }
    if (form.description.trim().length < 5) {
      setFormError(t('errors.min', { min: 5 }));
      return;
    }
    createIncident.mutate(
      {
        facilityId: form.facilityId,
        type: form.type,
        severity: form.severity,
        description: form.description.trim(),
        plate: form.plate.trim() || undefined,
        reportedBy: user?.fullName ?? 'Guard',
      },
      {
        onSuccess: () => {
          toast.success(t('guard.incidentSuccess'));
          setFormOpen(false);
        },
        onError: (error) =>
          setFormError(error instanceof ApiError ? error.message : t('errors.generic')),
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('guard.incidentsTitle')}
        description={t('guard.reportIncident')}
        actions={
          <Button onClick={openForm}>
            <Plus />
            {t('guard.reportIncident')}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('guard.open')} value={stats.open} icon={AlertTriangle} tone="red" />
        <StatCard label={t('status.high')} value={stats.high} icon={ShieldAlert} tone="gold" />
        <StatCard label={t('guard.resolved')} value={stats.resolved} icon={ListChecks} tone="green" />
      </div>

      <div className="flex justify-end">
        <FacilitySelect value={facilityId} onChange={setFacilityId} facilities={facilities} />
      </div>

      {incidents.isLoading ? (
        <PageSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState icon={<AlertTriangle />} title={t('guard.noIncidents')} />
      ) : (
        <div className="space-y-2">
          {rows.map((incident) => (
            <article key={incident.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                      incident.severity === 'HIGH'
                        ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300'
                        : 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'
                    }`}
                  >
                    <TriangleAlert className="size-4" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[13px] font-semibold text-foreground">
                        {t(INCIDENT_TYPE_KEYS[incident.type])}
                      </h2>
                      <StatusBadge status={incident.status} />
                      <StatusBadge status={incident.severity} />
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      {incident.description}
                    </p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground/80">
                      {incident.reportedBy} · {formatDateTime(incident.createdAt, language)} ·{' '}
                      {formatRelative(incident.createdAt, language)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {incident.plate && (
                    <p className="font-mono text-[12px] font-medium text-foreground">{incident.plate}</p>
                  )}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {facilities.data.find((facility) => facility.id === incident.facilityId)
                      ? tx(
                          facilities.data.find((facility) => facility.id === incident.facilityId)!
                            .name,
                        )
                      : incident.facilityId}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={t('guard.reportIncident')}
        description={t('guard.incidentsTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={createIncident.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="incident-form" loading={createIncident.isPending}>
              {t('guard.submitIncident')}
            </Button>
          </>
        }
      >
        <form id="incident-form" onSubmit={submit} className="space-y-4" noValidate>
          <Field label={t('guard.facilitySelect')} htmlFor="incident-facility" required>
            <Select
              id="incident-facility"
              value={form.facilityId}
              onChange={(event) => setForm((current) => ({ ...current, facilityId: event.target.value }))}
            >
              {facilities.data.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {tx(facility.name)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('guard.incidentType')} htmlFor="incident-type" required>
              <Select
                id="incident-type"
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({ ...current, type: event.target.value as Incident['type'] }))
                }
              >
                {INCIDENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(INCIDENT_TYPE_KEYS[type])}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('guard.severity')} htmlFor="incident-severity" required>
              <Select
                id="incident-severity"
                value={form.severity}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    severity: event.target.value as Incident['severity'],
                  }))
                }
              >
                {INCIDENT_SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {t(
                      (`status.${severity.toLowerCase()}`) as TranslationKey,
                    )}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t('guard.plateLabel')} htmlFor="incident-plate" optionalLabel={t('common.optional')}>
            <Input
              id="incident-plate"
              value={form.plate}
              onChange={(event) =>
                setForm((current) => ({ ...current, plate: event.target.value.toUpperCase() }))
              }
              placeholder={t('guard.platePlaceholder')}
              className="font-mono"
            />
          </Field>
          <Field
            label={t('guard.description')}
            htmlFor="incident-description"
            required
            error={formError}
          >
            <Textarea
              id="incident-description"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              rows={4}
              aria-invalid={Boolean(formError)}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

// ---------- Activity ----------

type ActivityEvent = {
  id: string;
  kind: 'ENTRY' | 'EXIT';
  at: string;
  session: ParkingSession;
};

export function GuardActivityPage() {
  const { t, tx, language } = useI18n();
  const { user } = useAuth();
  const facilities = useScopedFacilities();
  const { facilityId, setFacilityId } = useGuardFacilityFilter();
  const sessions = useSessions({});

  usePageTitle(t('guard.activityTitle'));

  const events = useMemo<ActivityEvent[]>(() => {
    const ids = user?.facilityIds ?? [];
    return (sessions.data ?? [])
      .filter((session) => ids.length === 0 || ids.includes(session.facilityId))
      .filter((session) => facilityId === 'all' || session.facilityId === facilityId)
      .flatMap<ActivityEvent>((session) => [
        { id: `${session.id}-entry`, kind: 'ENTRY', at: session.entryAt, session },
        ...(session.exitAt
          ? [{ id: `${session.id}-exit`, kind: 'EXIT' as const, at: session.exitAt, session }]
          : []),
      ])
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 80);
  }, [sessions.data, user?.facilityIds, facilityId]);

  const stats = useMemo(
    () => ({
      entries: events.filter((event) => event.kind === 'ENTRY').length,
      exits: events.filter((event) => event.kind === 'EXIT').length,
    }),
    [events],
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t('guard.activityTitle')} description={t('guard.subtitle')} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('guard.entriesToday')} value={stats.entries} icon={ArrowDownToLine} tone="green" />
        <StatCard label={t('guard.exitsToday')} value={stats.exits} icon={ArrowUpFromLine} tone="navy" />
        <StatCard label={t('guard.activityTitle')} value={events.length} icon={History} tone="violet" />
      </div>

      <div className="flex justify-end">
        <FacilitySelect value={facilityId} onChange={setFacilityId} facilities={facilities} />
      </div>

      {sessions.isLoading ? (
        <PageSkeleton />
      ) : events.length === 0 ? (
        <EmptyState icon={<History />} title={t('guard.activityEmpty')} />
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-5">
          {events.map((event) => {
            const facility = facilities.data.find((item) => item.id === event.session.facilityId);
            const entry = event.kind === 'ENTRY';
            return (
              <li key={event.id} className="relative">
                <span
                  className={`absolute -left-[27px] top-4 grid size-3 place-items-center rounded-full ring-4 ring-background ${
                    entry ? 'bg-emerald-500' : 'bg-navy-700 dark:bg-gold-500'
                  }`}
                  aria-hidden
                />
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {entry ? (
                        <ArrowDownToLine className="size-4 text-emerald-600 dark:text-emerald-300" />
                      ) : (
                        <ArrowUpFromLine className="size-4 text-navy-700 dark:text-gold-300" />
                      )}
                      <span className="text-[13px] font-semibold text-foreground">
                        {entry ? t('user.entry') : t('user.exit')}
                      </span>
                      <StatusBadge status={event.session.status} />
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(event.at, language)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                    <span className="font-mono font-medium text-foreground">
                      {event.session.vehiclePlate}
                    </span>
                    <span>{event.session.spaceCode}</span>
                    <span>{facility ? tx(facility.name) : event.session.facilityId}</span>
                    <span>{formatDuration(durationHours(event.session), language)}</span>
                    {event.kind === 'EXIT' && (
                      <span>{formatAmount(event.session.amount, language)}</span>
                    )}
                    <Link
                      to={`/guard/exit?plate=${encodeURIComponent(event.session.vehiclePlate)}`}
                      className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-navy-600 hover:underline dark:text-navy-300"
                    >
                      {t('common.details')}
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

