import { useToast } from '@kore-io/design';
import { useQueryClient, type Query } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getTagsControllerListV1QueryKey } from '../../../shared/api/generated/tags/tags';
import {
  getTrashControllerListV1QueryKey,
  useTrashControllerListV1,
  useTrashControllerRestoreV1,
} from '../../../shared/api/generated/trash/trash';
import type { RestoreTrashItemBodyType } from '../../../shared/api/generated/model';
import { ApiError, apiErrorCode } from '../../../shared/api/http-client';
import type { Audience } from './use-active-wedding';

/**
 * Lixeira (Lixeira de convidados, RN08 e RN09): os itens ainda não expurgados e o
 * Restaurar, com os Toasts da RN09 e os conflitos da tag (409 TAG_LIMIT_REACHED e
 * TAG_NAME_TAKEN, com o nome da tag ativa), no texto do perfil (decisão 189(1)).
 */
export function useTrashList({ weddingId, audience }: { weddingId: string; audience: Audience }) {
  const { t } = useTranslation('guests');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const list = useTrashControllerListV1(weddingId);
  const restore = useTrashControllerRestoreV1();

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: getTrashControllerListV1QueryKey(weddingId) });
    void queryClient.invalidateQueries({ queryKey: getTagsControllerListV1QueryKey(weddingId) });
    const partiesPath = `/v1/weddings/${weddingId}/parties`;
    void queryClient.invalidateQueries({
      predicate: (query: Query) =>
        query.queryKey.some((part) => typeof part === 'string' && part.startsWith(partiesPath)),
    });
  }

  function refused({ error }: { error: unknown }) {
    const code = apiErrorCode({ error });
    const body = error instanceof ApiError ? (error.body as { conflictName?: string }) : {};
    const message =
      code === 'TAG_LIMIT_REACHED'
        ? t(`trashPage.tagLimit.${audience}`)
        : code === 'TAG_NAME_TAKEN'
          ? t(`trashPage.tagNameTaken.${audience}`, { name: body.conflictName ?? '' })
          : `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`;
    showToast({ tone: 'danger', message });
  }

  return {
    items: list.data?.data ?? [],
    isLoading: list.isPending,
    isError: list.isError,
    retry: () => void list.refetch(),
    restoringId: restore.isPending ? restore.variables.data.id : null,
    restore: ({ type, id }: { type: RestoreTrashItemBodyType; id: string }) =>
      restore.mutate(
        { weddingId, data: { type, id } },
        {
          onSuccess: ({ name }) => {
            refresh();
            showToast({
              tone: 'success',
              message:
                type === 'tag'
                  ? t('trashPage.tagRestored', { name })
                  : t('trashPage.restored', { name }),
            });
          },
          onError: (error) => {
            refused({ error });
            // Outra pessoa já restaurou (404 TRASH_ITEM_NOT_FOUND): a lista recarrega.
            refresh();
          },
        },
      ),
  };
}
