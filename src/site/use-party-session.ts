import { useQuery } from '@tanstack/react-query';
import { publicSiteControllerPartySessionV1 } from '../shared/api/generated/sites/sites';
import { ApiError, apiErrorCode } from '../shared/api/http-client';

export type PartyEntryState = 'loading' | 'ready' | 'draft' | 'notFound' | 'linkInvalid' | 'error';

/**
 * A entrada pelo link do grupo (Site público RN06): troca o token pelo cookie do grupo
 * (`POST …/party-session`) e tira o token do endereço na hora (`history.replaceState`),
 * indo ao endereço certo do casamento quando o slug do caminho não bate. O rascunho e o
 * endereço que não existe têm as páginas deles; o token que não resolve e o limite de
 * tentativas (429) mostram "Este link não funciona mais.".
 */
export function usePartySession({ slug, token }: { slug: string; token: string }) {
  const query = useQuery({
    queryKey: ['party-session', slug, token],
    queryFn: async () => {
      try {
        const session = await publicSiteControllerPartySessionV1(slug, { token });
        window.history.replaceState(null, '', `/${session.slug}`);
        return session;
      } catch (error) {
        // O token sai do endereço também na falha: o caminho não fica no histórico.
        window.history.replaceState(null, '', `/${slug}`);
        throw error;
      }
    },
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const code = apiErrorCode({ error: query.error });
  const status = query.error instanceof ApiError ? query.error.status : undefined;
  const state: PartyEntryState = query.isPending
    ? 'loading'
    : query.isSuccess
      ? 'ready'
      : code === 'SITE_DRAFT'
        ? 'draft'
        : code === 'SITE_NOT_FOUND'
          ? 'notFound'
          : code === 'LINK_INVALID' || status === 429 || status === 400
            ? 'linkInvalid'
            : 'error';
  return { state, slug: query.data?.slug ?? slug, retry: () => void query.refetch() };
}
