import { useId } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAmount, formatCompactAmount, formatDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { DashboardStats, PaymentMethod } from '@/lib/types';

const METHOD_COLORS: Record<PaymentMethod, string> = {
  PAYME: '#0ea5e9',
  CLICK: '#6366f1',
  UZCARD: '#10b981',
  HUMO: '#f59e0b',
  CASH: '#94a3b8',
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  PAYME: 'Payme',
  CLICK: 'Click',
  UZCARD: 'Uzcard',
  HUMO: 'Humo',
  CASH: 'Cash',
};

function tooltipStyle() {
  return {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    fontSize: 12,
    color: 'var(--foreground)',
    boxShadow: '0 8px 24px rgb(0 0 0 / 0.12)',
  };
}

export function RevenueChart({ stats }: { stats: DashboardStats }) {
  const { language } = useI18n();
  const gradientId = `revenue-${useId().replace(/:/g, '')}`;
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={stats.revenueSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c9a227" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#c9a227" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => formatDate(value, language, 'd MMM')}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            minTickGap={18}
          />
          <YAxis
            tickFormatter={(value: number) => formatCompactAmount(value, language)}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            width={76}
          />
          <Tooltip
            contentStyle={tooltipStyle()}
            labelFormatter={(label) => formatDate(String(label), language)}
            formatter={(value, name) =>
              name === 'revenue'
                ? [formatAmount(Number(value), language), 'Revenue']
                : [String(value), 'Bookings']
            }
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#c9a227"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 4, fill: '#c9a227' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OccupancyChart({ stats }: { stats: DashboardStats }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={stats.occupancySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(value: number) => `${value}%`}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            width={38}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
            contentStyle={tooltipStyle()}
            formatter={(value) => [`${value}%`, 'Occupancy']}
          />
          <Bar dataKey="occupancy" fill="#1e4e82" radius={[4, 4, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PaymentDistributionChart({ stats }: { stats: DashboardStats }) {
  const { language } = useI18n();
  const data = stats.paymentDistribution.map((item) => ({
    ...item,
    label: METHOD_LABEL[item.method],
  }));
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="h-[190px] w-[190px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="label"
              innerRadius={52}
              outerRadius={82}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.method} fill={METHOD_COLORS[entry.method]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle()}
              formatter={(value, name) => [formatAmount(Number(value), language), String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-2">
        {data.map((item) => (
          <li key={item.method} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="size-2.5 rounded-[3px]"
                style={{ backgroundColor: METHOD_COLORS[item.method] }}
              />
              {item.label}
            </span>
            <span className="font-semibold text-foreground">{formatCompactAmount(item.amount, language)}</span>
          </li>
        ))}
        {data.length === 0 && <li className="text-xs text-muted-foreground">—</li>}
      </ul>
    </div>
  );
}
