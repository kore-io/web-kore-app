import { useQuery } from '@tanstack/react-query';
import { publicSiteControllerPreviewSessionV1 } from '../shared/api/generated/sites/sites';
import { ApiError } from '../shared/api/http-client';

export type PreviewEntryState = 'loading' | 'ready' | 'invalid' | 'error';

/**
 * A entrada pela prévia (Pré-visualização RN03 e RN04): tira o token do endereço na hora
 * (`history.replaceState`) e o troca pelo cookie da prévia (`POST …/preview-session`). O
 * token usado, vencido, inexistente ou de quem perdeu o vínculo (404 PREVIEW_INVALID), o
 * malformado (400) e o limite (429) mostram "Esta prévia não vale mais.".
 */
export function usePreviewSession({ slug, token }: { slug: string; token: string }) {
  const query = useQuery({
    queryKey: ['preview-session', slug, token],
    queryFn: async () => {
      window.history.replaceState(null, '', `/${slug}`);
      return publicSiteControllerPreviewSessionV1(slug, { token });
    },
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const status = query.error instanceof ApiError ? query.error.status : undefined;
  const state: PreviewEntryState = query.isPending
    ? 'loading'
    : query.isSuccess
      ? 'ready'
      : status === 404 || status === 400 || status === 429
        ? 'invalid'
        : 'error';
  return { state, slug: query.data?.slug ?? slug, retry: () => void query.refetch() };
}
