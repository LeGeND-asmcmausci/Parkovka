import { useI18n, type TranslationKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Badge, type BadgeTone } from './badge';
import type { Role } from '@/lib/types';

const toneByStatus: Record<string, BadgeTone> = {
  AVAILABLE: 'success',
  OCCUPIED: 'danger',
  RESERVED: 'warning',
  BLOCKED: 'neutral',
  MAINTENANCE: 'purple',
  ACTIVE: 'success',
  COMPLETED: 'neutral',
  CANCELLED: 'danger',
  PENDING: 'warning',
  CONFIRMED: 'info',
  EXPIRED: 'neutral',
  NO_SHOW: 'danger',
  PAID: 'success',
  UNPAID: 'warning',
  REFUNDED: 'info',
  FAILED: 'danger',
  ONLINE: 'success',
  OFFLINE: 'danger',
  DEGRADED: 'warning',
  OPEN: 'warning',
  RESOLVED: 'success',
  LOW: 'neutral',
  MEDIUM: 'warning',
  HIGH: 'danger',
  SUSPENDED: 'danger',
  STANDARD: 'neutral',
  VIP: 'gold',
  EV: 'info',
  ACCESSIBLE: 'info',
  CLOSED: 'neutral',
  OVERSTAY: 'danger',
};

const keyByStatus: Record<string, string> = {
  NO_SHOW: 'noShow',
  MAINTENANCE: 'maintenance',
};

function statusKey(status: string): TranslationKey {
  const suffix = keyByStatus[status] ?? status.toLowerCase();
  return `status.${suffix}` as TranslationKey;
}

export function StatusBadge({
  status,
  className,
  dot = true,
}: {
  status: string;
  className?: string;
  dot?: boolean;
}) {
  const { t } = useI18n();
  const key = statusKey(status);
  const label = t(key);
  const tone = toneByStatus[status] ?? 'neutral';
  return (
    <Badge tone={tone} dot={dot} className={cn(className)}>
      {label === key ? status.replaceAll('_', ' ') : label}
    </Badge>
  );
}

const roleTone: Record<Role, BadgeTone> = {
  ADMIN: 'gold',
  GUARD: 'info',
  USER: 'neutral',
};

export function RoleBadge({ role }: { role: Role }) {
  const { t } = useI18n();
  const label =
    role === 'ADMIN' ? t('auth.roleAdmin') : role === 'GUARD' ? t('auth.roleGuard') : t('auth.roleUser');
  return <Badge tone={roleTone[role]}>{label}</Badge>;
}
