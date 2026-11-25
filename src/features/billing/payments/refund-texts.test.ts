import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import type { BillingPaymentDto } from '../../../shared/api/generated/model';
import { refundDescription } from './refund';

const t = i18next.getFixedT('pt-BR', 'billing');
const now = new Date('2026-08-14T15:00:00Z');
/** O texto como o app escreve: o espaço sem quebra depois do "R$". */
const nb = (text: string) => text.replace(/R\$ /g, 'R$\u00a0');

function payment(overrides: Partial<BillingPaymentDto>): BillingPaymentDto {
  return {
    id: 'p1',
    kind: 'publication',
    periodStart: '2026-08-10',
    periodEnd: '2027-02-14',
    monthsCovered: 7,
    amountCents: 33710,
    method: 'card',
    installments: 2,
    status: 'paid',
    paidAt: '2026-08-10T14:48:00Z',
    refundableUntil: '2026-08-18T02:59:59Z',
    disputeDeadline: null,
    refundEndDate: null,
    ...overrides,
  };
}

const card = payment({});
const cardInterest = payment({ installments: 8, amountCents: 35104 });
const pix = payment({ method: 'pix', installments: 1, amountCents: 32699 });
const extension = (overrides: Partial<BillingPaymentDto> = {}) =>
  payment({
    id: `e${overrides.amountCents ?? 8700}${overrides.method ?? 'card'}${overrides.paidAt ?? ''}`,
    kind: 'extension',
    amountCents: 8700,
    installments: 1,
    ...overrides,
  });
const describeFor = (publication: BillingPaymentDto, extensions: BillingPaymentDto[]) =>
  refundDescription({ payment: publication, payments: [publication, ...extensions], now, t });

describe('o texto do Dialog da publicação com extensões (Pena; decisões 327(3) e 328)', () => {
  it('no cartão, com o ajuste da 328: "no cartão … cada valor no cartão que pagou"', () => {
    expect(describeFor(card, [extension()])).toBe(
      nb(
        'O site sai do ar e volta a ser rascunho. Devolvemos R$ 424,10 no cartão: R$ 337,10 da publicação e R$ 87,00 da extensão, cada valor no cartão que pagou.',
      ),
    );
  });

  it('(b) com juros: "no cartão, com os juros"', () => {
    expect(describeFor(cardInterest, [extension()])).toBe(
      nb(
        'O site sai do ar e volta a ser rascunho. Devolvemos R$ 438,04 no cartão, com os juros: R$ 351,04 da publicação e R$ 87,00 da extensão, cada valor no cartão que pagou.',
      ),
    );
  });

  it('(a) tudo no Pix', () => {
    expect(describeFor(pix, [extension({ method: 'pix' })])).toBe(
      nb(
        'O site sai do ar e volta a ser rascunho. Devolvemos R$ 413,99 por Pix: R$ 326,99 da publicação e R$ 87,00 da extensão, cada valor para a conta que pagou.',
      ),
    );
  });

  it('(c) mais de uma extensão: a soma, "das extensões"', () => {
    expect(describeFor(card, [extension(), extension({ paidAt: '2026-08-13T10:00:00Z' })])).toBe(
      nb(
        'O site sai do ar e volta a ser rascunho. Devolvemos R$ 511,10 no cartão: R$ 337,10 da publicação e R$ 174,00 das extensões, cada valor no cartão que pagou.',
      ),
    );
  });

  it('(d) formas diferentes: o total e uma frase por forma, a publicação primeiro', () => {
    expect(describeFor(card, [extension({ method: 'pix' })])).toBe(
      nb(
        'O site sai do ar e volta a ser rascunho. Devolvemos R$ 424,10. A publicação, R$ 337,10, volta no cartão que pagou. A extensão, R$ 87,00, volta por Pix, para a conta que pagou.',
      ),
    );
    expect(describeFor(pix, [extension()])).toBe(
      nb(
        'O site sai do ar e volta a ser rascunho. Devolvemos R$ 413,99. A publicação, R$ 326,99, volta por Pix, para a conta que pagou. A extensão, R$ 87,00, volta no cartão que pagou.',
      ),
    );
  });

  it('(d) com juros: "com os juros" junto do valor que os tem', () => {
    expect(describeFor(cardInterest, [extension({ method: 'pix' })])).toBe(
      nb(
        'O site sai do ar e volta a ser rascunho. Devolvemos R$ 438,04. A publicação, R$ 351,04 com os juros, volta no cartão que pagou. A extensão, R$ 87,00, volta por Pix, para a conta que pagou.',
      ),
    );
  });

  it('(c) + (d): agrupa por forma ("a publicação e uma extensão", "a outra extensão", "as extensões")', () => {
    expect(
      describeFor(card, [
        extension(),
        extension({ method: 'pix', paidAt: '2026-08-13T10:00:00Z' }),
      ]),
    ).toBe(
      nb(
        'O site sai do ar e volta a ser rascunho. Devolvemos R$ 511,10. A publicação e uma extensão, R$ 424,10, voltam no cartão que pagou. A outra extensão, R$ 87,00, volta por Pix, para a conta que pagou.',
      ),
    );
    // O acréscimo da 328: duas extensões na forma da publicação e a outra em outra forma.
    expect(
      describeFor(card, [
        extension(),
        extension({ paidAt: '2026-08-12T10:00:00Z' }),
        extension({ method: 'pix', paidAt: '2026-08-13T10:00:00Z' }),
      ]),
    ).toBe(
      nb(
        'O site sai do ar e volta a ser rascunho. Devolvemos R$ 598,10. A publicação e as extensões, R$ 511,10, voltam no cartão que pagou. A outra extensão, R$ 87,00, volta por Pix, para a conta que pagou.',
      ),
    );
    expect(
      describeFor(card, [
        extension({ method: 'pix' }),
        extension({ method: 'pix', paidAt: '2026-08-13T10:00:00Z' }),
      ]),
    ).toBe(
      nb(
        'O site sai do ar e volta a ser rascunho. Devolvemos R$ 511,10. A publicação, R$ 337,10, volta no cartão que pagou. As extensões, R$ 174,00, voltam por Pix, para a conta que pagou.',
      ),
    );
  });
});
