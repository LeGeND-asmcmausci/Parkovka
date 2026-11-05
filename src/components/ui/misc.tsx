import { ChevronLeft, ChevronRight, Star, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { cn, initials } from '@/lib/utils';
import { Badge, type BadgeTone } from './badge';
import { Button } from './button';
import { Skeleton } from './states';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, eyebrow, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  icon: LucideIcon;
  hint?: ReactNode;
  trend?: { value: number; label?: ReactNode };
  tone?: 'navy' | 'green' | 'gold' | 'red' | 'blue' | 'violet';
  loading?: boolean;
}

const statTones: Record<NonNullable<StatCardProps['tone']>, string> = {
  navy: 'bg-navy-50 text-navy-700 dark:bg-navy-500/15 dark:text-navy-200',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  gold: 'bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-300',
  red: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
};

export function StatCard({ label, value, icon: Icon, hint, trend, tone = 'navy', loading }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', statTones[tone])}>
          <Icon className="size-[18px]" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p className="mt-2 font-display text-[26px] font-semibold leading-tight tracking-tight text-foreground">
          {value}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        {trend && (
          <Badge tone={(trend.value >= 0 ? 'success' : 'danger') as BadgeTone} size="sm">
            {trend.value >= 0 ? '+' : ''}
            {trend.value}%
          </Badge>
        )}
        {(trend?.label ?? hint) && (
          <p className="truncate text-xs text-muted-foreground">{trend?.label ?? hint}</p>
        )}
      </div>
    </div>
  );
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    sm: 'size-8 text-[11px]',
    md: 'size-9 text-xs',
    lg: 'size-12 text-sm',
  };
  const palette = [
    'bg-navy-100 text-navy-800 dark:bg-navy-500/25 dark:text-navy-100',
    'bg-gold-100 text-gold-700 dark:bg-gold-500/20 dark:text-gold-200',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
    'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200',
  ];
  const index = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-semibold uppercase',
        sizes[size],
        palette[index],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Progress({
  value,
  tone = 'navy',
  className,
  label,
}: {
  value: number;
  tone?: 'navy' | 'gold' | 'green' | 'red';
  className?: string;
  label?: string;
}) {
  const tones = {
    navy: 'bg-navy-700 dark:bg-navy-400',
    gold: 'bg-accent',
    green: 'bg-emerald-500',
    red: 'bg-red-500',
  };
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', tones[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export interface StepItem {
  label: ReactNode;
  description?: ReactNode;
}

export function Stepper({ steps, current }: { steps: StepItem[]; current: number }) {
  return (
    <ol className="flex items-start gap-2 overflow-x-auto scrollbar-none">
      {steps.map((step, index) => {
        const state = index < current ? 'complete' : index === current ? 'current' : 'upcoming';
        return (
          <li key={index} className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold transition-colors',
                    state === 'complete' && 'border-navy-900 bg-navy-900 text-white dark:border-gold-500 dark:bg-gold-500 dark:text-navy-950',
                    state === 'current' && 'border-accent bg-accent text-accent-foreground shadow-glow',
                    state === 'upcoming' && 'border-border bg-card text-muted-foreground',
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    'hidden truncate text-[13px] font-medium sm:block',
                    state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>
              <div
                className={cn(
                  'ml-9 hidden h-px flex-1 sm:block',
                  index === steps.length - 1 && 'invisible',
                  index < current ? 'bg-navy-800 dark:bg-gold-500' : 'bg-border',
                )}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function RatingStars({
  value,
  onChange,
  size = 16,
  showValue,
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  showValue?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;
  if (onChange) {
    return (
      <div className="flex items-center gap-1" role="radiogroup">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star}`}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(star)}
            className="rounded p-0.5"
          >
            <Star
              style={{ width: size, height: size }}
              className={cn(
                'transition-colors',
                star <= display ? 'fill-accent text-accent' : 'fill-transparent text-ink-300',
              )}
            />
          </button>
        ))}
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Star style={{ width: size, height: size }} className="fill-accent text-accent" />
      <span className="text-sm font-semibold text-foreground">{value.toFixed(1)}</span>
      {showValue === false ? null : <span className="sr-only">{value} out of 5</span>}
    </span>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: LucideIcon;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex max-w-full overflow-x-auto rounded-lg border border-border bg-muted/70 p-1',
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
              active
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className="size-4" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  total,
  pageSize,
  labels,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  total: number;
  pageSize: number;
  labels: { previous: string; next: string; page: string };
}) {
  if (pageCount <= 1) {
    return (
      <p className="text-xs text-muted-foreground">
        {labels.page} 1 / 1 · {total}
      </p>
    );
  }
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        {labels.page} {page} / {pageCount} · {from}–{to} / {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label={labels.previous}
        >
          <ChevronLeft />
        </Button>
        {Array.from({ length: Math.min(pageCount, 5) }, (_, index) => {
          const start = Math.max(1, Math.min(page - 2, pageCount - 4));
          const pageNumber = start + index;
          return (
            <button
              key={pageNumber}
              type="button"
              onClick={() => onPageChange(pageNumber)}
              className={cn(
                'grid size-9 place-items-center rounded-lg text-[13px] font-medium transition-colors',
                pageNumber === page
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              aria-current={pageNumber === page ? 'page' : undefined}
            >
              {pageNumber}
            </button>
          );
        })}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label={labels.next}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export function DetailRow({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-2.5', className)}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}
