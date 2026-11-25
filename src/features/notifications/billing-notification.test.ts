import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import type { BillingEntryResponse } from '../../shared/api/generated/model';
import { billingEntry, billingTexts } from './billing-notification';

const t = i18next.getFixedT('pt-BR', 'notifications');
const now = new Date('2026-12-01T15:00:00Z');
const at = '2026-08-10T14:48:00Z';
/** O texto como o app escreve: o espaço sem quebra depois do "R$". */
const nb = (text: string) => text.replace(/R\$ /g, 'R$\u00a0');
const texts = (entry: Partial<BillingEntryResponse>) =>
  billingTexts({ entry: { at, ...entry } as BillingEntryResponse, now, t });

describe('os avisos de cobrança na central do casal (E12; decisões 298(2) e 336)', () => {
  it('pagamento confirmado: o título sem ponto e o valor só no detalhe, no cartão e no Pix', () => {
    const card = {
      kind: 'payment_confirmed',
      endDate: '2027-02-14',
      amountCents: 33710,
      method: 'card',
      installments: 2,
      cardLast4: '4821',
    } as const;
    expect(texts(card)).toEqual({
      title: 'Pagamento confirmado. O site está no ar até 14 de fev. de 2027',
      detail: nb('R$ 337,10 no cartão final 4821, 2x'),
      destination: 'payments',
    });
    expect(texts({ ...card, installments: 1 }).detail).toBe(nb('R$ 337,10 no cartão final 4821'));
    expect(
      texts({ ...card, method: 'pix', amountCents: 32699, installments: 1, cardLast4: null })
        .detail,
    ).toBe(nb('R$ 326,99 por Pix'));
  });

  it('reembolso concluído e cortesia: Pagamentos', () => {
    expect(
      texts({ kind: 'refund_completed', amountCents: 33710, method: 'card', cardLast4: '4821' }),
    ).toEqual({
      title: 'Reembolso concluído',
      detail: nb('R$ 337,10 no cartão final 4821'),
      destination: 'payments',
    });
    expect(texts({ kind: 'courtesy', endDate: '2027-05-14' })).toMatchObject({
      title: 'O Kore estendeu o site sem custo. Ele fica no ar até 14 de mai. de 2027',
      destination: 'payments',
    });
  });

  it('a saída do ar: daqui a 7 dias e amanhã (298(2)), e a carência, levam a Mudar a data', () => {
    expect(texts({ kind: 'end_date_soon', endDate: '2027-02-14', daysLeft: 7 })).toMatchObject({
      title: 'O site fica no ar até 14 de fev. de 2027, daqui a 7 dias. Adiem a data para mantê-lo',
      destination: 'endDate',
    });
    expect(texts({ kind: 'end_date_soon', endDate: '2026-12-02', daysLeft: 1 }).title).toBe(
      'O site fica no ar até amanhã, 2 de dez. Adiem a data para mantê-lo',
    );
    // O mesmo texto no 1º e no 5º dia, sem o ponto da abreviação no fim (336(4)).
    for (const day of [1, 5] as const) {
      expect(texts({ kind: 'grace', day, graceUntil: '2026-12-08' })).toMatchObject({
        title: 'A data de saída do ar passou. O site fica no ar só até 8 de dez',
        destination: 'endDate',
      });
    }
  });

  it('o expirado: Renovem, o caso B (293(7)) e o sem renovação (Pena, item 9)', () => {
    expect(
      texts({
        kind: 'expired',
        expiredAt: '2026-11-28',
        renewUntil: '2027-11-14',
        paidThrough: null,
      }),
    ).toMatchObject({
      title: 'O site saiu do ar. Renovem para os convidados voltarem a vê-lo',
      destination: 'endDate',
    });
    expect(
      texts({
        kind: 'expired',
        expiredAt: '2026-11-28',
        renewUntil: '2027-11-14',
        paidThrough: '2027-02-14',
      }),
    ).toMatchObject({
      title:
        'O site saiu do ar. Vocês já pagaram até 14 de fev. de 2027: voltem o site ao ar, sem custo',
      destination: 'endDate',
    });
    const final = {
      kind: 'expired',
      expiredAt: '2027-11-22',
      renewUntil: null,
      paidThrough: null,
    } as const;
    expect(texts(final)).toEqual({
      title: 'O site saiu do ar e não pode mais ser renovado. Exportem os convidados',
      detail: null,
      destination: 'export',
    });
    // Com o purgeAt (336(3)), a guarda dos dados no detalhe, sem ponto final.
    expect(texts({ ...final, purgeAt: '2028-05-22' }).detail).toBe(
      'Os dados ficam guardados até 22 de mai. de 2028',
    );
  });

  it('o aviso de exclusão dos dados: a data, sem o ponto final, e o Exportar', () => {
    expect(texts({ kind: 'purge_soon', purgeAt: '2027-08-22' })).toEqual({
      title: 'Os dados do casamento serão apagados em 22 de ago. de 2027',
      detail: null,
      destination: 'export',
    });
  });

  it('billingEntry: só os tipos conhecidos', () => {
    expect(billingEntry([{ kind: 'grace' }])).not.toBeNull();
    expect(billingEntry([{ kind: 'outro' }])).toBeNull();
    expect(billingEntry([])).toBeNull();
  });
});
