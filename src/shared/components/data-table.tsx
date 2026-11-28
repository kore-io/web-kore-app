import { createContext, useContext, useId, type CSSProperties, type ReactNode } from 'react';
import { useHorizontalOverflow } from '../hooks/use-horizontal-overflow';

/**
 * Tabela de dados das listas da F3 (Pagamentos, Comissões, Repasses e o Backoffice), no
 * molde da GroupTable do DS v0.18. Fica no app, montada com os átomos da lib (decisão 321):
 * o DS não tem uma tabela genérica, e promover ao DS fica como pendência do Penpot.
 */

/**
 * A largura de uma coluna no computador: `fill` divide o que sobra; as outras são fixas,
 * nos passos da GroupTable do DS v0.18 (72, 140, 220 px) e 300 px.
 */
export type DataTableColumnSize = 'fill' | 'xs' | 'sm' | 'md' | 'lg';

export interface DataTableColumn {
  /** A chave da coluna. */
  id: string;
  /** O rótulo do cabeçalho (texto do app). No cartão, vira o rótulo da célula. */
  header: string;
  size?: DataTableColumnSize;
  /** Valores em dinheiro e números alinham à direita na tabela. */
  align?: 'start' | 'end';
  /** Só para o leitor de tela (ex.: a coluna do ⋮); o cabeçalho não mostra. */
  hideHeader?: boolean;
  /**
   * A coluna das ações da linha (o ⋮, com `DataTableCell actions`): quando o quadro rola,
   * ela fica presa à direita, como a 1ª coluna à esquerda (decisão 348).
   */
  actions?: boolean;
}

/**
 * As larguras das colunas: cada tamanho encolhe até um mínimo quando o quadro aperta (o
 * computador estreito com a Sidebar, de 1024 px em diante; bloqueante do Crivo no PR da 346),
 * e a coluna flexível nunca fica abaixo da dela. Com espaço, as fixas chegam ao máximo e a
 * flexível fica com o resto.
 */
const MINIMUMS_REM: Record<DataTableColumnSize, number> = {
  fill: 7.5,
  xs: 3.5,
  sm: 4.5,
  md: 7,
  lg: 10.25,
};

const TRACKS: Record<DataTableColumnSize, string> = {
  fill: `minmax(${MINIMUMS_REM.fill}rem, 1fr)`,
  xs: `minmax(${MINIMUMS_REM.xs}rem, 72px)`,
  sm: `minmax(${MINIMUMS_REM.sm}rem, 140px)`,
  md: `minmax(${MINIMUMS_REM.md}rem, 220px)`,
  lg: `minmax(${MINIMUMS_REM.lg}rem, 300px)`,
};

/**
 * A largura mínima do cabeçalho e das linhas (decisão 348): os mínimos das colunas, os 16 px
 * entre elas e os 16 px de respiro em cada ponta. Abaixo dela, o quadro rola na horizontal,
 * e nenhuma coluna encolhe além do seu mínimo.
 */
function minimumWidth({ columns }: { columns: DataTableColumn[] }): string {
  const rem = columns.reduce((sum, column) => sum + MINIMUMS_REM[column.size ?? 'fill'], 0);
  const gapsRem = Math.max(columns.length - 1, 0) + 2;
  return `${rem + gapsRem}rem`;
}

function classNames(...names: (string | false | undefined)[]) {
  return names.filter(Boolean).join(' ');
}

/** O número de colunas, para a célula aberta da linha expansível ocupar todas. */
const ColumnCount = createContext(1);

export interface DataTableProps {
  /** Nome da tabela para o leitor de tela (texto do app). */
  label: string;
  columns: DataTableColumn[];
  /** As linhas (DataTableRow). */
  children: ReactNode;
  className?: string;
  /**
   * A tabela de muitas colunas, que não cabe no computador estreito com a Sidebar: cartões até
   * 1280 px, e a tabela só daí para cima (o padrão vira tabela em 1024 px, o `lg`).
   */
  wide?: boolean;
}

/**
 * No computador (≥ 1024 px), a tabela num painel branco, com o cabeçalho em gray.100; no
 * tablet e no celular, cartões. O DOM é um só, com os papéis de tabela do ARIA. No cartão,
 * o cabeçalho fica só para o leitor de tela (fora da vista, mas na árvore acessível): cada
 * valor continua lido com o nome da sua coluna. O rótulo visível do cartão é `aria-hidden`,
 * para não ler o nome duas vezes.
 * Quando as colunas não cabem (o computador estreito com a Sidebar), o quadro rola na
 * horizontal, e a página não (decisão 348, como a tabela de grupos da lib): a 1ª coluna e a
 * das ações ficam presas, com a sombra do lado em que há colunas escondidas, e o quadro vira
 * uma região nomeada pela tabela, na ordem do Tab, para as setas rolarem (WCAG 2.1.1).
 */
