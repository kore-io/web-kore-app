import { todayIn } from '../../site/site-texts';
import { addMonths, END_DATE_MAX_MONTHS_AFTER_EVENT } from '../lifecycle/lifecycle';

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** O que o casamento tem hoje, do /me (Data de saída RN01, RN04 e RN05). */
export interface EndDateSource {
  status: string;
  endDate: string | null;
  paidThrough: string | null;
  eventDate: string | null;
  timezone: string | null;
}

/**
 * Os limites da nova data (RN04 e RN05): de amanhã e depois do casamento até 12 meses depois
 * dele (o mesmo `addMonths` da API, 329(2)). Nulo sem a data do casamento.
 */
export function endDateLimits({ source, now }: { source: EndDateSource; now: Date }) {
  if (!source.eventDate) return null;
  const tomorrow = nextDay(todayIn({ timezone: source.timezone, now }));
  const dayAfterWedding = nextDay(source.eventDate);
  return {
    min: tomorrow > dayAfterWedding ? tomorrow : dayAfterWedding,
    max: addMonths({ day: source.eventDate, months: END_DATE_MAX_MONTHS_AFTER_EVENT }),
  };
}

/**
 * Há mês pago à frente que dá para usar de graça (RN04 e RN05; 289; 293(3)): o `paidThrough`
 * depois da data atual (quem antecipou) ou, no expirado, depois de hoje. No ar sem antecipar,
 * o `paidThrough` é a própria data: a ajuda é a comum, como no Penpot (A6).
 */
export function paidAhead({ source, now }: { source: EndDateSource; now: Date }): string | null {
  const { paidThrough } = source;
  if (!paidThrough) return null;
  const from =
    source.status === 'expired' ? todayIn({ timezone: source.timezone, now }) : source.endDate;
  return from && paidThrough > from ? paidThrough : null;
}

/**
 * O que a data escolhida faz (RN04 e RN05):
 * - `bringForward`: mais cedo que a atual, de graça e sem devolver dinheiro;
 * - `restore`: até o `paidThrough`, de graça (no expirado, volta ao ar; 289(1));
 * - `extend`: depois do `paidThrough`, a extensão paga (E11);
 * - `same`: a própria data atual; `invalid`: fora dos limites.
 */
export type EndDateChoice = 'bringForward' | 'restore' | 'extend' | 'same' | 'invalid';

export function endDateChoice({
  source,
  date,
  now,
}: {
  source: EndDateSource;
  date: string;
  now: Date;
}): EndDateChoice {
  const limits = endDateLimits({ source, now });
  if (!limits || date < limits.min || date > limits.max) return 'invalid';
  const expired = source.status === 'expired';
  if (!expired && source.endDate) {
    if (date === source.endDate) return 'same';
    if (date < source.endDate) return 'bringForward';
  }
  if (source.paidThrough && date <= source.paidThrough) return 'restore';
  return 'extend';
}

/**
 * Quem abre o Mudar a data (E11): o site publicado em qualquer fase (no ar, pós-evento,
 * carência e expirado; o sem renovação mostra a A7).
 */
export function canChangeEndDate({ status }: { status: string }): boolean {
  return ['published', 'post_event', 'grace', 'expired'].includes(status);
}
