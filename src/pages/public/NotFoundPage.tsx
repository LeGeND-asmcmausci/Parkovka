import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/use-page-title';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const { t } = useI18n();
  usePageTitle(t('common.notFound'));

  return (
    <div className="page-container flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-6">
        <span className="absolute -inset-6 rounded-full bg-gold-400/10 blur-2xl" aria-hidden />
        <div className="relative grid size-16 place-items-center rounded-2xl border border-border bg-card text-accent shadow-sm">
          <Compass className="size-7" />
        </div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">404</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground">
        {t('common.notFound')}
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {t('errors.notFound')}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button asChild leftIcon={<ArrowLeft />}>
          <Link to="/">{t('common.backHome')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/search">{t('nav.search')}</Link>
        </Button>
      </div>
    </div>
  );
}
