import type { WeddingMemberResponse } from '../../shared/api/generated/model';
import { DEFAULT_TIMEZONE, dayAndTimeIn } from '../../shared/date-texts';

/** "AM" de "Ana Beatriz Moreira": a primeira letra do primeiro e do último nome. */
export function initials({ name }: { name: string }): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/**
 * Os grupos da tela (Papéis RN02 e RN03): o casal (donos) e a cerimonialista. O vendedor
 * não aparece (decisão 271(4)).
 */
export function memberGroups({ members }: { members: readonly WeddingMemberResponse[] }) {
  return {
    owners: members.filter((member) => member.role === 'owner'),
    planners: members.filter(
      (member) => member.role === 'collaborator' && member.kind === 'planner',
    ),
  };
}

const DAY_MONTH = (timezone: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: timezone });

/**
 * "16 de nov. às 14h": quando a trava de 48 h libera o Remover (Papéis RN06a), no fuso do
 * casamento.
 */
export function availableAtText({ at, timezone }: { at: string; timezone: string | null }): string {
  const zone = timezone ?? DEFAULT_TIMEZONE;
  const { time } = dayAndTimeIn({ at, timezone: zone });
  return `${DAY_MONTH(zone).format(new Date(at))} às ${time}`;
}

/**
 * "05/08" e, com outro ano, "05/08/2025": o início do vínculo no fuso do casamento
 * (decisões 271(1) e 274).
 */
export function sinceDate({
  at,
  timezone,
  now = new Date(),
}: {
  at: string;
  timezone: string | null;
  now?: Date;
}): string {
  const zone = timezone ?? DEFAULT_TIMEZONE;
  const { date, day } = dayAndTimeIn({ at, timezone: zone });
  const year = day.slice(0, 4);
  const currentYear = dayAndTimeIn({ at: now.toISOString(), timezone: zone }).day.slice(0, 4);
  return year === currentYear ? date : `${date}/${year}`;
}
