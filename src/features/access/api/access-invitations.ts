import {
  getInvitationAcceptanceControllerReadV1QueryKey,
  useInvitationAcceptanceControllerAcceptV1,
  useInvitationAcceptanceControllerDeclineV1,
  useInvitationAcceptanceControllerReadV1,
} from '../../../shared/api/generated/access-invitations/access-invitations';
import type { AcceptAccessInvitationBodyMyTitle } from '../../../shared/api/generated/model';

export type {
  AcceptAccessInvitationBody as AcceptInvitationBody,
  AcceptAccessInvitationResponse as AcceptInvitationResponse,
  AccessInvitationResponse as AccessInvitation,
} from '../../../shared/api/generated/model';

export type PartnerTitle = AcceptAccessInvitationBodyMyTitle;

/**
 * GET /v1/access-invitations/{token} (RN06, RN07; decisões 168 e 173). A resposta muda com
 * a sessão (sessionEmailMismatch, needsName): a chave leva quem está vendo, para ler de novo
 * depois do login.
 */
export function useAccessInvitation({
  token,
  viewerId,
  enabled,
}: {
  token: string;
  viewerId: string | null;
  enabled: boolean;
}) {
  return useInvitationAcceptanceControllerReadV1(token, {
    query: {
      queryKey: [...getInvitationAcceptanceControllerReadV1QueryKey(token), viewerId],
      enabled,
    },
  });
}

/** POST …/accept (RN07 a RN10; decisões 172, 173 e 178). */
export const useAcceptInvitation = useInvitationAcceptanceControllerAcceptV1;

/** POST …/decline (RN11; decisão 136). */
export const useDeclineInvitation = useInvitationAcceptanceControllerDeclineV1;
