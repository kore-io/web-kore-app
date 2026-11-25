import { useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMeControllerMeV1QueryKey, useMeControllerMeV1 } from '../../shared/api/generated/me/me';
import { getDashboardControllerGetV1QueryKey } from '../../shared/api/generated/rsvp/rsvp';
import { apiErrorCode } from '../../shared/api/http-client';
import { useActiveWedding } from '../guests/hooks/use-active-wedding';
import { deliveriesClosed } from './delivery-closed';

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
      message:
        closed === 'expired_final' ? t('closed.expiredFinal') : t(`closed.expired.${audience}`),
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
