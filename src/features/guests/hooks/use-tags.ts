import { useToast } from '@kore-io/design';
import { useQueryClient, type Query } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getTagsControllerListV1QueryKey,
  useTagsControllerCreateV1,
  useTagsControllerListV1,
  useTagsControllerTrashV1,
  useTagsControllerUpdateV1,
} from '../../../shared/api/generated/tags/tags';
import type { TagResponseColor } from '../../../shared/api/generated/model';
import { apiErrorCode } from '../../../shared/api/http-client';

/** Erro do campo do nome, pelo código da API (decisão 189(1)): o app monta o texto. */
export type TagNameError = 'taken' | 'empty' | 'limit' | null;

/**
 * Tags do casamento (Tags dos convidados): a lista com o limite (RN01, RN04), criar,
 * editar (nome e cor, RN02, RN03, RN06) e mandar para a lixeira (RN06). Depois de cada
 * gravação, a lista de tags e o que mostra tags (grupos, painel) recarregam.
 */
export function useTags({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('guests');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const list = useTagsControllerListV1(weddingId);
  const create = useTagsControllerCreateV1();
  const update = useTagsControllerUpdateV1();
  const trash = useTagsControllerTrashV1();

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: getTagsControllerListV1QueryKey(weddingId) });
    // Grupos e painel mostram o nome e a cor das tags.
    const partiesPath = `/v1/weddings/${weddingId}/parties`;
    void queryClient.invalidateQueries({
      predicate: (query: Query) =>
        query.queryKey.some((part) => typeof part === 'string' && part.startsWith(partiesPath)),
    });
  }

  function genericError() {
    showToast({
      tone: 'danger',
      message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
    });
  }

  /** O código da recusa vira o erro do campo; o resto, o Toast genérico. */
  function nameError({ error }: { error: unknown }): TagNameError {
    const code = apiErrorCode({ error });
    if (code === 'TAG_NAME_TAKEN') return 'taken';
    if (code === 'TAG_LIMIT_REACHED') return 'limit';
    genericError();
    return null;
  }

  const tags = list.data?.data ?? [];
  const limit = list.data?.limit ?? 10;
  return {
    tags,
    limit,
    atLimit: list.isSuccess && tags.length >= limit,
    isLoading: list.isPending,
    isError: list.isError,
    retry: () => void list.refetch(),
    isSaving: create.isPending || update.isPending || trash.isPending,
    create: ({ name, onDone }: { name: string; onDone: (error: TagNameError) => void }) =>
      create.mutate(
        { weddingId, data: { name } },
        {
          onSuccess: () => {
            refresh();
            onDone(null);
          },
          onError: (error) => onDone(nameError({ error })),
        },
      ),
    update: ({
      tagId,
      name,
      color,
      onDone,
    }: {
      tagId: string;
      name: string;
      color: TagResponseColor;
      onDone: (error: TagNameError) => void;
    }) =>
      update.mutate(
        { weddingId, tagId, data: { name, color } },
        {
          onSuccess: () => {
            refresh();
            showToast({ tone: 'success', message: t('tags.saved') });
            onDone(null);
          },
          onError: (error) => onDone(nameError({ error })),
        },
      ),
    trash: ({ tagId, name, onDone }: { tagId: string; name: string; onDone: () => void }) =>
      trash.mutate(
        { weddingId, tagId },
        {
          onSuccess: () => {
            refresh();
            showToast({ tone: 'success', message: t('tags.deleted', { name }) });
          },
          onError: genericError,
          onSettled: onDone,
        },
      ),
  };
}
