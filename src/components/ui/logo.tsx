import { SquareParking } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

export function Logo({
  tone = 'default',
  showTagline = false,
  className,
}: {
  tone?: 'default' | 'light';
  showTagline?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'grid size-9 place-items-center rounded-[11px] shadow-sm',
          tone === 'light' ? 'bg-gold-500 text-navy-950' : 'bg-navy-900 text-gold-400 dark:bg-gold-500 dark:text-navy-950',
        )}
      >
        <SquareParking className="size-5" strokeWidth={2.2} />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display text-[19px] font-extrabold tracking-[-0.03em]',
            tone === 'light' ? 'text-white' : 'text-foreground',
          )}
        >
          Parkovka
        </span>
        {showTagline && (
          <span
            className={cn(
              'mt-1 text-[10px] font-medium uppercase tracking-[0.16em]',
              tone === 'light' ? 'text-white/60' : 'text-muted-foreground',
            )}
          >
            {t('common.tagline')}
          </span>
        )}
      </span>
    </span>
  );
}
