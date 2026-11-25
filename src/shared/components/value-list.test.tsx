import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../tests/a11y';
import { formatCents } from '../money';
import { Panel } from './panel';
import { ValueList, ValueRow, ValueTotal } from './value-list';

function summary() {
  return render(
    <Panel title="Resumo">
      <ValueList>
        <ValueRow label="Ativação" value={formatCents({ cents: 14900 })} />
        <ValueRow label="7 meses × R$ 29" value={formatCents({ cents: 20300 })} />
        <ValueRow
          label="Preço máximo do Kore"
          value={formatCents({ cents: -4800 })}
          caption="A publicação custa no máximo R$ 449, a partir de 11 meses."
        />
        <ValueRow label="Desconto da assessoria (10%)" value={formatCents({ cents: -1490 })} />
        <ValueTotal label="Total" value={formatCents({ cents: 33710 })} />
      </ValueList>
    </Panel>,
  );
}

describe('ValueList (Penpot 21, "Linha / …")', () => {
  it('cada linha é um termo com a sua descrição, na ordem', () => {
    summary();
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Ativação',
      '7 meses × R$ 29',
      'Preço máximo do Kore',
      'Desconto da assessoria (10%)',
      'Total',
    ]);
    expect(
      screen
        .getAllByRole('definition')
        .filter((item) => item.classList.contains('kore-value-list__value'))
        .map((item) => item.textContent),
    ).toEqual([14900, 20300, -4800, -1490, 33710].map((cents) => formatCents({ cents })));
  });

  it('a legenda fica na linha dela, como outra descrição', () => {
    summary();
    const caption = screen.getByText('A publicação custa no máximo R$ 449, a partir de 11 meses.');
    expect(caption.tagName).toBe('DD');
    expect(caption).toHaveClass('kore-value-list__caption');
    expect(caption.parentElement).toContainElement(screen.getByText('Preço máximo do Kore'));
  });

  it('o Total tem a classe própria (divisor e o valor em type.heading)', () => {
    summary();
    expect(screen.getByText('Total').parentElement).toHaveClass('kore-value-list__row--total');
  });

  it('sem violações de acessibilidade', async () => {
    const { container } = summary();
    await expectNoA11yViolations({ container });
  });
});
