import { ArrowLeft, CircleCheck, QrCode, ShieldCheck, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { Logo } from '@/components/ui/logo';
import { LanguageSwitcher, ThemeToggle } from '@/components/ui/preferences';

export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-navy-950 p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -right-24 top-1/4 size-96 rounded-full bg-gold-500/10 blur-[110px]" />
        <Link to="/" className="relative w-fit">
          <Logo tone="light" showTagline />
        </Link>

        <div className="relative max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-400">
            {t('home.heroEyebrow')}
          </p>
          <h1 className="mt-3 text-balance font-display text-[38px] font-bold leading-[1.08] tracking-[-0.03em] text-white">
            {t('home.heroTitle1')} <span className="text-gold-400">{t('home.heroTitle2')}</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/55">{t('home.heroSubtitle')}</p>

          <ul className="mt-8 space-y-3.5">
            {[
              { icon: QrCode, text: t('home.qrPoint1') },
              { icon: Timer, text: t('home.trustOnline') },
              { icon: CircleCheck, text: t('home.trust24') },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.text} className="flex items-center gap-3 text-[13px] text-white/70">
                  <span className="grid size-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-gold-400">
                    <Icon className="size-4" />
                  </span>
                  {item.text}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <ShieldCheck className="size-5 shrink-0 text-emerald-400" />
          <p className="text-[11px] leading-relaxed text-white/55">{t('auth.secureNote')}</p>
        </div>
      </aside>

      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <Logo />
          </Link>
          <Link
            to="/"
            className="hidden items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground lg:flex"
          >
            <ArrowLeft className="size-4" />
            {t('nav.publicSite')}
          </Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher compact />
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
