import { describe, expect, it } from 'vitest';
import { formatCents, formatRulePrice } from './money';

const NBSP = ' ';

describe('formatCents', () => {
  it('sempre com os centavos, o ponto no milhar e o espaço sem quebra', () => {
    expect(formatCents({ cents: 123456 })).toBe(`R$${NBSP}1.234,56`);
    expect(formatCents({ cents: 8700 })).toBe(`R$${NBSP}87,00`);
    expect(formatCents({ cents: 0 })).toBe(`R$${NBSP}0,00`);
    expect(formatCents({ cents: 5 })).toBe(`R$${NBSP}0,05`);
    expect(formatCents({ cents: 100000000 })).toBe(`R$${NBSP}1.000.000,00`);
  });

  it('negativo com o sinal de menos tipográfico, sem espaço', () => {
    expect(formatCents({ cents: -1011 })).toBe(`−R$${NBSP}10,11`);
  });
});

describe('formatRulePrice', () => {
  it('sem os centavos quando o valor é inteiro em reais', () => {
    expect(formatRulePrice({ cents: 2900 })).toBe(`R$${NBSP}29`);
    expect(formatRulePrice({ cents: 5000 })).toBe(`R$${NBSP}50`);
    expect(formatRulePrice({ cents: 144900 })).toBe(`R$${NBSP}1.449`);
  });

  it('com os centavos quando não é', () => {
    expect(formatRulePrice({ cents: 1740 })).toBe(`R$${NBSP}17,40`);
  });
});
