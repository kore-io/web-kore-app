import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  getNotificationsControllerListV1QueryKey,
  getNotificationsControllerUnreadV1QueryKey,
  notificationsControllerReadV1,
} from '../../../shared/api/generated/notifications/notifications';
import { getDashboardControllerGetV1QueryKey } from '../../../shared/api/generated/rsvp/rsvp';

/**
 * Abrir uma notificação marca como lida (Central RN05; decisão 27): o POST sai com
 * `keepalive` e sem esperar, porque a tela já navega ao destino; depois, o sino, a central
 * e a Atividade recente do Dashboard são lidos de novo. A falha não incomoda: a notificação
 * fica não lida e a pessoa pode abrir de novo.
 */
export function useMarkNotificationRead({ weddingId }: { weddingId: string }) {
  const queryClient = useQueryClient();
  return useCallback(
    ({ id }: { id: string }) => {
      void notificationsControllerReadV1(id, { keepalive: true })
        .then(() =>
          Promise.all([
            queryClient.invalidateQueries({
              queryKey: getNotificationsControllerUnreadV1QueryKey(),
            }),
            queryClient.invalidateQueries({
              queryKey: getNotificationsControllerListV1QueryKey(),
            }),
            queryClient.invalidateQueries({
              queryKey: getDashboardControllerGetV1QueryKey(weddingId),
            }),
          ]),
        )
        .catch(() => undefined);
    },
    [queryClient, weddingId],
  );
}
