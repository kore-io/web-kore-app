import { useDebouncedValue } from '../../../shared/hooks/use-debounced-value';
import { usePartiesControllerListV1Infinite } from '../../../shared/api/generated/parties/parties';
import { toListParams, type PartyFilters } from './use-party-filters';

/** Espera da busca enquanto a pessoa digita, para não pedir a cada letra. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Lista de grupos (GET /parties, RN13) com rolagem infinita pelo cursor (decisão 197):
 * as páginas somadas e o total com os filtros. `enabled` segura o pedido até a tela saber
 * se a tag da URL ainda existe.
 */
export function usePartyList({
  weddingId,
  filters,
  enabled = true,
}: {
  weddingId: string;
  filters: PartyFilters;
  enabled?: boolean;
}) {
  const q = useDebouncedValue({ value: filters.q, delayMs: SEARCH_DEBOUNCE_MS });
  const params = toListParams({ filters: { ...filters, q } });
  const query = usePartiesControllerListV1Infinite(weddingId, params, {
    query: {
      enabled,
      initialPageParam: undefined,
      getNextPageParam: (page) => page.nextCursor ?? undefined,
    },
  });

  const pages = query.data?.pages ?? [];
  const first = pages[0];
  return {
    parties: pages.flatMap((page) => page.data),
    total: first?.total,
    isLoading: query.isPending,
    isError: query.isError && pages.length === 0,
    retry: () => void query.refetch(),
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    /** A próxima página falhou: a lista mostra o Tentar de novo embaixo (decisão 200(d)). */
    loadMoreFailed: query.isFetchNextPageError,
    loadMore: () => {
      // Depois de uma falha, só o Tentar de novo pede de novo (o marcador não dispara sozinho).
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    // A ordem não é filtro: só ela não troca o vazio (tipo 3) pelo sem resultado (tipo 1).
    isFiltered: Object.keys(params).some((key) => key !== 'order'),
  };
}
