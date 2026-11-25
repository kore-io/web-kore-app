import type { MeLifecycleResponse } from '../../../shared/api/generated/model';
import { todayIn } from '../../site/site-texts';

/** A data de saída do ar vai até 12 meses depois do casamento (decisão 39; Preço RN02). */
export const END_DATE_MAX_MONTHS_AFTER_EVENT = 12;

/**
 * Meses depois de um dia (AAAA-MM-DD), com a regra da API (`monthsAfter`): o dia que não
 * existe no mês de chegada vira o último dia dele (29/02 → 28/02; 31/01 → 28/02). Paridade
 * com a API pela 316(7) e a 329(2).
 */
export function addMonths({ day, months }: { day: string; months: number }): string {
  const from = new Date(`${day}T00:00:00Z`);
  const result = new Date(from);
  result.setUTCDate(1);
  result.setUTCMonth(from.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(from.getUTCDate(), lastDay));
  return result.toISOString().slice(0, 10);
}

/** Dias inteiros entre dois dias (AAAA-MM-DD). */
function daysBetween({ from, to }: { from: string; to: string }): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * O estado do ciclo de vida que a tela mostra (Data de saída do ar RN01 e RN06):
 * - `grace`: "Vence em N dias", com N = expiredAt − hoje no fuso (expiredAt = graceUntil +
 *   1 dia); "Último dia no ar" quando N = 1 (231 P2);
 * - `expired` em três versões: `renew` (Renovem), `paidAhead` (caso B, com o `paidThrough`
 *   depois de hoje: voltar de graça; 293(5)) e `final` (sem renovação: hoje já chegou a 12
 *   meses depois do casamento, sem data possível; 314(4) e 329(2));
 * - `post_event`: só o selo.
 * Com o casamento bloqueado, a faixa do bloqueio substitui estas (RN06; 329(4)).
 */
export type LifecycleView =
  | { kind: 'grace'; daysLeft: number; graceUntil: string }
  | {
      kind: 'expired';
      variant: 'renew' | 'paidAhead' | 'final';
      since: string;
      paidThrough: string | null;
    }
  | { kind: 'post_event' }
  | { kind: 'none' };

export function lifecycleView({
  lifecycle,
  eventDate,
  timezone,
  now,
}: {
  /** O do /me ou o do GET …/billing (o status vem como texto). */
  lifecycle: Pick<MeLifecycleResponse, 'graceUntil' | 'expiredAt' | 'paidThrough'> & {
    status: string;
  };
  eventDate: string | null;
  timezone: string | null;
  now: Date;
}): LifecycleView {
  const today = todayIn({ timezone, now });
  if (lifecycle.status === 'grace' && lifecycle.graceUntil) {
    const daysLeft = daysBetween({ from: today, to: nextDay(lifecycle.graceUntil) });
    return { kind: 'grace', daysLeft: Math.max(daysLeft, 1), graceUntil: lifecycle.graceUntil };
  }
  if (lifecycle.status === 'expired') {
    const since = (lifecycle.expiredAt ?? today).slice(0, 10);
    const limit = eventDate
      ? addMonths({ day: eventDate, months: END_DATE_MAX_MONTHS_AFTER_EVENT })
      : null;
    if (limit && today >= limit) {
      return { kind: 'expired', variant: 'final', since, paidThrough: lifecycle.paidThrough };
    }
    if (lifecycle.paidThrough && lifecycle.paidThrough > today) {
      return { kind: 'expired', variant: 'paidAhead', since, paidThrough: lifecycle.paidThrough };
    }
    return { kind: 'expired', variant: 'renew', since, paidThrough: lifecycle.paidThrough };
  }
  if (lifecycle.status === 'post_event') return { kind: 'post_event' };
  return { kind: 'none' };
}
