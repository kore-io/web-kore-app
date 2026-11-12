import { useDashboardControllerGetV1 } from '../../../shared/api/generated/rsvp/rsvp';
import { useSiteControllerGetV1 } from '../../../shared/api/generated/site/site';
import { deadlineState } from '../../deliveries/deadline';

/**
 * O que a colaboradora não pode mais fazer (Prazo e respostas RN04 e RN08): depois do
 * prazo ou no pós-evento, alterar respostas (só o casal). O dono pode a qualquer hora, e o
 * app nem lê o Dashboard. Quem decide é o servidor (403); o app só desabilita com o motivo.
 */
export function useResponseLock({
  weddingId,
  role,
}: {
  weddingId: string;
  role: string | undefined;
}) {
  const collaborator = role !== undefined && role !== 'owner';
  const dashboard = useDashboardControllerGetV1(weddingId, { query: { enabled: collaborator } });
  const site = useSiteControllerGetV1(weddingId, { query: { enabled: collaborator } });
  if (!collaborator || !dashboard.data || !site.data) {
    return { collaborator, afterDeadline: false };
  }
  const ended =
    deadlineState({
      deadline: dashboard.data.rsvpDeadline,
      timezone: site.data.timezone,
      now: new Date(),
    }).kind === 'ended';
  return { collaborator, afterDeadline: ended || dashboard.data.site.status === 'post_event' };
}
