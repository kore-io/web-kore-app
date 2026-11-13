import type { TFunction } from 'i18next';
import type { ActivityResponse, DashboardStatsResponse } from '../../shared/api/generated/model';
import { shortDayMonth } from '../../shared/date-texts';

type DashboardT = TFunction<'dashboard'>;

const LIST = new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' });
const WEEKDAY_DAY_MONTH = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const WEEKDAY_DAY_MONTH_YEAR = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "a", "a e b", "a, b e c": a parte com zero já saiu antes (RN02). */
function joined(parts: string[]): string {
  return LIST.format(parts);
}

/**
 * A linha do cabeçalho (RN01): "Faltam 26 dias para o casamento · sáb., 14 de nov.",
 * "Falta 1 dia…", no dia "O casamento é hoje!"; sem data ou depois do dia, nula. Os dias
 * vêm do servidor, no fuso do casamento.
 */
export function countdownLine({
  t,
  daysUntilEvent,
  eventDate,
  now,
}: {
  t: DashboardT;
  daysUntilEvent: number | null;
  eventDate: string | null;
  now: Date;
}): string | null {
  if (daysUntilEvent === null || eventDate === null || daysUntilEvent < 0) return null;
  if (daysUntilEvent === 0) return t('header.today');
  return t('header.countdown', { count: daysUntilEvent, date: longDate({ day: eventDate, now }) });
}

/** "sáb., 14 de nov." e, fora do ano corrente, "sáb., 14 de fev. de 2027" (Penpot 03). */
export function longDate({ day, now }: { day: string; now: Date }): string {
  const date = new Date(`${day}T12:00:00Z`);
  const format =
    date.getUTCFullYear() === now.getFullYear() ? WEEKDAY_DAY_MONTH : WEEKDAY_DAY_MONTH_YEAR;
  return format.format(date);
}

/** Convidados (RN02): "em 58 grupos · 96 confirmados, 18 recusados e 28 pendentes". */
export function guestsDetail({
  t,
  stats,
}: {
  t: DashboardT;
  stats: DashboardStatsResponse;
}): string {
  const parts = [
    stats.confirmed > 0 && t('guests.confirmed', { count: stats.confirmed }),
    stats.declined > 0 && t('guests.declined', { count: stats.declined }),
    stats.pending > 0 && t('guests.pending', { count: stats.pending }),
  ].filter((part): part is string => Boolean(part));
  const parties = t('guests.parties', { count: stats.partiesTotal });
  return parts.length > 0 ? `${parties} · ${joined(parts)}` : parties;
}

/**
 * Buffet (RN02): "82 adultos, 11 crianças e 3 bebês confirmados"; a faixa com zero sai, e
 * quem não tem faixa entra só no total. Sem nenhuma faixa, só o total.
 */
export function buffetDetail({
  t,
  stats,
}: {
  t: DashboardT;
  stats: DashboardStatsResponse;
}): string {
  const parts = [
    stats.adultsConfirmed > 0 && t('buffet.adults', { count: stats.adultsConfirmed }),
    stats.childrenConfirmed > 0 && t('buffet.children', { count: stats.childrenConfirmed }),
    stats.babiesConfirmed > 0 && t('buffet.babies', { count: stats.babiesConfirmed }),
  ].filter((part): part is string => Boolean(part));
  // Sem faixa etária: só o total, "0 confirmados" (Penpot 03, antes de publicar).
  if (parts.length === 0) return t('guests.confirmed', { count: stats.confirmed });
  // Uma pessoa só concorda com ela ("1 criança confirmada"); senão, "confirmados".
  const total = stats.adultsConfirmed + stats.childrenConfirmed + stats.babiesConfirmed;
  const key =
    total === 1 && stats.childrenConfirmed === 1
      ? 'buffet.detailOneChild'
      : total === 1
        ? 'buffet.detailOne'
        : 'buffet.detail';
  return t(key, { parts: joined(parts) });
}

/** Taxa de resposta (RN02): "114 de 142 responderam · prazo: 15 de out." ou "· sem prazo". */
export function rateDetail({
  t,
  stats,
  deadline,
  now,
}: {
  t: DashboardT;
  stats: DashboardStatsResponse;
  deadline: string | null;
  now: Date;
}): string {
  const responded = t('rate.responded', {
    responded: stats.confirmed + stats.declined,
    total: stats.guestsTotal,
  });
  return `${responded} · ${deadline ? t('rate.deadline', { date: shortDayMonth({ day: deadline, now }) }) : t('rate.noDeadline')}`;
}

/**
 * A data da atividade (RN04; textos-f4 R6): "hoje às 20h14", "ontem às 20h14" e, antes,
 * "24/09 às 19h40"; na hora cheia, "20h".
 */
export function activityDate({ t, at, now }: { t: DashboardT; at: string; now: Date }): string {
  const date = new Date(at);
  const two = (value: number) => String(value).padStart(2, '0');
  const time =
    date.getMinutes() === 0
      ? `${date.getHours()}h`
      : `${date.getHours()}h${two(date.getMinutes())}`;
  const dayOf = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const diff = Math.round((dayOf(now).getTime() - dayOf(date).getTime()) / 86_400_000);
  if (diff === 0) return t('activity.today', { time });
  if (diff === 1) return t('activity.yesterday', { time });
  return t('activity.on', { date: `${two(date.getDate())}/${two(date.getMonth() + 1)}`, time });
}

/**
 * Um item da Atividade recente (RN04; o texto da central, R7): 1 grupo, "Família Moreira
 * respondeu o convite" e "3 confirmados, 1 recusado"; vários, "3 grupos responderam" e os
 * nomes separados por " · ", com "+ 2 grupos" depois de 3. Sem nome de convidado nem
 * restrição.
 */
export function activityTexts({ t, item }: { t: DashboardT; item: ActivityResponse }) {
  const [first] = item.groups;
  if (item.count <= 1 && first) {
    const parts = [
      first.confirmed > 0 && t('activity.confirmed', { count: first.confirmed }),
      first.declined > 0 && t('activity.declined', { count: first.declined }),
    ].filter((part): part is string => Boolean(part));
    return {
      title: t('activity.one', { name: first.name }),
      detail: parts.length > 0 ? parts.join(', ') : null,
    };
  }
  const names = item.groups.slice(0, 3).map((group) => group.name);
  const more = item.count - names.length;
  return {
    title: t('activity.many', { count: item.count }),
    detail: [...names, ...(more > 0 ? [t('activity.more', { count: more })] : [])].join(' · '),
  };
}
