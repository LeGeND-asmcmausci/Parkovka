import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Building2, CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFacilities } from '@/lib/api/hooks';
import { localized, useI18n } from '@/lib/i18n';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';
import { navByRole } from './nav-config';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
}

interface CommandItem {
  id: string;
  label: string;
  group: string;
  to: string;
  icon: typeof Search;
  searchText: string;
}

export function CommandPalette({ open, onOpenChange, role }: CommandPaletteProps) {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: facilities = [] } = useFacilities();

  const items = useMemo<CommandItem[]>(() => {
    const pages: CommandItem[] = navByRole[role]
      .flatMap((group) => group.items)
      .map((item) => ({
        id: item.to,
        label: t(item.labelKey),
        group: t('nav.navigation'),
        to: item.to,
        icon: item.icon,
        searchText: t(item.labelKey),
      }));

    const places: CommandItem[] = facilities.map((facility) => ({
      id: facility.id,
      label: localized(facility.name, language),
      group: t('nav.facilities'),
      to: `/facilities/${facility.slug}`,
      icon: Building2,
      searchText: `${localized(facility.name, language)} ${localized(facility.address, language)}`,
    }));

    const all = [...pages, ...places];
    const term = query.trim().toLowerCase();
    if (!term) return all;
    return all.filter((item) => item.searchText.toLowerCase().includes(term));
  }, [facilities, language, query, role, t]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    items.forEach((item) => {
      map.set(item.group, [...(map.get(item.group) ?? []), item]);
    });
    return [...map.entries()];
  }, [items]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const choose = (item: CommandItem) => {
    onOpenChange(false);
    navigate(item.to);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-[fade-in_0.15s_ease-out]" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-pop focus:outline-none data-[state=open]:animate-[rise_0.2s_cubic-bezier(0.2,0.8,0.2,1)]"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((current) => (items.length ? (current + 1) % items.length : 0));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((current) => (items.length ? (current - 1 + items.length) % items.length : 0));
            } else if (event.key === 'Enter' && items[active]) {
              event.preventDefault();
              choose(items[active]);
            }
          }}
        >
          <DialogPrimitive.Title className="sr-only">{t('nav.searchPlaceholder')}</DialogPrimitive.Title>
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('nav.searchPlaceholder')}
              className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              aria-label={t('nav.searchPlaceholder')}
            />
            <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground sm:block">
              ESC
            </kbd>
          </div>

          <div className="max-h-[min(420px,55vh)] overflow-y-auto p-2">
            {grouped.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium text-foreground">{t('common.noResults')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('search.noResultsText')}</p>
              </div>
            ) : (
              grouped.map(([group, groupItems]) => (
                <div key={group} className="mb-1.5 last:mb-0">
                  <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {group}
                  </p>
                  {groupItems.map((item) => {
                    const index = items.findIndex((candidate) => candidate.id === item.id);
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setActive(index)}
                        onClick={() => choose(item)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                          index === active
                            ? 'bg-muted text-foreground'
                            : 'text-muted-foreground hover:bg-muted/70',
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {index === active && <CornerDownLeft className="size-3.5 opacity-60" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
