import { ApiError, apiErrorCode } from '../shared/api/http-client';

/**
 * O site fora do ar para o convidado (Data de saída RN08; Bloqueado RN05): o `410
 * SITE_EXPIRED` (expirado ou exclusão agendada) e o `423 SITE_UNAVAILABLE` (bloqueado),
 * em qualquer entrada (o site, o link do grupo, o RSVP e a prévia). Nulo nos outros erros.
 */
export type SiteOff = 'expired' | 'unavailable';

export function siteOff(error: unknown): SiteOff | null {
  const code = apiErrorCode({ error });
  const status = error instanceof ApiError ? error.status : undefined;
  if (code === 'SITE_EXPIRED' || status === 410) return 'expired';
  if (code === 'SITE_UNAVAILABLE' || status === 423) return 'unavailable';
  return null;
}
