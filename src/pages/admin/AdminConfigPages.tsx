import {
  AlertTriangle,
  Bell,
  Camera as CameraIcon,
  CircleCheck,
  CircleOff,
  Download,
  FileText,
  RefreshCw,
  Save,
  ScrollText,
  ShieldAlert,
  Tags,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAdminStats,
  useAuditLogs,
  useCameras,
  useFacilities,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  usePricing,
  useSystemSettings,
  useToggleCamera,
  useUpdatePricing,
  useUpdateSettings,
} from '@/lib/api/hooks';
import { USE_FIXTURES, resetDemoData } from '@/lib/api';
import { ApiError } from '@/lib/api/errors';
import { formatAmount, formatDateTime, formatNumber, formatRelative } from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';
import { LANGUAGES, useI18n, type TranslationKey } from '@/lib/i18n';
import type { SystemSettings } from '@/lib/api/fixtures';
import type {
  AppNotification,
  AuditLog,
  Camera,
  DashboardStats,
  PaymentMethod,
  PricingRule,
  Role,
} from '@/lib/types';
import { downloadTextFile } from '@/lib/utils';
import {
  OccupancyChart,
  PaymentDistributionChart,
  RevenueChart,
} from '@/components/dashboard/charts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SwitchField } from '@/components/ui/controls';
import { ConfirmDialog, Modal } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { PageHeader, Progress, SegmentedControl, StatCard } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { EmptyState, PageSkeleton, Spinner } from '@/components/ui/states';
import { RoleBadge, StatusBadge } from '@/components/ui/status-badge';
import { DataTable, type DataColumn } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';

const RULE_TYPE_KEYS: Record<PricingRule['type'], TranslationKey> = {
  HOURLY: 'admin.ruleHourly',
  DAILY: 'admin.ruleDaily',
  NIGHT: 'admin.ruleNight',
  EVENT: 'admin.ruleEvent',
};

const CAMERA_TYPE_KEYS: Record<Camera['type'], TranslationKey> = {
  ENTRY: 'admin.cameraEntry',
  EXIT: 'admin.cameraExit',
  SPACE: 'admin.cameraSpace',
};

const NOTIFICATION_KIND_KEYS: Record<AppNotification['kind'], TranslationKey> = {
  RESERVATION: 'notifications.kindReservation',
  PAYMENT: 'notifications.kindPayment',
  SYSTEM: 'notifications.kindSystem',
  INCIDENT: 'notifications.kindIncident',
  ENTRY: 'notifications.kindEntry',
  EXIT: 'notifications.kindExit',
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  PAYME: 'Payme',
  CLICK: 'Click',
  UZCARD: 'Uzcard',
  HUMO: 'Humo',
  CASH: 'Cash',
};

