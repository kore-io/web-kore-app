import { useQuery } from '@tanstack/react-query';
import type { PutRsvpBody, RsvpResponse } from '../../shared/api/generated/model';
import { rsvpControllerGetV1, rsvpControllerPutV1 } from '../../shared/api/generated/sites/sites';
import { ApiError, apiErrorCode } from '../../shared/api/http-client';

export const rsvpQueryKey = (slug: string) => ['rsvp', slug] as const;

/**
 * O RSVP do grupo pelo `GET /v1/sites/{slug}/rsvp` (Confirmar presença RN01, RN03, RN08):
 * com o cookie do grupo ou, na prévia como grupo, o da prévia (`state: preview`).
 */
export function useRsvp({ slug, enabled = true }: { slug: string; enabled?: boolean }) {
  return useQuery({
    queryKey: rsvpQueryKey(slug),
    enabled,
    queryFn: () => rsvpControllerGetV1(slug),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** O que o envio deu, para a tela (RN07 a RN11, RN14). */
export type SendResult =
  | { kind: 'saved'; rsvp: RsvpResponse }
  | { kind: 'invalid'; errors: { path: string; code: string }[] }
  | { kind: 'changed'; rsvp: RsvpResponse }
  | { kind: 'closed'; reason: 'deadline_passed' | 'post_event' }
  | { kind: 'linkInvalid' }
  | { kind: 'previewReadOnly' }
  | { kind: 'limit' }
  | { kind: 'rateLimited' }
  | { kind: 'failed' };

/** O `PUT /v1/sites/{slug}/rsvp`, com cada recusa do contrato no resultado. */
export async function sendRsvp({ slug, body }: { slug: string; body: PutRsvpBody }) {
  try {
    return { kind: 'saved', rsvp: await rsvpControllerPutV1(slug, body) } as SendResult;
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown): SendResult {
  if (!(error instanceof ApiError)) return { kind: 'failed' };
  const code = apiErrorCode({ error });
  const body = error.body as {
    errors?: { path: string; code: string }[];
    current?: RsvpResponse;
    reason?: 'deadline_passed' | 'post_event';
  };
  if (error.status === 400 && body.errors) return { kind: 'invalid', errors: body.errors };
  if (code === 'RSVP_CHANGED' && body.current) return { kind: 'changed', rsvp: body.current };
  if (code === 'RSVP_CLOSED') return { kind: 'closed', reason: body.reason ?? 'deadline_passed' };
  if (error.status === 401) return { kind: 'linkInvalid' };
  if (code === 'PREVIEW_READ_ONLY') return { kind: 'previewReadOnly' };
  if (code === 'RSVP_LIMIT') return { kind: 'limit' };
  // O 429 por minuto tem o texto dele (decisão 232(6)).
  if (code === 'RSVP_RATE_LIMITED') return { kind: 'rateLimited' };
  // A rede, o 5xx e o 429 geral: tentar de novo, com o que foi marcado.
  return { kind: 'failed' };
}

const SHORT = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const SHORT_YEAR = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** O prazo por extenso curto, sem o ano corrente: "15 de out." (R2, RN03). */
export function deadlineText({ day, now }: { day: string; now: Date }): string {
  const date = new Date(`${day}T12:00:00Z`);
  return (date.getUTCFullYear() === now.getFullYear() ? SHORT : SHORT_YEAR).format(date);
}