export function DataTable({ label, columns, children, className, wide = false }: DataTableProps) {
  const { ref, overflow } = useHorizontalOverflow<HTMLDivElement>();
  const tableId = useId();
  const style = {
    '--kore-data-table-columns': columns.map((column) => TRACKS[column.size ?? 'fill']).join(' '),
    '--kore-data-table-min-width': minimumWidth({ columns }),
  } as CSSProperties;
  return (
    <ColumnCount.Provider value={columns.length}>
      <div
        ref={ref}
        {...(overflow.scrolls ? { role: 'region', 'aria-labelledby': tableId, tabIndex: 0 } : {})}
        className={classNames(
          'kore-data-table',
          wide && 'kore-data-table--wide',
          overflow.scrolls && 'kore-data-table--scrolls',
          overflow.hiddenStart && 'kore-data-table--hidden-start',
          overflow.hiddenEnd && 'kore-data-table--hidden-end',
          className,
        )}
      >
        <div
          id={tableId}
          role="table"
          aria-label={label}
          aria-colcount={columns.length}
          style={style}
          className="kore-data-table__table"
        >
          <div role="rowgroup" className="kore-data-table__head">
            <div role="row" className="kore-data-table__header-row">
              {columns.map((column) => (
                <div
                  key={column.id}
                  role="columnheader"
                  className={classNames(
                    'kore-data-table__header',
                    column.align === 'end' && 'kore-data-table__header--end',
                    column.actions === true && 'kore-data-table__header--actions',
                  )}
                >
                  {column.hideHeader === true ? (
                    <span className="kore-data-table__sr-only">{column.header}</span>
                  ) : (
                    column.header
                  )}
                </div>
              ))}
            </div>
          </div>
          <div role="rowgroup" className="kore-data-table__body">
            {children}
          </div>
        </div>
      </div>
    </ColumnCount.Provider>
  );
}

export interface DataTableRowProps {
  /** As células (DataTableCell), na ordem das colunas. */
  children: ReactNode;
  /**
   * A linha leva a um detalhe: o app põe `data-row-link` no link do título, e a linha
   * inteira fica clicável (o link cobre a linha), com o hover do DS.
   */
  interactive?: boolean;
  /**
   * O conteúdo aberto da linha expansível (ex.: o Log da aplicação), numa célula de largura
   * inteira abaixo das outras. O app controla o botão (com `aria-expanded`) numa célula.
   */
  details?: ReactNode;
  className?: string;
}

export function DataTableRow({
  children,
  interactive = false,
  details,
  className,
}: DataTableRowProps) {
  const columnCount = useContext(ColumnCount);
  const hasDetails = details !== undefined && details !== null && details !== false;
  return (
    <div
      role="row"
      className={classNames(
        'kore-data-table__row',
        interactive && 'kore-data-table__row--interactive',
        className,
      )}
    >
      {children}
      {hasDetails && (
        <div role="cell" aria-colspan={columnCount} className="kore-data-table__details">
          {details}
        </div>
      )}
    </div>
  );
}

export interface DataTableCellProps {
  /** O rótulo da coluna, mostrado só no cartão (o cabeçalho da tabela já o diz). */
  label?: string;
  /** O título do cartão: no topo, sem rótulo, em type.label. */
  primary?: boolean;
  /** As ações da linha (o ⋮): no cartão, no topo, ao lado do título, sem rótulo. */
  actions?: boolean;
  align?: 'start' | 'end';
  /**
   * O texto do cartão, no lugar do rótulo e do valor da tabela, quando a Voz dá uma frase
   * própria (ex.: "1 pagamento"; decisão 350(13)). A tabela segue com o `children`.
   */
  cardText?: string;
  children?: ReactNode;
  className?: string;
}

/** Uma célula; vazia (`null`, `undefined` ou texto vazio), mostra o traço em gray.500. */
export function DataTableCell({
  label,
  primary = false,
  actions = false,
  align = 'start',
  cardText,
  children,
  className,
}: DataTableCellProps) {
  const empty = children === null || children === undefined || children === '';
  return (
    <div
      role="cell"
      className={classNames(
        'kore-data-table__cell',
        primary && 'kore-data-table__cell--primary',
        actions && 'kore-data-table__cell--actions',
        align === 'end' && 'kore-data-table__cell--end',
        cardText !== undefined && 'kore-data-table__cell--card-text',
        className,
      )}
    >
      {cardText !== undefined && <span className="kore-data-table__card-text">{cardText}</span>}
      {!primary && !actions && cardText === undefined && label !== undefined && (
        <span className="kore-data-table__cell-label" aria-hidden="true">
          {label}
        </span>
      )}
      <span className="kore-data-table__cell-value">
        {empty ? (
          <span className="kore-data-table__empty" aria-hidden="true">
            —
          </span>
        ) : (
          children
        )}
      </span>
    </div>
  );
}
