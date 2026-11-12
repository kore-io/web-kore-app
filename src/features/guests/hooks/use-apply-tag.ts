import { useToast } from '@kore-io/design';
import { useQueryClient, type Query } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getTagsControllerListV1QueryKey,
  useTagsControllerApplyV1,
} from '../../../shared/api/generated/tags/tags';

/**
 * Adicionar tag à seleção (Tags RN08; decisão 204): aplica a tag aos grupos marcados numa
 * gravação só, mostra "Tag aplicada a {n} grupos." e recarrega a lista e as tags (a
 * contagem de convidados muda). Falha: o Toast genérico (157(3)).
 */
export function useApplyTag({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('guests');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const apply = useTagsControllerApplyV1();

  return {
    isApplying: apply.isPending,
    apply: ({
      tagId,
      partyIds,
      onDone,
    }: {
      tagId: string;
      partyIds: string[];
      onDone: () => void;
    }) =>
      apply.mutate(
        { weddingId, tagId, data: { partyIds } },
        {
          onSuccess: () => {
            showToast({
              tone: 'success',
              message: t('selection.applied', { count: partyIds.length }),
            });
            void queryClient.invalidateQueries({
              queryKey: getTagsControllerListV1QueryKey(weddingId),
            });
            const partiesPath = `/v1/weddings/${weddingId}/parties`;
            void queryClient.invalidateQueries({
              predicate: (query: Query) =>
                query.queryKey.some(
                  (part) => typeof part === 'string' && part.startsWith(partiesPath),
                ),
            });
            onDone();
          },
          onError: () =>
            showToast({
              tone: 'danger',
              message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
            }),
        },
      ),
  };
}
