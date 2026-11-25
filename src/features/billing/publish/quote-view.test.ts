import { describe, expect, it } from 'vitest';
import type { BillingQuoteResponse, PricingResponse } from '../../../shared/api/generated/model';
import {
  capStartsAtMonths,
  installmentOptions,
  installmentSplit,
  isEndDateInRange,
  percentText,
  summaryRows,
} from './quote-view';

const pricing: PricingResponse = {
  priceVersion: '2026-11',
  activationCents: 14900,
  monthlyCents: 2900,
  capCents: 44900,
  pixDiscountPercent: 3,
  installments: {
    max: 12,
    interestFreeUpTo: 6,
    interestPercent: 3.99,
    interestBasisPoints: 399,
    interestFixedCents: 49,
    minInstallmentCents: 500,
  },
  endDateMaxMonthsAfterEvent: 12,
  referralDiscountPercent: 10,
};

/** A cotação do exemplo da RN09: 7 meses, desconto da assessoria, cartão em 8x. */
const quote: BillingQuoteResponse = {
  priceVersion: '2026-11',
  monthsCovered: 7,
  periodStart: '2026-11-15',
  periodEnd: '2027-02-14',
  activationListCents: 14900,
  monthlyListCents: 2900,
  listTotalCents: 35200,
  capDiscountCents: 0,
  referralDiscountCents: 1490,
  referralLabel: 'assessoria',
  pixDiscountCents: 0,
  installmentInterestCents: 1394,
  totalCents: 35104,
  installments: 8,
  installmentCents: 4388,
  firstInstallmentCents: 4388,
  maxInstallments: 12,
  totalsByMethod: { pix: 32699, cardUpTo6: 33710, cardChosen: 35104 },
  endDateMin: '2026-11-15',
  endDateMax: '2027-11-14',
  canExtend: true,
  cannotExtendReason: null,
};

describe('as parcelas pela regra da RN01 (a diferença na 1ª)', () => {
  it('os exemplos da RN09: 2x, 3x e 8x', () => {
    expect(installmentSplit({ totalCents: 33710, count: 2 })).toEqual({
      first: 16855,
      rest: 16855,
    });
    expect(installmentSplit({ totalCents: 33710, count: 3 })).toEqual({
      first: 11238,
      rest: 11236,
    });
    expect(installmentSplit({ totalCents: 35104, count: 8 })).toEqual({ first: 4388, rest: 4388 });
  });

  it('a soma das parcelas fecha com o total, de 1x a 12x (B1-3)', () => {
    for (let count = 1; count <= 12; count += 1) {
      const { first, rest } = installmentSplit({ totalCents: 35104, count });
      expect(first + rest * (count - 1)).toBe(35104);
    }
  });

  it('as opções: sem juros até 6x, com o total da 2ª cotação acima', () => {
    const options = installmentOptions({
      maxInstallments: 12,
      interestFreeUpTo: 6,
      cardWithoutInterestCents: 33710,
      cardWithInterestCents: 35104,
    });
    expect(options).toHaveLength(12);
    expect(options[5]).toMatchObject({ count: 6, totalCents: 33710, withInterest: false });
    expect(options[7]).toMatchObject({
      count: 8,
      totalCents: 35104,
      withInterest: true,
      first: 4388,
    });
  });

  it('sem o total com juros ainda, só as opções sem juros; o máximo é o da cotação', () => {
    expect(
      installmentOptions({
        maxInstallments: 12,
        interestFreeUpTo: 6,
        cardWithoutInterestCents: 33710,
        cardWithInterestCents: null,
      }).map((option) => option.count),
    ).toEqual([1, 2, 3, 4, 5, 6]);
    expect(
      installmentOptions({
        maxInstallments: 5,
        interestFreeUpTo: 6,
        cardWithoutInterestCents: 2900,
        cardWithInterestCents: null,
      }),
    ).toHaveLength(5);
  });
});

describe('as linhas do Resumo (RN09)', () => {
  it('a ativação, os meses, o desconto da assessoria e os juros, com os descontos negativos', () => {
    expect(summaryRows({ quote })).toEqual([
      { kind: 'activation', cents: 14900 },
      { kind: 'months', months: 7, cents: 20300 },
      { kind: 'referral', label: 'assessoria', cents: -1490 },
      { kind: 'interest', installments: 8, cents: 1394 },
    ]);
  });

  it('o teto e o desconto do Pix quando a cotação os traz', () => {
    const rows = summaryRows({
      quote: {
        ...quote,
        monthsCovered: 12,
        listTotalCents: 49700,
        capDiscountCents: 4800,
        referralDiscountCents: null,
        referralLabel: null,
        pixDiscountCents: 1347,
        installmentInterestCents: 0,
        installments: 1,
      },
    });
    expect(rows).toEqual([
      { kind: 'activation', cents: 14900 },
      { kind: 'months', months: 12, cents: 34800 },
      { kind: 'cap', cents: -4800 },
      { kind: 'pix', cents: -1347 },
    ]);
  });

  it('sem a data escolhida (só os limites), nenhuma linha', () => {
    expect(
      summaryRows({
        quote: { ...quote, monthsCovered: null, activationListCents: null, listTotalCents: null },
      }),
    ).toEqual([]);
  });
});

describe('os números das frases', () => {
  it('o teto começa em 11 meses com os valores de 2026-11', () => {
    expect(capStartsAtMonths({ pricing })).toBe(11);
  });

  it('o percentual dos juros com a vírgula', () => {
    expect(percentText({ percent: 3.99 })).toBe('3,99%');
    expect(percentText({ percent: 3 })).toBe('3%');
  });

  it('a data dentro dos limites, as pontas incluídas', () => {
    const range = { min: '2026-11-15', max: '2027-11-14' };
    expect(isEndDateInRange({ endDate: '2026-11-15', ...range })).toBe(true);
    expect(isEndDateInRange({ endDate: '2027-11-14', ...range })).toBe(true);
    expect(isEndDateInRange({ endDate: '2026-11-14', ...range })).toBe(false);
    expect(isEndDateInRange({ endDate: '2027-12-14', ...range })).toBe(false);
  });
});
