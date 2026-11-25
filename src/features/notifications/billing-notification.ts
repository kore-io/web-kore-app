import type { TFunction } from 'i18next';
import type { BillingEntryResponse } from '../../shared/api/generated/model';
import { oneDot, shortDayMonth } from '../../shared/date-texts';
import { formatCents } from '../../shared/money';

const KINDS = [
  'payment_confirmed',
  'refund_completed',
  'end_date_soon',
  'grace',
  'expired',
  'purge_soon',
  'courtesy',
] as const;

/** O aviso de cobrança, se o payload é um (um item por aviso; Publicar e pagar RN13). */
export function billingEntry(payload: readonly unknown[]): BillingEntryResponse | null {
  const [first] = payload;
  if (typeof first !== 'object' || first === null) return null;
  const kind = (first as { kind?: unknown }).kind;
  return KINDS.some((item) => item === kind) ? (first as BillingEntryResponse) : null;
}

/** Itens da central sem ponto final (Voz; textos da F3), nem o da abreviação no fim; o `oneDot` tira o duplo do meio ("dez.. Adiem"). */
function withoutFinalDot(text: string): string {
  return text.replace(/\.+$/, '');
}

/** Para onde o item leva (a decisão do orquestrador no E12). */
export type BillingDestination = 'payments' | 'endDate' | 'export';

/**
 * O título, o detalhe e o destino de um aviso de cobrança na central do casal (Publicar e
 * pagar RN13; Pagamentos RN07; Data de saída RN03 e RN06; Retenção RN02; Backoffice -
 * cobrança RN06; 293(7); 298(2); 314): os textos da Pena, sem ponto final; o valor só no
 * detalhe ("R$ 337,10 no cartão final 4821, 2x").
 */
export function billingTexts({
  entry,
  now,
  t,
}: {
  entry: BillingEntryResponse;
  now: Date;
  t: TFunction<'notifications'>;
}): { title: string; detail: string | null; destination: BillingDestination } {
  const day = (value: string | null | undefined) =>
    value ? shortDayMonth({ day: value.slice(0, 10), now }) : '';
  const money = (): string | null => {
    if (entry.amountCents === undefined) return null;
    const amount = formatCents({ cents: entry.amountCents });
    if (entry.method === 'pix') return t('billing.pix', { amount });
    const installments = entry.installments ?? 1;
    return installments > 1
      ? t('billing.cardInstallments', { amount, last4: entry.cardLast4 ?? '', count: installments })
      : t('billing.card', { amount, last4: entry.cardLast4 ?? '' });
  };
  const build = (title: string, destination: BillingDestination, detail: string | null = null) => ({
    title: withoutFinalDot(oneDot(title)),
    detail,
    destination,
  });
  switch (entry.kind) {
    case 'payment_confirmed':
      return build(
        t('billing.paymentConfirmed', { date: day(entry.endDate) }),
        'payments',
        money(),
      );
    case 'refund_completed':
      return build(t('billing.refundCompleted'), 'payments', money());
    case 'end_date_soon':
      return build(
        entry.daysLeft === 1
          ? t('billing.endDateTomorrow', { date: day(entry.endDate) })
          : t('billing.endDateSoon', { count: entry.daysLeft ?? 0, date: day(entry.endDate) }),
        'endDate',
      );
    case 'grace':
      return build(t('billing.grace', { date: day(entry.graceUntil) }), 'endDate');
    case 'expired':
      if (entry.paidThrough) {
        return build(t('billing.expiredPaidAhead', { date: day(entry.paidThrough) }), 'endDate');
      }
      // Sem data possível para renovar (renewUntil nulo): o sem renovação (Pena, item 9), com a
      // guarda dos dados no detalhe quando a API manda o purgeAt (336(3); ausente nos antigos).
      if (entry.renewUntil === null) {
        const kept = entry.purgeAt ? t('billing.keptUntil', { date: day(entry.purgeAt) }) : null;
        return build(t('billing.expiredFinal'), 'export', kept);
      }
      return build(t('billing.expired'), 'endDate');
    case 'purge_soon':
      return build(t('billing.purgeSoon', { date: day(entry.purgeAt) }), 'export');
    case 'courtesy':
      return build(t('billing.courtesy', { date: day(entry.endDate) }), 'payments');
  }
}
