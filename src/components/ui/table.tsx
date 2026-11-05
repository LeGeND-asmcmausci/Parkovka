import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { InputWithIcon } from './input';
import { EmptyState } from './states';
import { Pagination } from './misc';

export interface DataColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  align?: 'left' | 'right' | 'center';
  mobileHidden?: boolean;
  primary?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  searchFn?: (row: T, query: string) => boolean;
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  pageSize?: number;
  emptyTitle?: ReactNode;
  emptyText?: ReactNode;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  initialSort?: { id: string; dir: 'asc' | 'desc' };
  className?: string;
  plain?: boolean;
}

type SortState = { id: string; dir: 'asc' | 'desc' } | null;

export function DataTable<T>({
  data,
  columns,
  rowKey,
  searchFn,
  searchPlaceholder,
  toolbar,
  pageSize = 8,
  emptyTitle,
  emptyText,
  emptyAction,
  onRowClick,
  initialSort,
  className,
  plain = false,
}: DataTableProps<T>) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>(initialSort ?? null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!query.trim() || !searchFn) return data;
    return data.filter((row) => searchFn(row, query.trim().toLowerCase()));
  }, [data, query, searchFn]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((item) => item.id === sort.id);
    if (!column?.sortValue) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const aValue = column.sortValue!(a);
      const bValue = column.sortValue!(b);
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sort.dir === 'asc' ? aValue - bValue : bValue - aValue;
      }
      return sort.dir === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
    return copy;
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (id: string) => {
    setSort((current) => {
      if (current?.id !== id) return { id, dir: 'asc' };
      return { id, dir: current.dir === 'asc' ? 'desc' : 'asc' };
    });
    setPage(1);
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {(searchFn || toolbar) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {searchFn ? (
            <InputWithIcon
              icon={<Search />}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={searchPlaceholder ?? t('admin.tableSearch')}
              className="sm:w-72"
              aria-label={searchPlaceholder ?? t('common.search')}
            />
          ) : (
            <div />
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      {pageRows.length === 0 ? (
        <EmptyState
          title={emptyTitle ?? t('common.noResults')}
          description={emptyText}
          action={emptyAction}
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      scope="col"
                      className={cn(
                        'whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground',
                        column.align === 'right' && 'text-right',
                        column.align === 'center' && 'text-center',
                        column.className,
                      )}
                      aria-sort={
                        sort?.id === column.id
                          ? sort.dir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                    >
                      {column.sortValue ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.id)}
                          className={cn(
                            'inline-flex items-center gap-1 transition-colors hover:text-foreground',
                            sort?.id === column.id && 'text-foreground',
                          )}
                        >
                          {column.header}
                          {sort?.id === column.id ? (
                            sort.dir === 'asc' ? (
                              <ChevronUp className="size-3.5" />
                            ) : (
                              <ChevronDown className="size-3.5" />
                            )
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-50" />
                          )}
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageRows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'bg-card transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-muted/40',
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          'px-4 py-3.5 text-sm text-foreground',
                          column.align === 'right' && 'text-right',
                          column.align === 'center' && 'text-center',
                          column.className,
                        )}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {pageRows.map((row) => (
              <div
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'rounded-xl border border-border bg-card p-4 shadow-xs',
                  onRowClick && 'cursor-pointer',
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-3 border-b border-border pb-3">
                  <div className="min-w-0">{columns[0]?.cell(row)}</div>
                  {columns.find((column) => column.id === 'actions') && (
                    <div className="shrink-0">
                      {columns.find((column) => column.id === 'actions')?.cell(row)}
                    </div>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {columns
                    .slice(1)
                    .filter((column) => column.id !== 'actions' && !column.mobileHidden)
                    .map((column) => (
                      <div key={column.id} className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {column.header}
                        </dt>
                        <dd className="mt-0.5 break-words text-[13px] text-foreground">
                          {column.cell(row)}
                        </dd>
                      </div>
                    ))}
                </dl>
              </div>
            ))}
          </div>

          {!plain && (
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onPageChange={setPage}
              total={sorted.length}
              pageSize={pageSize}
              labels={{ previous: t('common.back'), next: t('common.next'), page: t('common.page') }}
            />
          )}
        </>
      )}
    </div>
  );
}
