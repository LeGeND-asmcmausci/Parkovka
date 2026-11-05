import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Camera,
  CircleCheck,
  Clock,
  KeyRound,
  QrCode,
  ScanLine,
  ShieldAlert,
  SquareParking,
  Timer,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api/errors';
import {
  useAllReservations,
  useCheckIn,
  useCheckOut,
  useFacilities,
  useFacility,
  useGuardSummary,
  useSessions,
  useSpaces,
} from '@/lib/api/hooks';
import { formatAmount, formatDateTime, formatDuration, formatFullDateTime } from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { CheckOutResult, ParkingSession, PaymentMethod, Reservation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { SwitchField } from '@/components/ui/controls';
import { Field, Input } from '@/components/ui/input';
import { PageHeader, StatCard } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { EmptyState, Spinner } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/components/ui/toast';

const PLATE_PATTERN = /^\d{2}[A-Z]\d{3}[A-Z]{2}$/;

function normalizePlate(value: string) {
  return value.toUpperCase().replace(/\s+/g, ' ').trim();
}

function isValidPlate(value: string) {
  return PLATE_PATTERN.test(value.replace(/\s/g, ''));
}

function isActiveReservation(reservation: Reservation | undefined): reservation is Reservation {
  return Boolean(reservation && (reservation.status === 'CONFIRMED' || reservation.status === 'PENDING'));
}

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

function useFacilitySelect(initial?: string) {
  const facilities = useScopedFacilities();
  const [facilityId, setFacilityId] = useState(initial ?? '');
  useEffect(() => {
    if (!facilityId && facilities.data.length > 0) setFacilityId(facilities.data[0].id);
  }, [facilityId, facilities.data]);
  return { facilityId, setFacilityId, facilities };
}

// ---------- Overview ----------

export function GuardOverviewPage() {
  const { t, tx, language } = useI18n();
  const { user } = useAuth();
  const summary = useGuardSummary(user?.facilityIds);
  const sessions = useSessions({ status: 'ACTIVE' });
  const facilities = useScopedFacilities();

  usePageTitle(t('guard.title'));

  const activeSessions = useMemo(() => {
    const all = sessions.data ?? [];
    const ids = user?.facilityIds ?? [];
    return ids.length > 0 ? all.filter((session) => ids.includes(session.facilityId)) : all;
  }, [sessions.data, user?.facilityIds]);

  const quickActions = [
    { to: '/guard/entry', title: t('guard.entryTitle'), icon: ArrowDownToLine, hint: t('guard.entrySubtitle') },
    { to: '/guard/exit', title: t('guard.exitTitle'), icon: ArrowUpFromLine, hint: t('guard.exitSubtitle') },
    { to: '/guard/scan', title: t('guard.scanTitle'), icon: ScanLine, hint: t('guard.qrHint') },
    { to: '/guard/incidents', title: t('guard.incidentsTitle'), icon: ShieldAlert, hint: t('guard.reportIncident') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('guard.title')}
        description={t('guard.subtitle')}
        eyebrow={user ? `${t('nav.shift')} · ${user.fullName}` : undefined}
        actions={
          <Button asChild>
            <Link to="/guard/scan">
              <ScanLine />
              {t('guard.scanQr')}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label={t('guard.entriesToday')}
          value={summary.data?.entriesToday ?? 0}
          icon={ArrowDownToLine}
          tone="green"
          loading={summary.isLoading}
        />
        <StatCard
          label={t('guard.exitsToday')}
          value={summary.data?.exitsToday ?? 0}
          icon={ArrowUpFromLine}
          tone="navy"
          loading={summary.isLoading}
        />
        <StatCard
          label={t('guard.revenueToday')}
          value={formatAmount(summary.data?.revenueToday ?? 0, language)}
          icon={KeyRound}
          tone="gold"
          loading={summary.isLoading}
        />
        <StatCard
          label={t('guard.openSessions')}
          value={summary.data?.activeSessions ?? 0}
          icon={Timer}
          tone="blue"
          loading={summary.isLoading}
        />
        <StatCard
          label={t('guard.freeSpaces')}
          value={summary.data?.freeSpaces ?? 0}
          icon={SquareParking}
          tone="violet"
          loading={summary.isLoading}
        />
        <StatCard
          label={t('admin.openIncidents')}
          value={summary.data?.openIncidents ?? 0}
          icon={TriangleAlert}
          tone="red"
          loading={summary.isLoading}
        />
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold text-foreground">{t('guard.quickActions')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.to}
                to={action.to}
                className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-gold-300 hover:bg-gold-50/30 dark:hover:border-gold-500/40 dark:hover:bg-gold-500/5"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-navy-900 text-gold-400 dark:bg-gold-500 dark:text-navy-950">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[13px] font-semibold text-foreground">
                    {action.title}
                    <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                    {action.hint}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-foreground">{t('guard.openSessions')}</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/guard/sessions">
              {t('common.viewAll')}
              <ArrowRight />
            </Link>
          </Button>
        </div>

        {sessions.isLoading ? (
          <div className="flex min-h-32 items-center justify-center rounded-xl border border-border bg-card">
            <Spinner />
          </div>
        ) : activeSessions.length === 0 ? (
          <EmptyState
            icon={<Timer />}
            title={t('guard.noActiveSession')}
            description={t('guard.noSessionText')}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeSessions.slice(0, 6).map((session) => {
              const facility = facilities.data.find((item) => item.id === session.facilityId);
              const hours = Math.max(
                0,
                (Date.now() - new Date(session.entryAt).getTime()) / 3_600_000,
              );
              return (
                <article key={session.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[13px] font-semibold text-foreground">
                        {session.vehiclePlate}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {facility ? tx(facility.name) : session.facilityId} · {session.spaceCode}
                      </p>
                    </div>
                    <StatusBadge status={session.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(session.entryAt, language)} · {formatDuration(hours, language)}
                    </span>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/guard/exit?plate=${encodeURIComponent(session.vehiclePlate)}`}>
                        {t('guard.confirmExit')}
                      </Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------- Entry ----------

export function GuardEntryPage() {
  const { t, tx, language } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const { facilityId, setFacilityId, facilities } = useFacilitySelect(user?.facilityIds?.[0]);
  const [params] = useSearchParams();
  const initialPlate = params.get('plate') ?? '';
  const [plate, setPlate] = useState(initialPlate);
  const [walkIn, setWalkIn] = useState(false);
  const [spaceId, setSpaceId] = useState('');
  const [error, setError] = useState('');
  const [lastEntry, setLastEntry] = useState<ParkingSession | null>(null);
  const [detecting, setDetecting] = useState(false);

  usePageTitle(t('guard.entryTitle'));

  const spaces = useSpaces({ facilityId }, Boolean(facilityId));
  const available = useMemo(
    () => (spaces.data ?? []).filter((space) => space.status === 'AVAILABLE'),
    [spaces.data],
  );

  const lookup = useMutation({
    mutationFn: (query: string) => api.sessions.lookup(query),
  });

  const checkIn = useCheckIn();
  const expectedArrivals = useAllReservations(facilityId || undefined);

  useEffect(() => {
    if (!walkIn) return;
    if (!spaceId && available.length > 0) setSpaceId(available[0].id);
    if (spaceId && !available.some((space) => space.id === spaceId)) {
      setSpaceId(available[0]?.id ?? '');
    }
  }, [walkIn, spaceId, available]);

  const reservation = lookup.data?.reservation;
  const activeSession = lookup.data?.activeSession;
  const validReservation = isActiveReservation(reservation) ? reservation : null;
  const wrongFacility = Boolean(validReservation && validReservation.facilityId !== facilityId);

  const runLookup = () => {
    setError('');
    const normalized = normalizePlate(plate);
    if (!isValidPlate(normalized)) {
      setError(t('errors.plate'));
      return;
    }
    lookup.mutate(normalized, {
      onSuccess: (data) => {
        if (data.activeSession) setError(t('guard.alreadyInside'));
      },
      onError: (mutationError) =>
        setError(mutationError instanceof ApiError ? mutationError.message : t('errors.generic')),
    });
  };

  const detectPlate = async () => {
    setError('');
    setDetecting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    const candidate = (expectedArrivals.data ?? []).find(
      (item) => item.facilityId === facilityId && isActiveReservation(item),
    );
    if (candidate) {
      setPlate(candidate.vehiclePlate);
      lookup.mutate(candidate.vehiclePlate);
    } else {
      setError(t('guard.cameraUnavailable'));
    }
    setDetecting(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const normalized = normalizePlate(plate);
    if (!isValidPlate(normalized)) {
      setError(t('errors.plate'));
      return;
    }
    if (activeSession) {
      setError(t('guard.alreadyInside'));
      return;
    }
    if (!walkIn) {
      if (!validReservation) {
        setError(t('guard.noActiveSession'));
        return;
      }
      if (wrongFacility) {
        setError(t('guard.reservationOtherFacility'));
        return;
      }
    }
    if (walkIn && !spaceId) {
      setError(t('errors.spaceRequired'));
      return;
    }
    checkIn.mutate(
      {
        facilityId,
        plate: normalized,
        reservationId: walkIn ? undefined : validReservation?.id,
        spaceId: walkIn ? spaceId : undefined,
        guardId: user?.id,
        walkIn,
      },
      {
        onSuccess: (session) => {
          setLastEntry(session);
          toast.success(
            t('guard.entrySuccess'),
            t('guard.entrySuccessText', { plate: session.vehiclePlate, space: session.spaceCode }),
          );
          setPlate('');
          setWalkIn(false);
          setSpaceId('');
          lookup.reset();
        },
        onError: (mutationError) =>
          setError(
            mutationError instanceof ApiError ? mutationError.message : t('errors.generic'),
          ),
      },
    );
  };

  const canSubmit = Boolean(facilityId && plate.trim()) && (walkIn ? Boolean(spaceId) : Boolean(validReservation));
  const currentFacility = facilities.data.find((facility) => facility.id === facilityId);

  return (
    <div className="space-y-6">
      <PageHeader title={t('guard.entryTitle')} description={t('guard.entrySubtitle')} />

      {lastEntry && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-emerald-900 dark:text-emerald-200">
              {t('guard.entrySuccess')}
            </p>
            <p className="mt-0.5 text-[12px] text-emerald-800/80 dark:text-emerald-200/70">
              {t('guard.entrySuccessText', {
                plate: lastEntry.vehiclePlate,
                space: lastEntry.spaceCode,
              })}
            </p>
            <p className="mt-1 text-[11px] text-emerald-800/70 dark:text-emerald-200/60">
              {t('guard.sessionDetails')}: {lastEntry.reference} · {formatDateTime(lastEntry.entryAt, language)}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm" noValidate>
          <Field label={t('guard.facilitySelect')} htmlFor="entry-facility" required>
            <Select
              id="entry-facility"
              value={facilityId}
              onChange={(event) => {
                setFacilityId(event.target.value);
                setSpaceId('');
                lookup.reset();
              }}
            >
              {facilities.data.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {tx(facility.name)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t('guard.plateLabel')}
            htmlFor="entry-plate"
            required
            hint={t('guard.platePlaceholder')}
            error={error}
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="entry-plate"
                value={plate}
                onChange={(event) => {
                  setPlate(event.target.value.toUpperCase());
                  lookup.reset();
                  setError('');
                }}
                placeholder={t('guard.platePlaceholder')}
                className="font-mono tracking-wider"
                autoComplete="off"
                aria-invalid={Boolean(error)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void detectPlate()}
                loading={detecting}
                className="shrink-0"
              >
                <Camera />
                {t('guard.detectPlate')}
              </Button>
            </div>
          </Field>

          <Button
            type="button"
            variant="secondary"
            onClick={runLookup}
            loading={lookup.isPending}
            disabled={!facilityId}
          >
            <KeyRound />
            {t('guard.lookup')}
          </Button>

          <div className="rounded-lg border border-border bg-muted/20 px-3">
            <SwitchField
              id="entry-walkin"
              checked={walkIn}
              onCheckedChange={(checked) => {
                setWalkIn(checked);
                lookup.reset();
                setError('');
              }}
              label={t('guard.walkIn')}
              description={t('guard.walkInPlateHint')}
            />
          </div>

          {lookup.data && (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              {activeSession ? (
                <div className="flex items-start gap-2.5 text-[13px] text-destructive">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <p>{t('guard.alreadyInside')}</p>
                </div>
              ) : validReservation ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-foreground">
                      {t('guard.reservationFound')}
                    </p>
                    <StatusBadge status={validReservation.status} />
                  </div>
                  <p className="font-mono text-[12px] text-foreground">
                    {validReservation.reference} · {validReservation.vehiclePlate}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {t('guard.spaceAssigned')}: {validReservation.spaceCode} ·{' '}
                    {formatDateTime(validReservation.startsAt, language)} –{' '}
                    {formatDateTime(validReservation.endsAt, language)}
                  </p>
                  {wrongFacility && (
                    <p className="text-[12px] font-medium text-destructive">
                      {t('guard.reservationOtherFacility')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">{t('guard.noActiveSession')}</p>
              )}
            </div>
          )}

          {walkIn && (
            <Field label={t('guard.assignSpace')} htmlFor="entry-space" required>
              {available.length === 0 ? (
                <p className="rounded-lg border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  {t('guard.noAvailableSpace')}
                </p>
              ) : (
                <Select
                  id="entry-space"
                  value={spaceId}
                  onChange={(event) => setSpaceId(event.target.value)}
                >
                  {available.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.code}
                    </option>
                  ))}
                </Select>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t('guard.recommendedSpace')}: {available[0]?.code ?? '—'}
              </p>
            </Field>
          )}

          <Button type="submit" className="w-full" loading={checkIn.isPending} disabled={!canSubmit}>
            <ArrowDownToLine />
            {t('guard.confirmEntry')}
          </Button>
        </form>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-[13px] font-semibold text-foreground">{t('guard.shiftSummary')}</h2>
            <dl className="mt-3 divide-y divide-border">
              <div className="flex items-center justify-between py-2">
                <dt className="text-[12px] text-muted-foreground">{t('guard.facilitySelect')}</dt>
                <dd className="text-[12px] font-medium text-foreground">
                  {currentFacility ? tx(currentFacility.name) : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-[12px] text-muted-foreground">{t('guard.freeSpaces')}</dt>
                <dd className="text-[12px] font-medium text-foreground">{available.length}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-[12px] text-muted-foreground">{t('guard.plateLabel')}</dt>
                <dd className="font-mono text-[12px] font-medium text-foreground">{plate || '—'}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------- Exit ----------

export function GuardExitPage() {
  const { t, tx, language } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [plate, setPlate] = useState(params.get('plate') ?? '');
  const [error, setError] = useState('');
  const [pay, setPay] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [lastExit, setLastExit] = useState<CheckOutResult | null>(null);

  usePageTitle(t('guard.exitTitle'));

  const sessions = useSessions({ status: 'ACTIVE' });
  const lookup = useMutation({ mutationFn: (query: string) => api.sessions.lookup(query) });
  const checkOut = useCheckOut();

  const activeSessions = useMemo(() => {
    const all = sessions.data ?? [];
    const ids = user?.facilityIds ?? [];
    return ids.length > 0 ? all.filter((session) => ids.includes(session.facilityId)) : all;
  }, [sessions.data, user?.facilityIds]);

  const found = lookup.data?.activeSession;
  const facility = useFacility(found?.facilityId);

  useEffect(() => {
    setPay(!found?.paid);
  }, [found]);

  const estimate = useMemo(() => {
    if (!found) return 0;
    if (found.amount > 0) return found.amount;
    if (!facility.data) return 0;
    const hours = Math.max(0.25, (Date.now() - new Date(found.entryAt).getTime()) / 3_600_000);
    return Math.round(
      Math.min(facility.data.dailyCap, Math.ceil(hours) * facility.data.hourlyRate) +
        facility.data.reservationFee,
    );
  }, [found, facility.data]);

  const runLookup = (value = plate) => {
    setError('');
    const normalized = normalizePlate(value);
    if (!isValidPlate(normalized)) {
      setError(t('errors.plate'));
      return;
    }
    setPlate(normalized);
    lookup.mutate(normalized, {
      onSuccess: (data) => {
        if (!data.activeSession) setError(t('guard.noActiveSession'));
      },
      onError: (mutationError) =>
        setError(mutationError instanceof ApiError ? mutationError.message : t('errors.generic')),
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!found) {
      runLookup();
      return;
    }
    setError('');
    const shouldPay = !found.paid && pay;
    checkOut.mutate(
      {
        id: found.id,
        input: { pay: shouldPay, method, guardId: user?.id },
      },
      {
        onSuccess: (result) => {
          setLastExit(result);
          toast.success(
            t('guard.exitSuccess'),
            t('guard.exitSuccessText', {
              plate: result.session.vehiclePlate,
              amount: formatAmount(result.session.amount, language),
            }),
          );
          setPlate('');
          lookup.reset();
        },
        onError: (mutationError) =>
          setError(
            mutationError instanceof ApiError ? mutationError.message : t('errors.generic'),
          ),
      },
    );
  };

  const hours = found ? Math.max(0, (Date.now() - new Date(found.entryAt).getTime()) / 3_600_000) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t('guard.exitTitle')} description={t('guard.exitSubtitle')} />

      {lastExit && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
          <div>
            <p className="text-[13px] font-semibold text-emerald-900 dark:text-emerald-200">
              {t('guard.exitSuccess')}
            </p>
            <p className="mt-0.5 text-[12px] text-emerald-800/80 dark:text-emerald-200/70">
              {t('guard.exitSuccessText', {
                plate: lastExit.session.vehiclePlate,
                amount: formatAmount(lastExit.session.amount, language),
              })}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm" noValidate>
          <Field
            label={t('guard.plateLabel')}
            htmlFor="exit-plate"
            required
            hint={t('guard.platePlaceholder')}
            error={error}
          >
            <div className="flex gap-2">
              <Input
                id="exit-plate"
                value={plate}
                onChange={(event) => {
                  setPlate(event.target.value.toUpperCase());
                  lookup.reset();
                  setError('');
                }}
                placeholder={t('guard.platePlaceholder')}
                className="font-mono tracking-wider"
                autoComplete="off"
                aria-invalid={Boolean(error)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => runLookup()}
                loading={lookup.isPending}
                className="shrink-0"
              >
                <KeyRound />
                {t('guard.lookup')}
              </Button>
            </div>
          </Field>

          {found && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[13px] font-semibold text-foreground">
                    {found.vehiclePlate}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {facility.data ? tx(facility.data.name) : found.facilityId} · {found.spaceCode}
                  </p>
                </div>
                <StatusBadge status={found.paid ? 'PAID' : 'UNPAID'} />
              </div>
              <dl className="grid gap-2 border-t border-border pt-3 sm:grid-cols-3">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t('guard.entryTime')}
                  </dt>
                  <dd className="mt-0.5 text-[12px] font-medium text-foreground">
                    {formatDateTime(found.entryAt, language)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t('guard.duration')}
                  </dt>
                  <dd className="mt-0.5 text-[12px] font-medium text-foreground">
                    {formatDuration(hours, language)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t('guard.finalPrice')}
                  </dt>
                  <dd className="mt-0.5 text-[12px] font-semibold text-foreground">
                    {formatAmount(estimate, language)}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {found && !found.paid && (
            <div className="space-y-2 rounded-xl border border-border p-4">
              <SwitchField
                id="exit-pay"
                checked={pay}
                onCheckedChange={setPay}
                label={t('guard.markPaid')}
                description={t('guard.finalPrice')}
              />
              {pay && (
                <Field label={t('guard.paymentStatus')} htmlFor="exit-method">
                  <Select
                    id="exit-method"
                    value={method}
                    onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                  >
                    <option value="CASH">{t('booking.cashAtExit')}</option>
                    <option value="PAYME">{t('booking.payme')}</option>
                    <option value="CLICK">{t('booking.click')}</option>
                    <option value="UZCARD">{t('booking.uzcard')}</option>
                    <option value="HUMO">{t('booking.humo')}</option>
                  </Select>
                </Field>
              )}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={checkOut.isPending}
            disabled={!found}
          >
            <ArrowUpFromLine />
            {t('guard.confirmExit')}
          </Button>
        </form>

        <aside className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
              <Clock className="size-4 text-muted-foreground" />
              {t('guard.expectedDepartures')}
            </h2>
            {sessions.isLoading ? (
              <div className="flex min-h-24 items-center justify-center">
                <Spinner />
              </div>
            ) : activeSessions.length === 0 ? (
              <p className="mt-3 text-[12px] text-muted-foreground">{t('guard.noDepartures')}</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {activeSessions.slice(0, 8).map((session) => (
                  <li key={session.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[12px] font-medium text-foreground">
                        {session.vehiclePlate}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">{session.spaceCode}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => runLookup(session.vehiclePlate)}
                    >
                      {t('guard.lookup')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------- QR scan ----------

type DetectedBarcode = { rawValue: string };
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return ctor ?? null;
}

export function GuardScanPage() {
  const { t, language } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [entryDone, setEntryDone] = useState<ParkingSession | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const intervalRef = useRef<number | null>(null);
  const decodeRef = useRef<(value: string) => void>(() => {});
  const processingRef = useRef(false);

  usePageTitle(t('guard.scanTitle'));

  const lookup = useMutation({ mutationFn: (query: string) => api.sessions.lookup(query) });
  const checkIn = useCheckIn();

  const stopScan = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
    processingRef.current = false;
  };

  useEffect(
    () => () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const submitCode = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError(t('guard.qrInvalid'));
      return;
    }
    stopScan();
    setError('');
    setEntryDone(null);
    lookup.mutate(trimmed, {
      onError: (mutationError) =>
        setError(mutationError instanceof ApiError ? mutationError.message : t('errors.generic')),
    });
  };

  const handleDecoded = (value: string) => {
    if (processingRef.current) return;
    stopScan();
    processingRef.current = true;
    setCode(value);
    submitCode(value);
  };
  decodeRef.current = handleDecoded;

  const startScan = async () => {
    setCameraError('');
    setError('');
    const Detector = getBarcodeDetector();
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(t('qr.cameraUnsupported'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setScanning(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      detectorRef.current = new Detector({ formats: ['qr_code'] });
      processingRef.current = false;
      intervalRef.current = window.setInterval(() => {
        const video = videoRef.current;
        const detector = detectorRef.current;
        if (!video || !detector || video.readyState < 2) return;
        void detector
          .detect(video)
          .then((results) => {
            const value = results[0]?.rawValue;
            if (value) decodeRef.current(value);
          })
          .catch(() => {
            /* transient decode errors are ignored until a code is read */
          });
      }, 600);
    } catch {
      setCameraError(t('qr.cameraDenied'));
      stopScan();
    }
  };

  const reservation = lookup.data?.reservation;
  const activeSession = lookup.data?.activeSession;
  const validReservation = isActiveReservation(reservation) ? reservation : null;

  const confirmEntry = () => {
    if (!validReservation) return;
    checkIn.mutate(
      {
        facilityId: validReservation.facilityId,
        plate: validReservation.vehiclePlate,
        reservationId: validReservation.id,
        guardId: user?.id,
      },
      {
        onSuccess: (session) => {
          setEntryDone(session);
          toast.success(
            t('guard.entrySuccess'),
            t('guard.entrySuccessText', { plate: session.vehiclePlate, space: session.spaceCode }),
          );
          setCode('');
          lookup.reset();
        },
        onError: (mutationError) =>
          setError(
            mutationError instanceof ApiError ? mutationError.message : t('errors.generic'),
          ),
      },
    );
  };

  const invalid = lookup.isSuccess && !validReservation && !activeSession;

  return (
    <div className="space-y-6">
      <PageHeader title={t('guard.scanTitle')} description={t('guard.qrHint')} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="relative overflow-hidden rounded-xl border border-border bg-navy-950">
            <video
              ref={videoRef}
              muted
              playsInline
              className={`aspect-[4/3] w-full object-cover ${scanning ? 'block' : 'hidden'}`}
            />
            {!scanning && (
              <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 text-white/70">
                <span className="grid size-16 place-items-center rounded-2xl border border-white/15 bg-white/5">
                  <QrCode className="size-8" />
                </span>
                <p className="max-w-xs px-6 text-center text-[12px] leading-relaxed">
                  {t('qr.scanHint')}
                </p>
              </div>
            )}
            {scanning && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="size-40 rounded-xl border-2 border-gold-400/80 shadow-[0_0_0_999px_rgba(6,11,25,0.35)]" />
              </div>
            )}
          </div>

          {cameraError && (
            <p className="rounded-lg border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              {cameraError}
            </p>
          )}

          <div className="flex gap-2">
            {scanning ? (
              <Button variant="outline" className="w-full" onClick={stopScan}>
                {t('qr.stopScan')}
              </Button>
            ) : (
              <Button className="w-full" onClick={() => void startScan()}>
                <ScanLine />
                {t('qr.scanButton')}
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <h2 className="text-[13px] font-semibold text-foreground">{t('qr.manualTitle')}</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t('qr.manualHint')}</p>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                submitCode(code);
              }}
            >
              <Input
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase());
                  lookup.reset();
                  setError('');
                }}
                placeholder={t('qr.manualPlaceholder')}
                className="font-mono"
                aria-label={t('guard.qrManual')}
              />
              <Button type="submit" variant="outline" loading={lookup.isPending}>
                {t('qr.validate')}
              </Button>
            </form>
            {error && (
              <p className="mt-2 text-[12px] font-medium text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          {entryDone && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
              <div>
                <p className="text-[13px] font-semibold text-emerald-900 dark:text-emerald-200">
                  {t('guard.entrySuccess')}
                </p>
                <p className="mt-0.5 text-[12px] text-emerald-800/80 dark:text-emerald-200/70">
                  {t('guard.entrySuccessText', {
                    plate: entryDone.vehiclePlate,
                    space: entryDone.spaceCode,
                  })}
                </p>
              </div>
            </div>
          )}

          {lookup.isPending && (
            <div className="flex min-h-40 items-center justify-center rounded-xl border border-border bg-card">
              <Spinner />
            </div>
          )}

          {activeSession && (
            <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="flex items-center gap-2">
                <TriangleAlert className="size-4 text-amber-700 dark:text-amber-300" />
                <h2 className="text-[13px] font-semibold text-amber-900 dark:text-amber-200">
                  {t('guard.alreadyInside')}
                </h2>
              </div>
              <p className="mt-2 font-mono text-[12px] text-amber-900/80 dark:text-amber-200/80">
                {activeSession.vehiclePlate} · {activeSession.spaceCode}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to={`/guard/exit?plate=${encodeURIComponent(activeSession.vehiclePlate)}`}>
                  <ArrowUpFromLine />
                  {t('guard.confirmExit')}
                </Link>
              </Button>
            </div>
          )}

          {validReservation && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                    {t('guard.reservationFound')}
                  </p>
                  <p className="mt-1 font-mono text-[14px] font-semibold text-foreground">
                    {validReservation.reference}
                  </p>
                </div>
                <StatusBadge status={validReservation.status} />
              </div>
              <dl className="mt-3 divide-y divide-border">
                <div className="flex items-center justify-between py-2">
                  <dt className="text-[12px] text-muted-foreground">{t('guard.vehiclePlate')}</dt>
                  <dd className="font-mono text-[12px] font-medium text-foreground">
                    {validReservation.vehiclePlate}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2">
                  <dt className="text-[12px] text-muted-foreground">{t('guard.spaceAssigned')}</dt>
                  <dd className="text-[12px] font-medium text-foreground">
                    {validReservation.spaceCode}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2">
                  <dt className="text-[12px] text-muted-foreground">{t('booking.time')}</dt>
                  <dd className="text-right text-[12px] font-medium text-foreground">
                    {formatFullDateTime(validReservation.startsAt, language)}
                    <br />
                    {formatFullDateTime(validReservation.endsAt, language)}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2">
                  <dt className="text-[12px] text-muted-foreground">{t('guard.paymentStatus')}</dt>
                  <dd>
                    <StatusBadge status={validReservation.paymentStatus} />
                  </dd>
                </div>
              </dl>
              <Button className="mt-3 w-full" loading={checkIn.isPending} onClick={confirmEntry}>
                <ArrowDownToLine />
                {t('guard.confirmEntry')}
              </Button>
            </div>
          )}

          {invalid && (
            <EmptyState icon={<QrCode />} title={t('qr.invalid')} description={t('guard.qrInvalid')} />
          )}

          {!activeSession && !validReservation && !entryDone && !lookup.isPending && !invalid && (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
              <QrCode className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-2 text-[12px] text-muted-foreground">{t('qr.manualHint')}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
