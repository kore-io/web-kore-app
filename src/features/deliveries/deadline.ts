import { daysUntil } from '../site/site-texts';

/** Em que ponto o prazo está, no fuso do casamento (Prazo e respostas RN01 a RN03). */
export type DeadlineState =
  { kind: 'none' } | { kind: 'open'; daysLeft: number } | { kind: 'today' } | { kind: 'ended' };

export function deadlineState({
  deadline,
  timezone,
  now,
}: {
  deadline: string | null;
  timezone: string | null;
  now: Date;
}): DeadlineState {
  const days = daysUntil({ eventDate: deadline, timezone, now });
  if (days === null) return { kind: 'none' };
  if (days < 0) return { kind: 'ended' };
  if (days === 0) return { kind: 'today' };
  return { kind: 'open', daysLeft: days };
}
