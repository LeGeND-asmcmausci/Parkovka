import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { DataTable, type DataColumn } from '@/components/ui/table';

interface Row {
  id: string;
  name: string;
  city: string;
}

const rows: Row[] = [
  { id: '1', name: 'Markaziy Park', city: 'Tashkent' },
  { id: '2', name: 'Registon', city: 'Samarkand' },
  { id: '3', name: 'Ark', city: 'Bukhara' },
];

const columns: DataColumn<Row>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name, sortValue: (row) => row.name },
  { id: 'city', header: 'City', cell: (row) => row.city },
];

function renderTable(props: { emptyTitle?: ReactNode; emptyText?: ReactNode } = {}) {
  return render(
    <I18nProvider>
      <DataTable<Row>
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        searchFn={(row, query) =>
          row.name.toLowerCase().includes(query) || row.city.toLowerCase().includes(query)
        }
        searchPlaceholder="Search facilities"
        {...props}
      />
    </I18nProvider>,
  );
}

describe('DataTable', () => {
  it('renders a row per record', () => {
    renderTable();
    expect(screen.getAllByText('Markaziy Park').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Registon').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ark').length).toBeGreaterThan(0);
  });

  it('filters rows from the search field', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.type(screen.getByPlaceholderText('Search facilities'), 'samarkand');

    expect(screen.getAllByText('Registon').length).toBeGreaterThan(0);
    expect(screen.queryByText('Markaziy Park')).not.toBeInTheDocument();
    expect(screen.queryByText('Ark')).not.toBeInTheDocument();
  });

  it('shows the empty state when nothing matches', async () => {
    const user = userEvent.setup();
    renderTable({ emptyTitle: 'Nothing here', emptyText: 'Try another search' });

    await user.type(screen.getByPlaceholderText('Search facilities'), 'nomatch');

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Try another search')).toBeInTheDocument();
  });

  it('sorts by a sortable column header', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole('button', { name: /name/i }));

    const table = screen.getByRole('table');
    const bodyRows = within(table).getAllByRole('row').slice(1);
    const firstCells = bodyRows.map((row) => within(row).getAllByRole('cell')[0].textContent);
    expect(firstCells).toEqual(['Ark', 'Markaziy Park', 'Registon']);
  });
});
