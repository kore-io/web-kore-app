import { DEFAULT_TIMEZONE } from '../../../shared/date-texts';

/** O dia (AAAA-MM-DD) de um instante no fuso do casamento. */
export function dayIn({ at, timezone }: { at: string; timezone: string | null }): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone ?? DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(at));
}

/**
 * Um dia (AAAA-MM-DD) curto, como nas tabelas (Voz; decisões 274(6) e 326(4)): "10/08"; com
 * o ano só fora do ano corrente no fuso do casamento, "14/02/2027".
 */
export function numericDay({
  day,
  timezone,
  now,
}: {
  day: string;
  timezone: string | null;
  now: Date;
}): string {
  const [year, month, date] = day.split('-');
  const thisYear = dayIn({ at: now.toISOString(), timezone }).slice(0, 4);
  return year === thisYear ? `${date}/${month}` : `${date}/${month}/${year}`;
}

/** As situações que o casal vê (Pagamentos RN01): o `canceled` não aparece. */
export const VISIBLE_STATUSES = [
  'paid',
  'pending',
  'failed',
  'refund_requested',
  'refunded',
  'disputed',
] as const;
export type VisibleStatus = (typeof VISIBLE_STATUSES)[number];

export function visibleStatus(status: string): VisibleStatus | null {
  return VISIBLE_STATUSES.find((item) => item === status) ?? null;
}
