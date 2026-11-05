import {
  ArrowUpRight,
  Filter,
  List,
  Map as MapIcon,
  MapPin,
  RotateCcw,
  Search as SearchIcon,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFacilities } from '@/lib/api/hooks';
import { formatAmount } from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';
import { useI18n } from '@/lib/i18n';
import type { FacilitySearchParams, FacilityType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FacilityCard } from '@/components/facilities/FacilityCard';
import { CITY_LABELS, FACILITY_TYPE_KEYS } from '@/components/facilities/facility-utils';
import { FacilityImage } from '@/components/facilities/FacilityImage';
import { FacilitiesMap } from '@/components/map/FacilitiesMap';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckboxField } from '@/components/ui/controls';
import { InputWithIcon } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';

type ViewMode = 'list' | 'map';

const PRICE_OPTIONS = [5000, 8000, 12000, 20000];

export function SearchPage() {
  const { t, tx, language } = useI18n();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFacilityId, setActiveFacilityId] = useState<string | null>(null);

  usePageTitle(t('search.title'));

  const query = params.get('query') ?? '';
  const city = params.get('city') ?? '';
  const type = (params.get('type') ?? 'ALL') as FacilityType | 'ALL';
  const availability = params.get('availability') === 'available';
  const maxPrice = params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined;
  const sort = (params.get('sort') ?? 'recommended') as NonNullable<FacilitySearchParams['sort']>;
  const view = (params.get('view') === 'map' ? 'map' : 'list') as ViewMode;

  const [searchInput, setSearchInput] = useState(query);
  useEffect(() => setSearchInput(query), [query]);

  const filters: FacilitySearchParams = {
    query: query || undefined,
    city: city || undefined,
    type,
    availability: availability ? 'available' : 'all',
    maxPrice,
    sort,
  };

  const { data: facilities = [], isLoading, isError, refetch } = useFacilities(filters);

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => {
      if (!value || value === 'ALL') next.delete(key);
      else next.set(key, value);
    });
    setParams(next, { replace: true });
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    if (view !== 'list') next.set('view', view);
    setParams(next, { replace: true });
    setSearchInput('');
  };

  const activeFilterCount = [query, city, type !== 'ALL' ? type : '', availability ? '1' : '', maxPrice ? String(maxPrice) : ''].filter(
    Boolean,
  ).length;

  const mapFacilities = useMemo(() => facilities, [facilities]);

  const typeOptions: { value: FacilityType | 'ALL'; label: string }[] = [
    { value: 'ALL', label: t('search.allTypes') },
    ...(Object.keys(FACILITY_TYPE_KEYS) as FacilityType[]).map((key) => ({
      value: key,
      label: t(FACILITY_TYPE_KEYS[key]),
    })),
  ];

  const filterPanel = (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="size-4" />
          {t('common.filters')}
        </p>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-[11px] font-medium text-navy-600 hover:underline dark:text-navy-300"
          >
            {t('common.reset')}
          </button>
        )}
      </div>

      <div>
        <label htmlFor="filter-city" className="mb-1.5 block text-[12px] font-medium text-foreground">
          {t('search.city')}
        </label>
        <Select id="filter-city" value={city} onChange={(event) => update({ city: event.target.value })}>
          <option value="">{t('search.allCities')}</option>
          {(Object.keys(CITY_LABELS) as (keyof typeof CITY_LABELS)[]).map((key) => (
            <option key={key} value={key}>
              {tx(CITY_LABELS[key])}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label htmlFor="filter-type" className="mb-1.5 block text-[12px] font-medium text-foreground">
          {t('search.type')}
        </label>
        <Select
          id="filter-type"
          value={type}
          onChange={(event) => update({ type: event.target.value })}
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label htmlFor="filter-price" className="mb-1.5 block text-[12px] font-medium text-foreground">
          {t('search.price')}
        </label>
        <Select
          id="filter-price"
          value={maxPrice ? String(maxPrice) : ''}
          onChange={(event) => update({ maxPrice: event.target.value || undefined })}
        >
          <option value="">{t('search.anyPrice')}</option>
          {PRICE_OPTIONS.map((price) => (
            <option key={price} value={price}>
              {language === 'en' ? '< ' : '≤ '}
              {formatAmount(price, language)}
            </option>
          ))}
        </Select>
      </div>

      <div className="border-t border-border pt-4">
        <CheckboxField
          id="filter-available"
          checked={availability}
          onCheckedChange={(checked) => update({ availability: checked ? 'available' : undefined })}
          label={t('search.onlyAvailable')}
          description={t('search.availableNow')}
        />
      </div>
    </div>
  );

  return (
    <div className="bg-background">
      <section className="border-b border-border bg-surface-sunken/60">
        <div className="page-container py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600 dark:text-gold-400">
            {t('home.heroEyebrow')}
          </p>
          <h1 className="mt-2 font-display text-[30px] font-bold tracking-[-0.03em] text-foreground sm:text-[36px]">
            {t('search.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t('search.subtitle')}</p>

          <form
            className="mt-6 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              update({ query: searchInput.trim() || undefined });
              setActiveFacilityId(null);
            }}
          >
            <InputWithIcon
              icon={<SearchIcon />}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('home.searchPlaceholder')}
              aria-label={t('home.searchPlaceholder')}
              className="h-12 rounded-xl bg-card sm:max-w-lg"
            />
            <div className="flex gap-2">
              <Button type="submit" size="lg" className="h-12 flex-1 sm:flex-none" leftIcon={<SearchIcon />}>
                {t('home.searchNow')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-12 lg:hidden"
                onClick={() => setFiltersOpen((current) => !current)}
                aria-expanded={filtersOpen}
                leftIcon={<Filter />}
              >
                {t('common.filters')}
                {activeFilterCount > 0 && (
                  <span className="grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>
          </form>
        </div>
      </section>

      <div className="page-container py-8">
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-xl border border-border bg-card p-5 shadow-sm">{filterPanel}</div>
          </aside>

          {filtersOpen && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:hidden">{filterPanel}</div>
          )}

          <div className="min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isLoading ? t('common.loading') : t('search.resultsCount', { count: facilities.length })}
                </p>
                {query && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" /> “{query}”
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl<ViewMode>
                  value={view}
                  onChange={(next) => update({ view: next })}
                  options={[
                    { value: 'list', label: t('search.listView'), icon: List },
                    { value: 'map', label: t('search.mapView'), icon: MapIcon },
                  ]}
                  ariaLabel={t('search.listView')}
                />
                <Select
                  value={sort}
                  onChange={(event) => update({ sort: event.target.value })}
                  aria-label={t('search.sort')}
                  className="h-9 w-[190px] text-[13px]"
                >
                  <option value="recommended">{t('search.sortRecommended')}</option>
                  <option value="price-asc">{t('search.sortPriceLow')}</option>
                  <option value="price-desc">{t('search.sortPriceHigh')}</option>
                  <option value="rating">{t('search.sortRating')}</option>
                  <option value="availability">{t('search.sortAvailability')}</option>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="overflow-hidden rounded-xl border border-border bg-card">
                    <Skeleton className="aspect-[16/10] rounded-none" />
                    <div className="space-y-3 p-4">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              <ErrorState
                className="mt-5"
                title={t('common.somethingWrong')}
                description={t('errors.network')}
                onRetry={() => void refetch()}
                retryLabel={t('common.retry')}
              />
            ) : facilities.length === 0 ? (
              <EmptyState
                className="mt-5"
                icon={<SearchIcon />}
                title={t('search.noResultsTitle')}
                description={t('search.noResultsText')}
                action={
                  <Button variant="outline" onClick={clearFilters} leftIcon={<RotateCcw />}>
                    {t('search.clearFilters')}
                  </Button>
                }
              />
            ) : view === 'map' ? (
              <div className="mt-5 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                <div className="xl:sticky xl:top-24 xl:self-start">
                  <FacilitiesMap
                    facilities={mapFacilities}
                    activeId={activeFacilityId}
                    onSelect={(id) => {
                      setActiveFacilityId(id);
                      document.getElementById(`result-${id}`)?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                      });
                    }}
                    className="h-[380px] sm:h-[480px] xl:h-[600px]"
                  />
                </div>
                <div className="space-y-2.5">
                  {facilities.map((facility) => (
                    <Link
                      key={facility.id}
                      id={`result-${facility.id}`}
                      to={`/facilities/${facility.slug}`}
                      onMouseEnter={() => setActiveFacilityId(facility.id)}
                      className={cn(
                        'flex gap-3 rounded-xl border bg-card p-3 transition-[border-color,box-shadow]',
                        activeFacilityId === facility.id
                          ? 'border-gold-400 shadow-md'
                          : 'border-border hover:border-ink-300 dark:hover:border-navy-700',
                      )}
                    >
                      <FacilityImage
                        src={facility.image}
                        alt={tx(facility.name)}
                        className="h-[74px] w-[92px] shrink-0 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-[13px] font-semibold text-foreground">{tx(facility.name)}</p>
                          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {tx(CITY_LABELS[facility.city])} · {tx(facility.district)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <Badge tone={facility.availableSpaces > 0 ? 'success' : 'danger'} size="sm" dot>
                            {t('search.spacesFree', { count: facility.availableSpaces })}
                          </Badge>
                          <span className="text-[11px] font-semibold text-foreground">
                            {formatAmount(facility.hourlyRate, language)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {facilities.map((facility) => (
                  <FacilityCard key={facility.id} facility={facility} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
