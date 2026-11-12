import { useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getPartiesControllerGetV1QueryKey,
  getPartiesControllerListV1InfiniteQueryKey,
  usePartiesControllerGetV1,
  usePartiesControllerRegenerateV1,
} from '../../../shared/api/generated/parties/parties';
import { ApiError } from '../../../shared/api/http-client';

/**
 * Painel do grupo (RN14): o GET do grupo, o Copiar link (RN11) e o Regenerar link (RN12).
 * Falha de rede ou do servidor vira o Toast de erro com o aviso genérico (157(3)).
 */
export function usePartyPanel({ weddingId, partyId }: { weddingId: string; partyId: string }) {
  const { t } = useTranslation('guests');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const party = usePartiesControllerGetV1(weddingId, partyId);
  const regenerate = usePartiesControllerRegenerateV1();

  function failed() {
    showToast({
      tone: 'danger',
      message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
    });
  }

  return {
    party: party.data,
    isLoading: party.isPending,
    /** O grupo não existe (ou não é deste casamento): a tela volta para a lista. */
    notFound: party.error instanceof ApiError && party.error.status === 404,
    isError: party.isError,
    retry: () => void party.refetch(),
    copyLink: async ({ url }: { url: string }) => {
      try {
        await navigator.clipboard.writeText(url);
        showToast({ tone: 'success', message: t('panel.link.copied') });
      } catch {
        failed();
      }
    },
    isRegenerating: regenerate.isPending,
    regenerateLink: ({ onDone }: { onDone: () => void }) =>
      regenerate.mutate(
        { weddingId, partyId },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({
              queryKey: getPartiesControllerGetV1QueryKey(weddingId, partyId),
            });
            void queryClient.invalidateQueries({
              queryKey: getPartiesControllerListV1InfiniteQueryKey(weddingId),
            });
          },
          onError: failed,
          onSettled: onDone,
        },
      ),
  };
}