function csvCell(value: string | number) {
  const text = String(value).replace(/"/g, '""');
  return /[",\n;]/.test(text) ? `"${text}"` : text;
}

function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const content = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  downloadTextFile(filename, content, 'text/csv');
}

function useFacilityNames() {
  const { tx } = useI18n();
  const facilities = useFacilities();
  return {
    data: facilities.data ?? [],
    name: (id: string) => {
      const facility = (facilities.data ?? []).find((item) => item.id === id);
      return facility ? tx(facility.name) : id;
    },
  };
}

// ---------- Pricing ----------

export function AdminPricingPage() {
  const { t, tx, language } = useI18n();
  const toast = useToast();
  const { data: rules, isLoading } = usePricing();
  const facilities = useFacilityNames();
  const updatePricing = useUpdatePricing();
  const [facilityId, setFacilityId] = useState('all');
  const [editing, setEditing] = useState<PricingRule | null>(null);
  const [rate, setRate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');

  usePageTitle(t('admin.pricingTitle'));

  const rows = useMemo(
    () => (rules ?? []).filter((rule) => facilityId === 'all' || rule.facilityId === facilityId),
    [rules, facilityId],
  );

  const stats = useMemo(() => {
    const all = rules ?? [];
    return {
      total: all.length,
      active: all.filter((rule) => rule.active).length,
      avg: all.length ? all.reduce((sum, rule) => sum + rule.rate, 0) / all.length : 0,
    };
  }, [rules]);

  const openEditor = (rule: PricingRule) => {
    setEditing(rule);
    setRate(String(rule.rate));
    setStartTime(rule.startTime ?? '');
    setEndTime(rule.endTime ?? '');
    setActive(rule.active);
    setError('');
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const parsedRate = Number(rate);
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      setError(t('errors.min', { min: 0 }));
      return;
    }
    updatePricing.mutate(
      {
        id: editing.id,
        patch: {
          rate: parsedRate,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          active,
        },
      },
      {
        onSuccess: () => {
          toast.success(t('user.saved'));
          setEditing(null);
        },
        onError: (mutationError) =>
          setError(mutationError instanceof ApiError ? mutationError.message : t('errors.generic')),
      },
    );
  };

  const columns: DataColumn<PricingRule>[] = [
    {
      id: 'name',
      header: t('admin.pricingTitle'),
      primary: true,
      cell: (rule) => (
        <div>
          <p className="text-[13px] font-semibold text-foreground">{tx(rule.name)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{facilities.name(rule.facilityId)}</p>
        </div>
      ),
      sortValue: (rule) => tx(rule.name),
    },
    {
      id: 'type',
      header: t('admin.ruleType'),
      cell: (rule) => <Badge tone="navy" size="sm">{t(RULE_TYPE_KEYS[rule.type])}</Badge>,
      sortValue: (rule) => rule.type,
    },
    {
      id: 'rate',
      header: t('admin.rate'),
      align: 'right',
      cell: (rule) => (
        <span className="text-[13px] font-semibold text-foreground">
          {formatAmount(rule.rate, language)}
        </span>
      ),
      sortValue: (rule) => rule.rate,
    },
    {
      id: 'window',
      header: t('facility.openingHours'),
      cell: (rule) =>
        rule.startTime || rule.endTime ? (
          <span className="text-[12px] text-muted-foreground">
            {rule.startTime ?? '—'} – {rule.endTime ?? '—'}
          </span>
        ) : (
          <span className="text-[12px] text-muted-foreground">{t('common.all')}</span>
        ),
      mobileHidden: true,
    },
    {
      id: 'status',
      header: t('common.status'),
      cell: (rule) => (
        <Badge tone={rule.active ? 'success' : 'neutral'} size="sm" dot>
          {rule.active ? t('admin.ruleActive') : t('admin.ruleInactive')}
        </Badge>
      ),
      sortValue: (rule) => (rule.active ? 1 : 0),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      align: 'right',
      cell: (rule) => (
        <Button variant="outline" size="sm" onClick={() => openEditor(rule)}>
          {t('common.edit')}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.pricingTitle')} description={t('admin.pricingSubtitle')} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('admin.pricingTitle')} value={stats.total} icon={Tags} tone="navy" />
        <StatCard label={t('admin.ruleActive')} value={stats.active} icon={CircleCheck} tone="green" />
        <StatCard
          label={t('admin.rate')}
          value={formatAmount(Math.round(stats.avg), language)}
          icon={FileText}
          tone="gold"
        />
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(rule) => rule.id}
          pageSize={10}
          searchPlaceholder={`${t('common.search')}…`}
          searchFn={(rule, query) =>
            [tx(rule.name), rule.type, facilities.name(rule.facilityId)]
              .join(' ')
              .toLowerCase()
              .includes(query)
          }
          toolbar={
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
          }
          emptyTitle={t('admin.noData')}
          emptyText={t('admin.pricingSubtitle')}
        />
      )}

      <Modal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={t('common.edit')}
        description={editing ? tx(editing.name) : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={updatePricing.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="pricing-form" loading={updatePricing.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        {editing && (
          <form id="pricing-form" onSubmit={save} className="space-y-4" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t('admin.facility')}
                </p>
                <p className="mt-0.5 text-[13px] font-medium text-foreground">
                  {facilities.name(editing.facilityId)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t('admin.ruleType')}
                </p>
                <p className="mt-0.5 text-[13px] font-medium text-foreground">
                  {t(RULE_TYPE_KEYS[editing.type])}
                </p>
              </div>
            </div>
            <Field label={t('admin.rate')} htmlFor="pricing-rate" required>
              <Input
                id="pricing-rate"
                type="number"
                min={0}
                step={500}
                value={rate}
                onChange={(event) => setRate(event.target.value)}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('admin.startTime')} htmlFor="pricing-start">
                <Input
                  id="pricing-start"
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </Field>
              <Field label={t('admin.endTime')} htmlFor="pricing-end">
                <Input
                  id="pricing-end"
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </Field>
            </div>
            <SwitchField
              id="pricing-active"
              checked={active}
              onCheckedChange={setActive}
              label={t('admin.ruleActive')}
              description={t('admin.ruleInactive')}
            />
            {error && (
              <p
                className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] font-medium text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}

// ---------- Cameras ----------

export function AdminCamerasPage() {
  const { t, tx, language } = useI18n();
  const toast = useToast();
  const facilities = useFacilityNames();
  const [facilityId, setFacilityId] = useState('all');
  const cameras = useCameras(facilityId === 'all' ? undefined : facilityId);
  const toggleCamera = useToggleCamera();

  usePageTitle(t('admin.camerasTitle'));

  const rows = cameras.data ?? [];
  const stats = useMemo(
    () => ({
      online: rows.filter((camera) => camera.status === 'ONLINE').length,
      offline: rows.filter((camera) => camera.status === 'OFFLINE').length,
      degraded: rows.filter((camera) => camera.status === 'DEGRADED').length,
    }),
    [rows],
  );

  const toggle = (camera: Camera) => {
    toggleCamera.mutate(camera.id, {
      onSuccess: () => toast.success(t('user.saved')),
      onError: (error) =>
        toast.error(t('common.somethingWrong'), error instanceof ApiError ? error.message : undefined),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.camerasTitle')}
        description={t('admin.camerasSubtitle')}
        actions={
          <Select
            value={facilityId}
            onChange={(event) => setFacilityId(event.target.value)}
            aria-label={t('admin.facility')}
            containerClassName="w-full sm:w-56"
          >
            <option value="all">{t('admin.allFacilities')}</option>
            {facilities.data.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {tx(facility.name)}
              </option>
            ))}
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('status.online')} value={stats.online} icon={Wifi} tone="green" />
        <StatCard label={t('status.offline')} value={stats.offline} icon={WifiOff} tone="red" />
        <StatCard label={t('status.degraded')} value={stats.degraded} icon={AlertTriangle} tone="gold" />
      </div>

      {cameras.isLoading ? (
        <PageSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<CameraIcon />}
          title={t('admin.noData')}
          description={t('admin.camerasSubtitle')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((camera) => (
            <article
              key={camera.id}
              className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`grid size-9 place-items-center rounded-lg ${
                      camera.status === 'ONLINE'
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <CameraIcon className="size-[18px]" />
                  </span>
                  <div>
                    <h2 className="text-[13px] font-semibold text-foreground">{camera.name}</h2>
                    <p className="text-[11px] text-muted-foreground">
                      {t(CAMERA_TYPE_KEYS[camera.type])} · {camera.resolution}
                    </p>
                  </div>
                </div>
                <StatusBadge status={camera.status} />
              </div>
              <p className="mt-3 text-[12px] text-muted-foreground">
                {facilities.name(camera.facilityId)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t('admin.lastSeen')}: {formatRelative(camera.lastSeen, language)}
              </p>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-[11px] text-muted-foreground">{camera.id}</span>
                <Button
                  variant={camera.status === 'ONLINE' ? 'outline' : 'primary'}
                  size="sm"
                  loading={toggleCamera.isPending && toggleCamera.variables === camera.id}
                  onClick={() => toggle(camera)}
                >
                  {camera.status === 'ONLINE' ? (
                    <>
                      <CircleOff />
                      {t('admin.cameraDisable')}
                    </>
                  ) : (
                    <>
                      <CircleCheck />
                      {t('admin.cameraEnable')}
                    </>
                  )}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Reports ----------

const RANGE_OPTIONS = [
  { value: '7', labelKey: 'admin.last7' },
  { value: '30', labelKey: 'admin.last30' },
  { value: '90', labelKey: 'admin.last90' },
] as const;

export function AdminReportsPage() {
  const { t, tx, language } = useI18n();
  const toast = useToast();
  const facilities = useFacilityNames();
  const [facilityId, setFacilityId] = useState('all');
  const [days, setDays] = useState<'7' | '30' | '90'>('7');
  const stats = useAdminStats(facilityId === 'all' ? undefined : facilityId, Number(days));

  usePageTitle(t('admin.reportsTitle'));

  const summary = useMemo(() => {
    if (!stats.data) {
      return { revenue: 0, bookings: 0, occupancy: 0, spaces: 0 };
    }
    return {
      revenue: stats.data.revenueSeries.reduce((sum, point) => sum + point.revenue, 0),
      bookings: stats.data.revenueSeries.reduce((sum, point) => sum + point.bookings, 0),
      occupancy: stats.data.occupancySeries.length
        ? stats.data.occupancySeries.reduce((sum, point) => sum + point.occupancy, 0) /
          stats.data.occupancySeries.length
        : 0,
      spaces: stats.data.totalSpaces,
    };
  }, [stats.data]);

  const exportRevenue = () => {
    if (!stats.data) return;
    downloadCsv(
      'parkovka-revenue-report.csv',
      ['Date', 'Revenue', 'Bookings'],
      stats.data.revenueSeries.map((point) => [point.date, point.revenue, point.bookings]),
    );
    toast.success(t('admin.fileDownloaded'));
  };

  const exportFacilities = () => {
    if (!stats.data) return;
    downloadCsv(
      'parkovka-facility-report.csv',
      ['Facility', 'Occupancy', 'Revenue', 'Reservations'],
      stats.data.facilityPerformance.map((row) => [
        tx(row.name),
        row.occupancy,
        row.revenue,
        row.reservations,
      ]),
    );
    toast.success(t('admin.fileDownloaded'));
  };

  const columns: DataColumn<DashboardStats['facilityPerformance'][number]>[] = [
    {
      id: 'name',
      header: t('admin.facilityName'),
      primary: true,
      cell: (row) => <span className="text-[13px] font-medium text-foreground">{tx(row.name)}</span>,
      sortValue: (row) => tx(row.name),
    },
    {
      id: 'occupancy',
      header: t('admin.occupancyRate'),
      cell: (row) => (
        <div className="flex min-w-40 items-center gap-2">
          <Progress value={row.occupancy} tone={row.occupancy > 85 ? 'red' : 'navy'} className="flex-1" />
          <span className="w-10 text-right text-[12px] font-medium text-foreground">
            {formatNumber(Math.round(row.occupancy), language)}%
          </span>
        </div>
      ),
      sortValue: (row) => row.occupancy,
    },
    {
      id: 'revenue',
      header: t('admin.revenue'),
      align: 'right',
      cell: (row) => (
        <span className="text-[13px] font-semibold text-foreground">
          {formatAmount(row.revenue, language)}
        </span>
      ),
      sortValue: (row) => row.revenue,
    },
    {
      id: 'reservations',
      header: t('admin.reservations'),
      align: 'right',
      cell: (row) => (
        <span className="text-[13px] text-muted-foreground">
          {formatNumber(row.reservations, language)}
        </span>
      ),
      sortValue: (row) => row.reservations,
      mobileHidden: true,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.reportsTitle')}
        description={t('admin.reportsSubtitle')}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                void stats.refetch().then(() => toast.success(t('admin.reportGenerated')));
              }}
              loading={stats.isFetching}
            >
              <RefreshCw />
              {t('admin.generateReport')}
            </Button>
            <Button onClick={exportRevenue} disabled={!stats.data}>
              <Download />
              {t('admin.exportCsv')}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={facilityId}
          onChange={(event) => setFacilityId(event.target.value)}
          aria-label={t('admin.facility')}
          containerClassName="w-full sm:w-56"
        >
          <option value="all">{t('admin.allFacilities')}</option>
          {facilities.data.map((facility) => (
            <option key={facility.id} value={facility.id}>
              {tx(facility.name)}
            </option>
          ))}
        </Select>
        <SegmentedControl
          value={days}
          onChange={setDays}
          ariaLabel={t('admin.dateRange')}
          options={RANGE_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
        />
      </div>

      {stats.isLoading || !stats.data ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={t('admin.totalRevenue')}
              value={formatAmount(summary.revenue, language)}
              icon={FileText}
              tone="green"
            />
            <StatCard
              label={t('admin.totalReservations')}
              value={formatNumber(summary.bookings, language)}
              icon={Tags}
              tone="navy"
            />
            <StatCard
              label={t('admin.avgOccupancy')}
              value={`${formatNumber(Math.round(summary.occupancy), language)}%`}
              icon={AlertTriangle}
              tone="gold"
            />
            <StatCard label={t('admin.totalSpaces')} value={summary.spaces} icon={CameraIcon} tone="violet" />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-3 font-display text-base font-semibold text-foreground">
                {t('admin.revenueTrend')}
              </h2>
              <RevenueChart stats={stats.data} />
            </section>
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-3 font-display text-base font-semibold text-foreground">
                {t('admin.occupancyByHour')}
              </h2>
              <OccupancyChart stats={stats.data} />
            </section>
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-3 font-display text-base font-semibold text-foreground">
                {t('admin.paymentDistribution')}
              </h2>
              <PaymentDistributionChart stats={stats.data} />
            </section>
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-3 font-display text-base font-semibold text-foreground">
                {t('admin.reportSummary')}
              </h2>
              <dl className="divide-y divide-border">
                {stats.data.paymentDistribution.map((entry) => (
                  <div key={entry.method} className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="text-sm text-muted-foreground">{METHOD_LABELS[entry.method]}</dt>
                    <dd className="text-sm font-semibold text-foreground">
                      {formatAmount(entry.amount, language)}
                    </dd>
                  </div>
                ))}
                {stats.data.paymentDistribution.length === 0 && (
                  <p className="py-3 text-sm text-muted-foreground">{t('admin.noData')}</p>
                )}
              </dl>
            </section>
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-foreground">
                {t('admin.facilityPerformance')}
              </h2>
              <Button variant="outline" size="sm" onClick={exportFacilities}>
                <Download />
                {t('admin.exportCsv')}
              </Button>
            </div>
            <DataTable
              data={stats.data.facilityPerformance}
              columns={columns}
              rowKey={(row) => row.facilityId}
              pageSize={8}
              searchPlaceholder={`${t('common.search')}…`}
              searchFn={(row, query) => tx(row.name).toLowerCase().includes(query)}
              emptyTitle={t('admin.noData')}
            />
          </section>
        </>
      )}
    </div>
  );
}

// ---------- Notifications ----------

export function AdminNotificationsPage() {
  const { t, tx, language } = useI18n();
  const toast = useToast();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  usePageTitle(t('admin.notificationsTitle'));

  const rows = notifications.data ?? [];
  const unread = rows.filter((notification) => !notification.read).length;

  const handleMarkAll = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => toast.success(t('notifications.allRead')),
      onError: (error) =>
        toast.error(t('common.somethingWrong'), error instanceof ApiError ? error.message : undefined),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.notificationsTitle')}
        description={t('admin.notificationsSubtitle')}
        actions={
          <Button
            variant="outline"
            onClick={handleMarkAll}
            disabled={unread === 0}
            loading={markAllRead.isPending}
          >
            <Bell />
            {t('user.markAllRead')}
          </Button>
        }
      />

      {notifications.isLoading ? (
        <PageSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Bell />} title={t('notifications.empty')} />
      ) : (
        <div className="space-y-2">
          {rows.map((notification) => (
            <article
              key={notification.id}
              className={`flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between ${
                notification.read ? 'border-border' : 'border-gold-300/70 dark:border-gold-500/40'
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg ${
                    notification.read ? 'bg-muted text-muted-foreground' : 'bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-300'
                  }`}
                >
                  <Bell className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[13px] font-semibold text-foreground">
                      {tx(notification.title)}
                    </h2>
                    <Badge tone="outline" size="sm">
                      {t(NOTIFICATION_KIND_KEYS[notification.kind])}
                    </Badge>
                    {!notification.read && (
                      <span className="size-1.5 rounded-full bg-gold-500" aria-hidden />
                    )}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    {tx(notification.body)}
                  </p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground/80">
                    {formatDateTime(notification.createdAt, language)}
                  </p>
                </div>
              </div>
              {!notification.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 self-start"
                  loading={markRead.isPending && markRead.variables === notification.id}
                  onClick={() =>
                    markRead.mutate(notification.id, {
                      onError: (error) =>
                        toast.error(
                          t('common.somethingWrong'),
                          error instanceof ApiError ? error.message : undefined,
                        ),
                    })
                  }
                >
                  <CircleCheck />
                  {t('notifications.markRead')}
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Audit log ----------

export function AdminAuditLogsPage() {
  const { t, language } = useI18n();
  const toast = useToast();
  const { data, isLoading } = useAuditLogs();
  const [role, setRole] = useState<'ALL' | Role>('ALL');

  usePageTitle(t('admin.auditTitle'));

  const rows = useMemo(
    () => (data ?? []).filter((log) => role === 'ALL' || log.actorRole === role),
    [data, role],
  );

  const exportCsv = () => {
    downloadCsv(
      'parkovka-audit-log.csv',
      ['Actor', 'Role', 'Action', 'Entity', 'Entity ID', 'Time', 'IP'],
      rows.map((log) => [log.actor, log.actorRole, log.action, log.entity, log.entityId, log.at, log.ip]),
    );
    toast.success(t('admin.fileDownloaded'));
  };

  const columns: DataColumn<AuditLog>[] = [
    {
      id: 'actor',
      header: t('admin.auditActor'),
      primary: true,
      cell: (log) => (
        <div>
          <p className="text-[13px] font-medium text-foreground">{log.actor}</p>
          <div className="mt-1">
            <RoleBadge role={log.actorRole} />
          </div>
        </div>
      ),
      sortValue: (log) => log.actor,
    },
    {
      id: 'action',
      header: t('admin.auditAction'),
      cell: (log) => <span className="text-[12px] text-foreground">{log.action}</span>,
      sortValue: (log) => log.action,
    },
    {
      id: 'entity',
      header: t('admin.auditEntity'),
      cell: (log) => (
        <div>
          <p className="text-[12px] text-foreground">{log.entity}</p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{log.entityId}</p>
        </div>
      ),
      sortValue: (log) => log.entity,
      mobileHidden: true,
    },
    {
      id: 'time',
      header: t('admin.auditTime'),
      cell: (log) => (
        <span className="text-[12px] text-muted-foreground">{formatDateTime(log.at, language)}</span>
      ),
      sortValue: (log) => log.at,
    },
    {
      id: 'ip',
      header: t('admin.auditIp'),
      cell: (log) => <span className="font-mono text-[11px] text-muted-foreground">{log.ip}</span>,
      sortValue: (log) => log.ip,
      mobileHidden: true,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.auditTitle')}
        description={t('admin.auditSubtitle')}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download />
            {t('admin.exportCsv')}
          </Button>
        }
      />

      {isLoading ? (
        <PageSkeleton />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(log) => log.id}
          pageSize={12}
          searchPlaceholder={`${t('common.search')}…`}
          searchFn={(log, query) =>
            [log.actor, log.action, log.entity, log.entityId, log.ip]
              .join(' ')
              .toLowerCase()
              .includes(query)
          }
          toolbar={
            <Select
              value={role}
              onChange={(event) => setRole(event.target.value as 'ALL' | Role)}
              aria-label={t('admin.roles')}
              containerClassName="w-full sm:w-44"
            >
              <option value="ALL">{t('common.all')}</option>
              <option value="ADMIN">{t('auth.roleAdmin')}</option>
              <option value="GUARD">{t('auth.roleGuard')}</option>
              <option value="USER">{t('auth.roleUser')}</option>
            </Select>
          }
          emptyTitle={t('admin.noData')}
        />
      )}
    </div>
  );
}

// ---------- Settings ----------

export function AdminSettingsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const settings = useSystemSettings();
  const updateSettings = useUpdateSettings();
  const [form, setForm] = useState<SystemSettings | null>(null);
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);

  usePageTitle(t('admin.settingsTitle'));

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  const patch = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const save = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!form) return;
    if (!form.companyName.trim() || !form.supportPhone.trim()) {
      setError(t('errors.required'));
      return;
    }
    updateSettings.mutate(form, {
      onSuccess: () => toast.success(t('admin.settingsSaved')),
      onError: (mutationError) => {
        const message =
          mutationError instanceof ApiError ? mutationError.message : t('errors.generic');
        setError(message);
        toast.error(t('common.somethingWrong'), message);
      },
    });
  };

  const factoryReset = () => {
    resetDemoData();
    queryClient.clear();
    setResetOpen(false);
    toast.success(t('admin.factoryResetDone'));
  };

  if (settings.isLoading || !form) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.settingsTitle')} description={t('admin.settingsSubtitle')} />

      <form onSubmit={save} className="space-y-4" noValidate>
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-display text-base font-semibold text-foreground">
            {t('admin.companyName')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('admin.companyName')} htmlFor="settings-company" required>
              <Input
                id="settings-company"
                value={form.companyName}
                onChange={(event) => patch('companyName', event.target.value)}
              />
            </Field>
            <Field label={t('admin.supportPhone')} htmlFor="settings-phone" required>
              <Input
                id="settings-phone"
                type="tel"
                value={form.supportPhone}
                onChange={(event) => patch('supportPhone', event.target.value)}
              />
            </Field>
            <Field label={t('admin.email')} htmlFor="settings-email">
              <Input
                id="settings-email"
                type="email"
                value={form.supportEmail}
                onChange={(event) => patch('supportEmail', event.target.value)}
              />
            </Field>
            <Field label={t('admin.defaultLanguage')} htmlFor="settings-language">
              <Select
                id="settings-language"
                value={form.defaultLanguage}
                onChange={(event) =>
                  patch('defaultLanguage', event.target.value as SystemSettings['defaultLanguage'])
                }
              >
                {LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('admin.timezone')} htmlFor="settings-timezone">
              <Input
                id="settings-timezone"
                value={form.timezone}
                onChange={(event) => patch('timezone', event.target.value)}
              />
            </Field>
            <Field label={t('admin.maintenanceWindow')} htmlFor="settings-maintenance">
              <Input
                id="settings-maintenance"
                value={form.maintenanceWindow}
                onChange={(event) => patch('maintenanceWindow', event.target.value)}
              />
            </Field>
            <Field label={t('admin.currency')} htmlFor="settings-currency">
              <Input id="settings-currency" value={form.currency} readOnly disabled />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-display text-base font-semibold text-foreground">
            {t('admin.integrations')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('admin.paymentProvider')} htmlFor="settings-payments">
              <Input
                id="settings-payments"
                value={form.paymentProvider}
                onChange={(event) => patch('paymentProvider', event.target.value)}
              />
            </Field>
            <Field label={t('admin.cameraProvider')} htmlFor="settings-cameras">
              <Input
                id="settings-cameras"
                value={form.cameraProvider}
                onChange={(event) => patch('cameraProvider', event.target.value)}
              />
            </Field>
          </div>
          {USE_FIXTURES && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-gold-200 bg-gold-50/60 p-3 text-[12px] text-gold-800 dark:border-gold-500/30 dark:bg-gold-500/10 dark:text-gold-200">
              <ScrollText className="mt-0.5 size-4 shrink-0" />
              <span>{t('common.demoDataNote')}</span>
            </div>
          )}
        </section>

        {error && (
          <p
            className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] font-medium text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" loading={updateSettings.isPending}>
            <Save />
            {t('admin.saveSettings')}
          </Button>
        </div>
      </form>

      <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
              <ShieldAlert className="size-5" />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                {t('admin.factoryReset')}
              </h2>
              <p className="mt-1 max-w-xl text-[13px] text-muted-foreground">
                {t('admin.factoryResetHint')}
              </p>
            </div>
          </div>
          <Button variant="danger" onClick={() => setResetOpen(true)}>
            <ShieldAlert />
            {t('admin.factoryReset')}
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t('admin.factoryReset')}
        description={t('admin.factoryResetHint')}
        confirmLabel={t('admin.factoryReset')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={factoryReset}
      />

      {updateSettings.isPending && (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Spinner className="size-3.5" />
          {t('common.saving')}
        </div>
      )}
    </div>
  );
}
