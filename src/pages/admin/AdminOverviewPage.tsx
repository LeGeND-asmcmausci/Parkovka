import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Camera,
  CarFront,
  CircleDollarSign,
  Gauge,
  Plus,
  ShieldAlert,
  Timer,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useAdminStats,
  useAllReservations,
  useCameras,
  useFacilities,
  useIncidents,
} from '@/lib/api/hooks';
import { formatAmount, formatCompactAmount, formatPercent, formatRelative, formatTime } from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';
import { useI18n } from '@/lib/i18n';
import type { Reservation } from '@/lib/types';
import { OccupancyChart, PaymentDistributionChart, RevenueChart } from '@/components/dashboard/charts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader, Progress, SegmentedControl, StatCard } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { EmptyState, PageSkeleton } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable, type DataColumn } from '@/components/ui/table';

const RANGE_OPTIONS = [
  { value: '7', labelKey: 'admin.last7' },
  { value: '30', labelKey: 'admin.last30' },
  { value: '90', labelKey: 'admin.last90' },
] as const;

export function AdminOverviewPage() {
  const { t, tx, language } = useI18n();
  const [days, setDays] = useState<'7' | '30' | '90'>('7');
  const [facilityId, setFacilityId] = useState('');
  const stats = useAdminStats(facilityId || undefined, Number(days));
  const facilities = useFacilities();
  const reservations = useAllReservations(facilityId || undefined);
  const cameras = useCameras(facilityId || undefined);
  const incidents = useIncidents(facilityId || undefined);
  usePageTitle(t('admin.overviewTitle'));

  const facilityById = new Map((facilities.data ?? []).map((facility) => [facility.id, facility]));
  const facilityName = (id: string) =>
    facilityById.get(id) ? tx(facilityById.get(id)!.name) : id;
  const onlineCameras = (cameras.data ?? []).filter((camera) => camera.status === 'ONLINE').length;
  const openIncidents = (incidents.data ?? []).filter((incident) => incident.status === 'OPEN');

  const columns: DataColumn<Reservation>[] = [
    {
      id: 'reference',
      header: t('booking.ticketNumber'),
      cell: (row) => (
        <div>
          <p className="font-mono text-[13px] font-semibold text-foreground">{row.reference}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{facilityName(row.facilityId)}</p>
        </div>
      ),
    },
    {
      id: 'space',
      header: t('admin.space'),
      cell: (row) => <span className="font-mono text-[13px] text-foreground">{row.spaceCode}</span>,
    },
    {
      id: 'time',
      header: t('admin.date'),
      cell: (row) => (
        <span className="text-[13px] text-muted-foreground">
          {formatTime(row.startsAt, language)} · {formatRelative(row.startsAt, language)}
        </span>
      ),
      sortValue: (row) => row.startsAt,
    },
    {
      id: 'amount',
      header: t('admin.amount'),
      cell: (row) => (
        <span className="text-[13px] font-semibold text-foreground">{formatAmount(row.totalAmount, language)}</span>
      ),
      sortValue: (row) => row.totalAmount,
      align: 'right',
    },
    {
      id: 'status',
      header: t('common.status'),
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('nav.adminArea')}
        title={t('admin.overviewTitle')}
        description={t('admin.overviewSubtitle')}
        actions={
          <>
            <Button asChild variant="outline" leftIcon={<Building2 />}>
              <Link to="/admin/facilities">{t('admin.facilitiesTitle')}</Link>
            </Button>
            <Button asChild leftIcon={<Plus />}>
              <Link to="/admin/facilities?new=1">{t('admin.addFacility')}</Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          options={RANGE_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
          value={days}
          onChange={setDays}
          ariaLabel={t('admin.dateRange')}
        />
        <Select
          value={facilityId}
          onChange={(event) => setFacilityId(event.target.value)}
          className="sm:w-64"
          aria-label={t('admin.allFacilities')}
        >
          <option value="">{t('admin.allFacilities')}</option>
          {(facilities.data ?? []).map((facility) => (
            <option key={facility.id} value={facility.id}>
              {tx(facility.name)}
            </option>
          ))}
        </Select>
      </div>

      {stats.isLoading || !stats.data ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={t('admin.totalSpaces')}
              value={stats.data.totalSpaces}
              icon={CarFront}
              tone="navy"
              hint={`${stats.data.available} ${t('common.free').toLowerCase()}`}
            />
            <StatCard
              label={t('admin.occupancy')}
              value={formatPercent(stats.data.occupancyRate, language)}
              icon={Gauge}
              tone="gold"
              hint={`${stats.data.occupied} ${t('status.occupied').toLowerCase()} · ${stats.data.reserved} ${t('status.reserved').toLowerCase()}`}
            />
            <StatCard
              label={t('admin.todayRevenue')}
              value={formatCompactAmount(stats.data.todayRevenue, language)}
              icon={CircleDollarSign}
              tone="green"
              hint={`${stats.data.todayReservations} ${t('admin.bookingsShort').toLowerCase()}`}
            />
            <StatCard
              label={t('admin.activeSessions')}
              value={stats.data.activeSessions}
              icon={Timer}
              tone="blue"
              hint={formatRelative(new Date().toISOString(), language)}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-foreground">{t('admin.revenueTrend')}</h2>
                <Badge tone="success" size="sm" dot>
                  +{stats.data.todayReservations}
                </Badge>
              </div>
              <RevenueChart stats={stats.data} />
            </section>

            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-3 font-display text-sm font-semibold text-foreground">
                {t('admin.paymentDistribution')}
              </h2>
              <PaymentDistributionChart stats={stats.data} />
            </section>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 font-display text-sm font-semibold text-foreground">{t('admin.occupancyByHour')}</h2>
              <OccupancyChart stats={stats.data} />
            </section>

            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-display text-sm font-semibold text-foreground">{t('admin.systemHealth')}</h2>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3.5 py-3">
                  <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <Camera className="size-4" /> {t('admin.camerasOnline')}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {onlineCameras} / {(cameras.data ?? []).length}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3.5 py-3">
                  <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <TriangleAlert className="size-4" /> {t('admin.openIncidents')}
                  </span>
                  <Badge tone={openIncidents.length > 0 ? 'warning' : 'success'} dot>
                    {openIncidents.length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3.5 py-3">
                  <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <Activity className="size-4" /> {t('admin.lastSynced')}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {formatRelative(new Date().toISOString(), language)}
                  </span>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <Button asChild variant="outline" size="sm" className="justify-start" leftIcon={<Camera />}>
                  <Link to="/admin/cameras">{t('nav.cameras')}</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="justify-start" leftIcon={<ShieldAlert />}>
                  <Link to="/admin/guards">{t('nav.guards')}</Link>
                </Button>
              </div>
            </section>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_1.6fr]">
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 font-display text-sm font-semibold text-foreground">
                {t('admin.facilityPerformance')}
              </h2>
              <ul className="space-y-4">
                {stats.data.facilityPerformance.slice(0, 5).map((performance) => (
                  <li key={performance.facilityId}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {tx(performance.name)}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {formatPercent(performance.occupancy, language)}
                      </span>
                    </div>
                    <Progress value={performance.occupancy} tone="gold" />
                    <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{formatCompactAmount(performance.revenue, language)}</span>
                      <span>{performance.reservations} {t('admin.bookingsShort').toLowerCase()}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <Button asChild variant="ghost" size="sm" className="mt-4 w-full" rightIcon={<ArrowRight />}>
                <Link to="/admin/reports">{t('admin.reportsTitle')}</Link>
              </Button>
            </section>

            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-foreground">
                  {t('admin.recentReservations')}
                </h2>
                <Button asChild variant="ghost" size="sm" rightIcon={<ArrowUpRight />}>
                  <Link to="/admin/reservations">{t('common.viewAll')}</Link>
                </Button>
              </div>
              <DataTable
                data={(reservations.data ?? []).slice(0, 16)}
                columns={columns}
                rowKey={(row) => row.id}
                pageSize={5}
                plain
              />
            </section>
          </div>
        </>
      )}

      {!stats.isLoading && !stats.data && (
        <EmptyState
          title={t('common.somethingWrong')}
          description={t('errors.network')}
          action={
            <Button variant="outline" onClick={() => void stats.refetch()}>
              {t('common.tryAgain')}
            </Button>
          }
        />
      )}
    </div>
  );
}
