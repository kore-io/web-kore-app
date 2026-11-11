import { useToast } from '@kore-io/design';
import { useQueryClient, type Query } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useGuestsControllerTrashV1 } from '../../../shared/api/generated/guests/guests';
import {
  usePartiesControllerTrashManyV1,
  usePartiesControllerTrashV1,
} from '../../../shared/api/generated/parties/parties';
import { getTagsControllerListV1QueryKey } from '../../../shared/api/generated/tags/tags';
import { apiErrorCode } from '../../../shared/api/http-client';
import type { Audience } from './use-active-wedding';

/**
 * Mover para a lixeira (Lixeira de convidados, RN01 a RN07): o grupo, o convidado e os
 * grupos marcados, com os Toasts da RN02. Recusas pelo código da API (decisão 189(1)):
 * 403 ALREADY_RESPONDED (RN07), 409 LAST_GUEST (Grupos RN08); o resto, o Toast genérico.
 * Depois, a lista, o painel, o resumo e as tags (contagens) recarregam.
 */
export function useTrash({ weddingId, audience }: { weddingId: string; audience: Audience }) {
  const { t } = useTranslation('guests');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const trashParty = usePartiesControllerTrashV1();
  const trashGuest = useGuestsControllerTrashV1();
  const trashMany = usePartiesControllerTrashManyV1();

  function refresh() {
    const partiesPath = `/v1/weddings/${weddingId}/parties`;
    void queryClient.invalidateQueries({
      predicate: (query: Query) =>
        query.queryKey.some((part) => typeof part === 'string' && part.startsWith(partiesPath)),
    });
    void queryClient.invalidateQueries({ queryKey: getTagsControllerListV1QueryKey(weddingId) });
  }

  function refused({ error, kind }: { error: unknown; kind: 'party' | 'guest' }) {
    const code = apiErrorCode({ error });
    const message =
      code === 'ALREADY_RESPONDED'
        ? t(`trash.alreadyResponded.${kind}`)
        : code === 'LAST_GUEST'
          ? t(`panel.move.lastGuest.${audience}`)
          : `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`;
    showToast({ tone: 'danger', message });
  }

  return {
    isTrashing: trashParty.isPending || trashGuest.isPending || trashMany.isPending,
    trashParty: ({
      partyId,
      name,
      onDone,
    }: {
      partyId: string;
      name: string;
      onDone: (ok: boolean) => void;
    }) =>
      trashParty.mutate(
        { weddingId, partyId },
        {
          onSuccess: () => {
            refresh();
            showToast({ tone: 'success', message: t('trash.moved', { name }) });
            onDone(true);
          },
          onError: (error) => {
            refused({ error, kind: 'party' });
            onDone(false);
          },
        },
      ),
    trashGuest: ({
      guestId,
      name,
      onDone,
    }: {
      guestId: string;
      name: string;
      onDone: (ok: boolean) => void;
    }) =>
      trashGuest.mutate(
        { weddingId, guestId },
        {
          onSuccess: () => {
            refresh();
            showToast({ tone: 'success', message: t('trash.moved', { name }) });
            onDone(true);
          },
          onError: (error) => {
            refused({ error, kind: 'guest' });
            onDone(false);
          },
        },
      ),
    trashMany: ({ partyIds, onDone }: { partyIds: string[]; onDone: (ok: boolean) => void }) =>
      trashMany.mutate(
        { weddingId, data: { partyIds } },
        {
          onSuccess: ({ trashed, skipped }) => {
            refresh();
            // RN07: os que já responderam ficam, e o Toast avisa na mesma frase.
            const message = [
              trashed > 0 && t('trash.movedMany', { count: trashed }),
              skipped.length > 0 && t('trash.skipped', { count: skipped.length }),
            ]
              .filter(Boolean)
              .join(' ');
            showToast({ tone: 'success', message });
            onDone(true);
          },
          onError: (error) => {
            refused({ error, kind: 'party' });
            onDone(false);
          },
        },
      ),
  };
}
