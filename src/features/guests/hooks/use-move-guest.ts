import { useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useGuestsControllerMoveV1 } from '../../../shared/api/generated/guests/guests';
import {
  getPartiesControllerGetV1QueryKey,
  getPartiesControllerListV1InfiniteQueryKey,
} from '../../../shared/api/generated/parties/parties';
import { apiErrorCode } from '../../../shared/api/http-client';
import type { Audience } from './use-active-wedding';

/**
 * Mover de grupo (RN10; decisão 201): o POST /guests/:guestId/move, o Toast "{nome} foi
 * para {grupo}." e a recusa do último convidado com nome (RN08, 409 LAST_GUEST), com o
 * texto do perfil. O painel de origem e a lista recarregam.
 */
export function useMoveGuest({ weddingId, audience }: { weddingId: string; audience: Audience }) {
  const { t } = useTranslation('guests');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const move = useGuestsControllerMoveV1();

  function lastGuest() {
    showToast({ tone: 'danger', message: t(`panel.move.lastGuest.${audience}`) });
  }

  return {
    isMoving: move.isPending,
    /** Recusa sem chamar a API, quando o grupo só tem este convidado com nome (RN08). */
    lastGuest,
    move: ({
      guestId,
      guestName,
      fromPartyId,
      toParty,
      onDone,
    }: {
      guestId: string;
      guestName: string;
      fromPartyId: string;
      toParty: { id: string; name: string };
      onDone: () => void;
    }) =>
      move.mutate(
        { weddingId, guestId, data: { partyId: toParty.id } },
        {
          onSuccess: () => {
            showToast({
              tone: 'success',
              message: t('panel.move.moved', { name: guestName, group: toParty.name }),
            });
            for (const partyId of [fromPartyId, toParty.id]) {
              void queryClient.invalidateQueries({
                queryKey: getPartiesControllerGetV1QueryKey(weddingId, partyId),
              });
            }
            void queryClient.invalidateQueries({
              queryKey: getPartiesControllerListV1InfiniteQueryKey(weddingId),
            });
          },
          onError: (error) => {
            if (apiErrorCode({ error }) === 'LAST_GUEST') {
              lastGuest();
              return;
            }
            showToast({
              tone: 'danger',
              message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
            });
          },
          onSettled: onDone,
        },
      ),
  };
}
