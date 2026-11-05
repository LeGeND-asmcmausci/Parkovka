import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Camera,
  Car,
  CreditCard,
  History,
  LayoutDashboard,
  ListChecks,
  MapPinned,
  ScanLine,
  ScrollText,
  Settings,
  ShieldCheck,
  Star,
  Tags,
  Ticket,
  Timer,
  UserRound,
  Users,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n';
import type { Role } from '@/lib/types';

export interface NavItem {
  to: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavGroup {
  labelKey: TranslationKey;
  items: NavItem[];
}

export const navByRole: Record<Role, NavGroup[]> = {
  ADMIN: [
    {
      labelKey: 'nav.navigation',
      items: [{ to: '/admin', labelKey: 'nav.overview', icon: LayoutDashboard, end: true }],
    },
    {
      labelKey: 'nav.management',
      items: [
        { to: '/admin/facilities', labelKey: 'nav.facilities', icon: Building2 },
        { to: '/admin/map', labelKey: 'nav.map', icon: MapPinned },
        { to: '/admin/reservations', labelKey: 'nav.reservations', icon: CalendarDays },
        { to: '/admin/sessions', labelKey: 'nav.sessions', icon: Timer },
        { to: '/admin/payments', labelKey: 'nav.payments', icon: CreditCard },
        { to: '/admin/users', labelKey: 'nav.users', icon: Users },
        { to: '/admin/guards', labelKey: 'nav.guards', icon: ShieldCheck },
        { to: '/admin/pricing', labelKey: 'nav.pricing', icon: Tags },
        { to: '/admin/cameras', labelKey: 'nav.cameras', icon: Camera },
      ],
    },
    {
      labelKey: 'nav.reports',
      items: [
        { to: '/admin/reports', labelKey: 'nav.reports', icon: BarChart3 },
        { to: '/admin/audit-logs', labelKey: 'nav.auditLogs', icon: ScrollText },
        { to: '/admin/notifications', labelKey: 'nav.notifications', icon: Bell },
        { to: '/admin/settings', labelKey: 'nav.settings', icon: Settings },
      ],
    },
  ],
  USER: [
    {
      labelKey: 'nav.navigation',
      items: [
        { to: '/app', labelKey: 'nav.overview', icon: LayoutDashboard, end: true },
        { to: '/app/active', labelKey: 'nav.activeParking', icon: Timer },
        { to: '/app/reservations', labelKey: 'nav.reservations', icon: CalendarDays },
        { to: '/app/tickets', labelKey: 'nav.tickets', icon: Ticket },
      ],
    },
    {
      labelKey: 'nav.userArea',
      items: [
        { to: '/app/vehicles', labelKey: 'nav.vehicles', icon: Car },
        { to: '/app/payments', labelKey: 'nav.payments', icon: CreditCard },
        { to: '/app/reviews', labelKey: 'nav.reviews', icon: Star },
        { to: '/app/notifications', labelKey: 'nav.notifications', icon: Bell },
        { to: '/app/profile', labelKey: 'nav.profile', icon: UserRound },
        { to: '/app/settings', labelKey: 'nav.settings', icon: Settings },
      ],
    },
  ],
  GUARD: [
    {
      labelKey: 'nav.operations',
      items: [
        { to: '/guard', labelKey: 'nav.overview', icon: LayoutDashboard, end: true },
        { to: '/guard/entry', labelKey: 'nav.entry', icon: ArrowDownToLine },
        { to: '/guard/exit', labelKey: 'nav.exit', icon: ArrowUpFromLine },
        { to: '/guard/scan', labelKey: 'nav.scan', icon: ScanLine },
      ],
    },
    {
      labelKey: 'nav.management',
      items: [
        { to: '/guard/sessions', labelKey: 'nav.sessions', icon: ListChecks },
        { to: '/guard/arrivals', labelKey: 'nav.arrivals', icon: Clock },
        { to: '/guard/departures', labelKey: 'nav.departures', icon: Clock },
        { to: '/guard/incidents', labelKey: 'nav.incidents', icon: AlertTriangle },
        { to: '/guard/activity', labelKey: 'nav.activity', icon: History },
      ],
    },
  ],
};

export function navItemForPath(role: Role, pathname: string) {
  const items = navByRole[role].flatMap((group) => group.items);
  return (
    items
      .filter((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))
      .sort((a, b) => b.to.length - a.to.length)[0] ?? null
  );
}

export const guardMobileNav: NavItem[] = [
  { to: '/guard/entry', labelKey: 'nav.entry', icon: ArrowDownToLine },
  { to: '/guard/exit', labelKey: 'nav.exit', icon: ArrowUpFromLine },
  { to: '/guard/scan', labelKey: 'nav.scan', icon: ScanLine },
  { to: '/guard/sessions', labelKey: 'nav.sessions', icon: ListChecks },
];
