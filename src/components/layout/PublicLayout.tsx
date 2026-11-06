import { ArrowRight, Mail, MapPin, Menu, Phone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, roleHome } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { LanguageSwitcher, ThemeToggle } from '@/components/ui/preferences';

const publicLinks = [
  { to: '/', labelKey: 'nav.home', end: true },
  { to: '/search', labelKey: 'nav.search', end: false },
  { to: '/map', labelKey: 'nav.map', end: false },
  { to: '/#how-it-works', labelKey: 'nav.howItWorks', end: false },
  { to: '/#faq', labelKey: 'footer.faq', end: false },
  { to: '/#contact', labelKey: 'nav.contact', end: false },
] as const;

function PublicHeader() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-lg">
      <div className="page-container flex h-16 items-center justify-between gap-4">
        <Link to="/" aria-label={t('common.appName')} className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label={t('nav.navigation')}>
          {publicLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                  isActive && link.to !== '/#how-it-works'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )
              }
            >
              {t(link.labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <div className="hidden items-center gap-1 sm:flex">
            <LanguageSwitcher compact />
            <ThemeToggle />
          </div>
          <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
          {user ? (
            <Button asChild variant="primary" size="sm" className="ml-1 hidden sm:inline-flex">
              <Link to={roleHome(user.role)}>{t('nav.dashboard')}</Link>
            </Button>
          ) : (
            <div className="hidden items-center gap-1.5 sm:flex">
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">{t('nav.login')}</Link>
              </Button>
              <Button asChild variant="primary" size="sm">
                <Link to="/register">{t('nav.register')}</Link>
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label={open ? t('common.close') : t('nav.navigation')}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background shadow-lg lg:hidden">
          <nav className="page-container flex flex-col gap-1 py-4" aria-label={t('nav.navigation')}>
            {publicLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2.5 text-sm font-medium',
                    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                {t(link.labelKey)}
              </NavLink>
            ))}
            <div className="mt-3 flex items-center justify-between border-t border-border pt-4">
              <div className="flex items-center gap-1">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
              {user ? (
                <Button asChild size="sm">
                  <Link to={roleHome(user.role)}>{t('nav.dashboard')}</Link>
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/login">{t('nav.login')}</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link to="/register">{t('nav.register')}</Link>
                  </Button>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function PublicFooter() {
  const { t } = useI18n();

  return (
    <footer className="mt-auto bg-sidebar text-sidebar-foreground">
      <div className="page-container grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.2fr]">
        <div>
          <Logo tone="light" showTagline className="mb-4" />
          <p className="max-w-xs text-sm leading-relaxed text-white/60">{t('footer.aboutText')}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="accent" size="sm">
              <Link to="/search">
                {t('home.heroCtaPrimary')}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
            {t('footer.product')}
          </h2>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link to="/search" className="text-white/70 transition-colors hover:text-white">
                {t('footer.forDrivers')}
              </Link>
            </li>
            <li>
              <Link to="/search?type=BUSINESS" className="text-white/70 transition-colors hover:text-white">
                {t('footer.forBusiness')}
              </Link>
            </li>
            <li>
              <Link to="/#qr-parking" className="text-white/70 transition-colors hover:text-white">
                {t('home.qrEyebrow')}
              </Link>
            </li>
            <li>
              <Link to="/#pricing" className="text-white/70 transition-colors hover:text-white">
                {t('facility.pricing')}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
            {t('footer.support')}
          </h2>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link to="/#faq" className="text-white/70 transition-colors hover:text-white">
                {t('footer.faq')}
              </Link>
            </li>
            <li>
              <Link to="/#contact" className="text-white/70 transition-colors hover:text-white">
                {t('footer.contact')}
              </Link>
            </li>
            <li>
              <Link to="/legal/terms" className="text-white/70 transition-colors hover:text-white">
                {t('footer.terms')}
              </Link>
            </li>
            <li>
              <Link to="/legal/privacy" className="text-white/70 transition-colors hover:text-white">
                {t('footer.privacy')}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
            {t('footer.contact')}
          </h2>
          <ul className="space-y-3 text-sm text-white/70">
            <li className="flex items-start gap-2.5">
              <Phone className="mt-0.5 size-4 shrink-0 text-gold-400" />
              <a href="tel:+998712000555" className="transition-colors hover:text-white">
                +998 71 200 05 55
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <Mail className="mt-0.5 size-4 shrink-0 text-gold-400" />
              <a href="mailto:hello@parkovka.uz" className="transition-colors hover:text-white">
                hello@parkovka.uz
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-gold-400" />
              <span>{t('home.contactAddressValue')}</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-sidebar-border">
        <div className="page-container flex flex-col items-center justify-between gap-2 py-5 text-xs text-white/45 sm:flex-row">
          <p>
            © {new Date().getFullYear()} Parkovka. {t('footer.rights')}
          </p>
          <p>{t('footer.madeIn')}</p>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
      >
        {t('common.continue')}
      </a>
      <PublicHeader />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
