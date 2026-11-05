import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/lib/api/hooks';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown';
import { Spinner } from '@/components/ui/states';

export function NotificationsMenu({ viewAllTo }: { viewAllTo?: string }) {
  const { t, tx, language } = useI18n();
  const navigate = useNavigate();
  const { data = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unread = data.filter((item) => !item.read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={t('nav.notifications')}
        >
          <Bell />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid min-w-[16px] place-items-center rounded-full bg-accent px-1 text-[9px] font-bold leading-4 text-accent-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{t('notifications.title')}</p>
            {unread > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('notifications.unread', { count: unread })}
              </p>
            )}
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => markAllRead.mutate()}
              loading={markAllRead.isPending}
              leftIcon={<CheckCheck />}
            >
              {t('notifications.allRead')}
            </Button>
          )}
        </div>
        <DropdownMenuSeparator className="mx-0 my-0" />
        <div className="max-h-[380px] overflow-y-auto p-1.5">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Inbox className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>
            </div>
          ) : (
            data.slice(0, 12).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!item.read) markRead.mutate(item.id);
                  if (item.href) navigate(item.href);
                }}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-muted',
                  !item.read && 'bg-accent/[0.06]',
                )}
              >
                <span
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    item.read ? 'bg-border' : 'bg-accent',
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-semibold leading-snug text-foreground">
                      {tx(item.title)}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatRelative(item.createdAt, language)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {tx(item.body)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
        {data.length > 0 && viewAllTo && (
          <>
            <DropdownMenuSeparator className="mx-0 my-0" />
            <DropdownMenuLabel className="px-2 py-1.5 text-center">
              <button
                type="button"
                onClick={() => navigate(viewAllTo)}
                className="text-[12px] font-medium normal-case tracking-normal text-navy-600 hover:underline dark:text-navy-300"
              >
                {t('notifications.viewAll')}
              </button>
            </DropdownMenuLabel>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
