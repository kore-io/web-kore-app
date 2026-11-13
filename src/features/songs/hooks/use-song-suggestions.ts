import { useInfiniteQuery } from '@tanstack/react-query';
import {
  getSongSuggestionsControllerPageV1QueryKey,
  songSuggestionsControllerPageV1,
} from '../../../shared/api/generated/rsvp/rsvp';
import { apiErrorCode } from '../../../shared/api/http-client';

/**
 * As sugestões de música (Música RN05): da mais antiga para a mais nova, 50 por vez, com
 * rolagem infinita pelo cursor (como a decisão 197). Com a pergunta desligada, a API
 * responde `404 SONG_QUESTION_DISABLED` e a página leva ao Editor (RN03).
 */
export function useSongSuggestions({ weddingId }: { weddingId: string }) {
  const query = useInfiniteQuery({
    queryKey: getSongSuggestionsControllerPageV1QueryKey(weddingId),
    queryFn: ({ pageParam, signal }) =>
      songSuggestionsControllerPageV1(weddingId, pageParam ? { cursor: pageParam } : {}, {
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: (count, error) => apiErrorCode({ error }) !== 'SONG_QUESTION_DISABLED' && count < 2,
  });
  const pages = query.data?.pages ?? [];
  return {
    items: pages.flatMap((page) => page.items),
    total: pages[0]?.total,
    isLoading: query.isPending,
    disabled: apiErrorCode({ error: query.error }) === 'SONG_QUESTION_DISABLED',
    isError: query.isError && pages.length === 0,
    retry: () => void query.refetch(),
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMoreFailed: query.isFetchNextPageError,
    loadMore: () => {
      // Depois de uma falha, só o Tentar de novo pede de novo (decisão 200(d)).
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    refetch: () => void query.refetch(),
  };
}
