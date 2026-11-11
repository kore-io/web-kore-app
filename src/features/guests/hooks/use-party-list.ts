import { useDebouncedValue } from '../../../shared/hooks/use-debounced-value';
import { usePartiesControllerListV1Infinite } from '../../../shared/api/generated/parties/parties';
import { toListParams, type PartyFilters } from './use-party-filters';

/** Espera da busca enquanto a pessoa digita, para não pedir a cada letra. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Lista de grupos (GET /parties, RN13) com rolagem infinita pelo cursor (decisão 197):
 * as páginas somadas, o total com os filtros e o resumo do casamento inteiro.
 */
export function usePartyList({ weddingId, filters }: { weddingId: string; filters: PartyFilters }) {
  const q = useDebouncedValue({ value: filters.q, delayMs: SEARCH_DEBOUNCE_MS });
  const params = toListParams({ filters: { ...filters, q } });
  const query = usePartiesControllerListV1Infinite(weddingId, params, {
    query: {
      initialPageParam: undefined,
      getNextPageParam: (page) => page.nextCursor ?? undefined,
    },
  });

  const pages = query.data?.pages ?? [];
  const first = pages[0];
  return {
    parties: pages.flatMap((page) => page.data),
    total: first?.total,
    summary: first?.summary,
    isLoading: query.isPending,
    isError: query.isError && pages.length === 0,
    retry: () => void query.refetch(),
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    isFiltered: Object.keys(params).length > 0,
  };
}
