import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  ChevronRight,
  ExternalLink,
  Home,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  ScanLine,
  SquareParking,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { roleHome, useAuth } from '@/lib/auth';
import { USE_FIXTURES } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown';
import { Logo } from '@/components/ui/logo';
import { LanguageSwitcher, ThemeToggle } from '@/components/ui/preferences';
import { Tooltip } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/toast';
import { CommandPalette } from './CommandPalette';
import { NotificationsMenu } from './NotificationsMenu';
import { guardMobileNav, navByRole, navItemForPath } from './nav-config';

const ROLE_AREA_KEY: Record<Role, 'nav.adminArea' | 'nav.guardArea' | 'nav.myArea'> = {
  ADMIN: 'nav.adminArea',
  GUARD: 'nav.guardArea',
  USER: 'nav.myArea',
};

const ROLE_ICON: Record<Role, ComponentType<{ className?: string }>> = {
  ADMIN: ShieldCheck,
  GUARD: ScanLine,
  USER: UserRound,
};

const SIDEBAR_KEY = 'parkovka.sidebar.collapsed';

function SidebarNav({
  role,
  collapsed,
  onNavigate,
}: {
  role: Role;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label={t('nav.navigation')}>
      {navByRole[role].map((group) => (
        <div key={group.labelKey}>
          {!collapsed && (
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              {t(group.labelKey)}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const link = (
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                      collapsed && 'justify-center px-0',
                      isActive
                        ? 'bg-sidebar-active text-white'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-gold-400" />
                      )}
                      <Icon className="size-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                    </>
                  )}
                </NavLink>
              );
              return (
                <li key={item.to}>
                  {collapsed ? (
                    <Tooltip content={t(item.labelKey)} side="right">
                      {link}
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarBody({
  role,
  collapsed,
  onToggle,
  onNavigate,
}: {
  role: Role;
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const RoleIcon = ROLE_ICON[role];

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-sidebar-border px-4',
          collapsed ? 'justify-center px-0' : 'justify-between',
        )}
      >
        <Link to="/" aria-label={t('common.appName')}>
          <Logo
            tone="light"
            className={cn(collapsed && '[&>span:last-child]:hidden')}
          />
        </Link>
        {!collapsed && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="grid size-8 place-items-center rounded-lg text-white/50 transition-colors hover:bg-sidebar-accent hover:text-white"
            aria-label={t('nav.collapse')}
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      {collapsed ? (
        <div className="flex justify-center px-2 py-4">
          <Tooltip content={t('nav.expand')} side="right">
            <button
              type="button"
              onClick={onToggle}
              className="grid size-9 place-items-center rounded-lg text-white/50 transition-colors hover:bg-sidebar-accent hover:text-white"
              aria-label={t('nav.expand')}
            >
              <PanelLeftOpen className="size-4" />
            </button>
          </Tooltip>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-3">
          <span className="grid size-7 place-items-center rounded-md bg-white/[0.07] text-gold-400">
            <RoleIcon className="size-4" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
            {t(ROLE_AREA_KEY[role])}
          </span>
        </div>
      )}

      <SidebarNav role={role} collapsed={collapsed} onNavigate={onNavigate} />

      <div className="shrink-0 border-t border-sidebar-border p-3">
        {USE_FIXTURES && !collapsed && (
          <div className="mb-2 rounded-lg border border-gold-500/25 bg-gold-500/10 px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gold-300">
              <span className="size-1.5 rounded-full bg-gold-400" />
              {t('nav.demoMode')}
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-white/45">{t('common.demoDataNote')}</p>
          </div>
        )}
        <Link
          to="/"
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-white/55 transition-colors hover:bg-sidebar-accent hover:text-white',
            collapsed && 'justify-center px-0',
          )}
          title={t('nav.publicSite')}
        >
          <ExternalLink className="size-4 shrink-0" />
          {!collapsed && <span>{t('nav.publicSite')}</span>}
        </Link>
      </div>
    </div>
  );
}

function Breadcrumbs({ role }: { role: Role }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const current = navItemForPath(role, pathname);

  return (
    <nav className="flex min-w-0 items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
      <Link
        to={roleHome(role)}
        className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Home className="size-3.5" />
        <span className="hidden sm:inline">{t(ROLE_AREA_KEY[role])}</span>
      </Link>
      {current && (
        <>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
          <span className="truncate font-medium text-foreground">{t(current.labelKey)}</span>
        </>
      )}
    </nav>
  );
}

function ProfileMenu({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-muted"
          aria-label={t('nav.profile')}
        >
          <Avatar name={user.fullName} size="sm" />
          <span className="hidden max-w-[140px] truncate text-[13px] font-medium text-foreground xl:block">
            {user.fullName}
          </span>
          <ChevronRight className="hidden size-3.5 rotate-90 text-muted-foreground xl:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="block truncate text-[13px] font-semibold text-foreground">{user.fullName}</span>
          <span className="block truncate text-[11px] font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Home />} onSelect={() => navigate(roleHome(user.role))}>
          {t('nav.overview')}
        </DropdownMenuItem>
        {user.role === 'USER' && (
          <DropdownMenuItem icon={<UserRound />} onSelect={() => navigate('/app/profile')}>
            {t('nav.profile')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem icon={<ExternalLink />} onSelect={() => navigate('/')}>
          {t('nav.publicSite')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<LogOut />} danger onSelect={onLogout}>
          {t('nav.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardLayout() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const role: Role = user?.role ?? 'USER';

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, String(collapsed));
    } catch {
      // Storage can be unavailable in private mode; the preference is optional.
    }
  }, [collapsed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const confirmLogout = () => {
    setLogoutOpen(false);
    logout();
    toast.success(t('nav.logout'));
    navigate('/');
  };

  return (
    <div className="flex min-h-dvh bg-background">
      <aside
        className={cn(
          'sticky top-0 z-30 hidden h-dvh shrink-0 flex-col transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[76px]' : 'w-[264px]',
        )}
      >
        <SidebarBody
          role={role}
          collapsed={collapsed}
          onToggle={() => setCollapsed((current) => !current)}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-lg sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label={t('nav.navigation')}
            >
              <Menu />
            </Button>
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-navy-900 text-gold-400 dark:bg-gold-500 dark:text-navy-950 lg:hidden">
              <SquareParking className="size-[18px]" strokeWidth={2.2} />
            </span>
            <Breadcrumbs role={role} />
            {USE_FIXTURES && (
              <Badge
                tone="gold"
                dot
                size="sm"
                className="ml-1 hidden xl:inline-flex"
                title={t('common.demoDataNote')}
              >
                {t('nav.demoMode')}
              </Badge>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="outline"
              size="sm"
              className="mr-1 hidden h-9 w-56 justify-start gap-2 px-3 text-muted-foreground md:inline-flex"
              onClick={() => setPaletteOpen(true)}
              aria-label={t('nav.searchPlaceholder')}
            >
              <Search className="size-4" />
              <span className="flex-1 truncate text-left text-[12px]">{t('common.search')}</span>
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-sans text-[9px]">
                Ctrl K
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={() => setPaletteOpen(true)}
              aria-label={t('common.search')}
            >
              <Search />
            </Button>
            <LanguageSwitcher compact className="hidden sm:inline-flex" />
            <ThemeToggle />
            <NotificationsMenu
              viewAllTo={
                role === 'ADMIN' ? '/admin/notifications' : role === 'USER' ? '/app/notifications' : undefined
              }
            />
            <span className="mx-1.5 h-6 w-px bg-border" />
            <ProfileMenu onLogout={() => setLogoutOpen(true)} />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-10">
          <div className="mx-auto w-full max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </div>

      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] border-r border-sidebar-border bg-sidebar shadow-pop focus:outline-none lg:hidden">
            <DialogPrimitive.Title className="sr-only">{t('nav.navigation')}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              {t('nav.publicSite')}
            </DialogPrimitive.Description>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-lg text-white/60 transition-colors hover:bg-sidebar-accent hover:text-white"
                aria-label={t('common.close')}
              >
                <X className="size-4" />
              </button>
            </DialogPrimitive.Close>
            <SidebarBody role={role} collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} role={role} />

      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title={t('nav.logout')}
        description={t('auth.logoutConfirm')}
        confirmLabel={t('nav.logout')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmLogout}
        tone="danger"
      />

      {role === 'GUARD' && (
        <nav
          className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-1 pt-1.5 backdrop-blur-lg lg:hidden"
          aria-label={t('nav.operations')}
        >
          <ul className="flex items-stretch justify-around">
            {guardMobileNav.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to} className="flex-1">
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors',
                        isActive ? 'text-navy-900 dark:text-gold-300' : 'text-muted-foreground',
                      )
                    }
                  >
                    <Icon className="size-5" />
                    <span className="truncate">{t(item.labelKey)}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
