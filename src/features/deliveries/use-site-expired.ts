import { useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMeControllerMeV1QueryKey, useMeControllerMeV1 } from '../../shared/api/generated/me/me';
import { getDashboardControllerGetV1QueryKey } from '../../shared/api/generated/rsvp/rsvp';
import { ApiError, apiErrorCode } from '../../shared/api/http-client';
import { useActiveWedding } from '../guests/hooks/use-active-wedding';
import { deliveriesClosed, expiredClosedText } from './delivery-closed';

/**
 * O `409 SITE_EXPIRED` em corrida nos envios (Data de saída do ar RN07; 314(3)): o Toast com
 * o mesmo texto dos Envios no expirado, pela versão do perfil (o do sem renovação é um só), e
 * o Dashboard e o /me relidos, que fecham a tela. Devolve se tratou o erro.
 */
export function useSiteExpired({ weddingId }: { weddingId: string }) {
  const { audience } = useActiveWedding();
  const { t } = useTranslation('deliveries');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { data: me } = useMeControllerMeV1();
  return (error: unknown): boolean => {
    if (apiErrorCode({ error }) !== 'SITE_EXPIRED') return false;
    const closed = deliveriesClosed({
      status: 'expired',
      membership: me?.memberships.find((item) => item.weddingId === weddingId),
      now: new Date(),
    });
    showToast({
      tone: 'danger',
      message: expiredClosedText({ closed, audience, t }) ?? t(`closed.expired.${audience}`),
    });
    void queryClient.invalidateQueries({
      queryKey: getDashboardControllerGetV1QueryKey(weddingId),
    });
    void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
    return true;
  };
}

/**
 * A leitura da fila que volta `409 SITE_EXPIRED`: o Toast uma vez, e a tela espera o
 * Dashboard relido fechar a etapa. Se ele voltar sem o expirado, a espera acaba e a tela
 * mostra o aviso de erro de leitura, com o Tentar de novo (sugestão do Crivo no E9).
 */
export function useSiteExpiredRead({ weddingId, error }: { weddingId: string; error: unknown }) {
  const handle = useSiteExpired({ weddingId });
  const queryClient = useQueryClient();
  const expired = apiErrorCode({ error }) === 'SITE_EXPIRED';
  const shown = useRef(false);
  const [waiting, setWaiting] = useState(true);
  useEffect(() => {
    if (!expired || shown.current) return;
    shown.current = true;
    handle(error);
    void queryClient
      .refetchQueries({ queryKey: getDashboardControllerGetV1QueryKey(weddingId) })
      .finally(() => setWaiting(false));
  }, [expired, error, handle, queryClient, weddingId]);
  return expired && waiting;
}

/**
 * O `409 DELIVERIES_CLOSED` de reason `post_event` em corrida nos envios (Envios RN01; 332):
 * o Toast com o texto dos Envios no pós-evento, igual nos dois perfis (337(1)), e o Dashboard
 * relido, que fecha a tela. Devolve se tratou o erro.
 */
export function useDeliveriesPostEvent({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('deliveries');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  return (error: unknown): boolean => {
    if (!(error instanceof ApiError) || apiErrorCode({ error }) !== 'DELIVERIES_CLOSED') {
      return false;
    }
    const body: unknown = error.body;
    if (typeof body !== 'object' || body === null || !('reason' in body)) return false;
    if (body.reason !== 'post_event') return false;
    showToast({ tone: 'danger', message: t('closed.postEvent') });
    void queryClient.invalidateQueries({
      queryKey: getDashboardControllerGetV1QueryKey(weddingId),
    });
    return true;
  };
}
