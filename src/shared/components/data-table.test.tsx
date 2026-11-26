import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../tests/a11y';
import { Badge } from '@kore-io/design';
import { DataTable, DataTableCell, DataTableRow, type DataTableColumn } from './data-table';

const columns: DataTableColumn[] = [
  { id: 'couple', header: 'Casal' },
  { id: 'status', header: 'Status', size: 'sm' },
  { id: 'amount', header: 'Valor', size: 'sm', align: 'end' },
  { id: 'actions', header: 'Ações', size: 'xs', hideHeader: true },
];

function payment({ details }: { details?: string } = {}) {
  return (
    <DataTableRow interactive {...(details !== undefined && { details })}>
      <DataTableCell primary>
        <a href="/admin/cobranca/p1" data-row-link>
          Ana & Marcos
        </a>
      </DataTableCell>
      <DataTableCell label="Status">
        <Badge tone="success">Pago</Badge>
      </DataTableCell>
      <DataTableCell label="Valor" align="end">
        R$ 424,10
      </DataTableCell>
      <DataTableCell actions>
        <button type="button">Ações de Ana & Marcos</button>
      </DataTableCell>
    </DataTableRow>
  );
}

function renderTable(children = payment()) {
  return render(
    <DataTable label="Pagamentos" columns={columns}>
      {children}
    </DataTable>,
  );
}

describe('DataTable (no molde da GroupTable do DS v0.18)', () => {
  it('a tabela do ARIA com os cabeçalhos das colunas e as células na mesma ordem', () => {
    renderTable();
    const table = screen.getByRole('table', { name: 'Pagamentos' });
    expect(table).toHaveAttribute('aria-colcount', '4');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Casal', 'Status', 'Valor', 'Ações']);
    const [, row] = within(table).getAllByRole('row');
    expect(within(row as HTMLElement).getAllByRole('cell')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Ana & Marcos' })).toBeInTheDocument();
  });

  it('as larguras das colunas vão para o grid, pelo size', () => {
    renderTable();
    expect(screen.getByRole('table').style.getPropertyValue('--kore-data-table-columns')).toBe(
      'minmax(7.5rem, 1fr) minmax(4.5rem, 140px) minmax(4.5rem, 140px) minmax(3.5rem, 72px)',
    );
  });

  it('a tabela larga (wide) ganha a classe que mantém os cartões até 1280 px', () => {
    const { rerender } = renderTable();
    expect(screen.getByRole('table')).not.toHaveClass('kore-data-table--wide');
    rerender(
      <DataTable label="Pagamentos" columns={columns} wide>
        {payment()}
      </DataTable>,
    );
    expect(screen.getByRole('table')).toHaveClass('kore-data-table--wide');
  });

  it('o cabeçalho fica na árvore acessível também no cartão (só fora da vista)', () => {
    renderTable();
    const head = screen.getAllByRole('rowgroup')[0];
    // O jsdom não aplica o CSS: confere a classe que tira só da vista (sr-only), e não da
    // árvore (o hidden do L1 da lib, achado do Crivo).
    expect(head).toHaveClass('kore-data-table__head');
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
  });

  it('o rótulo do cartão fica fora da árvore acessível (o cabeçalho já o diz)', () => {
    renderTable();
    const amount = screen.getByText('R$ 424,10').closest('[role="cell"]') as HTMLElement;
    expect(within(amount).getByText('Valor')).toHaveAttribute('aria-hidden', 'true');
    expect(amount).toHaveClass('kore-data-table__cell--end');
  });

  it('o título e as ações do cartão sem o rótulo da coluna', () => {
    renderTable();
    const title = screen.getByRole('link', { name: 'Ana & Marcos' }).closest('[role="cell"]');
    const actions = screen
      .getByRole('button', { name: 'Ações de Ana & Marcos' })
      .closest('[role="cell"]');
    expect(title).toHaveClass('kore-data-table__cell--primary');
    expect(actions).toHaveClass('kore-data-table__cell--actions');
    expect(title?.querySelector('.kore-data-table__cell-label')).toBeNull();
    expect(actions?.querySelector('.kore-data-table__cell-label')).toBeNull();
  });

  it('a célula vazia mostra o traço', () => {
    render(
      <DataTable label="Pagamentos" columns={columns.slice(0, 2)}>
        <DataTableRow>
          <DataTableCell primary>Ana & Marcos</DataTableCell>
          <DataTableCell label="Status">{null}</DataTableCell>
        </DataTableRow>
      </DataTable>,
    );
    expect(screen.getByText('—')).toHaveAttribute('aria-hidden', 'true');
  });

  it('a coluna com hideHeader tem o nome só para o leitor de tela', () => {
    renderTable();
    expect(screen.getByRole('columnheader', { name: 'Ações' }).firstElementChild).toHaveClass(
      'kore-data-table__sr-only',
    );
  });

  it('a linha expansível mostra o conteúdo aberto numa célula própria', () => {
    renderTable(payment({ details: 'Pedido de 14/11 às 10h02 · IP 3f2a…' }));
    const details = screen.getByText('Pedido de 14/11 às 10h02 · IP 3f2a…');
    expect(details).toHaveAttribute('role', 'cell');
    expect(details).toHaveClass('kore-data-table__details');
    // Ocupa todas as colunas (sugestão do Crivo no L1 da lib).
    expect(details).toHaveAttribute('aria-colspan', '4');
  });

  it('a linha clicável ganha a classe modificadora', () => {
    renderTable();
    const [, row] = screen.getAllByRole('row');
    expect(row).toHaveClass('kore-data-table__row--interactive');
  });

  it('sem violações de acessibilidade', async () => {
    const { container } = renderTable(
      <>
        {payment()}
        {payment({ details: 'Detalhe' })}
      </>,
    );
    await expectNoA11yViolations({ container });
  });
});
