import { MutationCache, QueryClient } from '@tanstack/react-query';
import { getMeControllerMeV1QueryKey } from '../shared/api/generated/me/me';
import { ApiError, apiErrorCode } from '../shared/api/http-client';

/** Erros do cliente (4xx) não melhoram tentando de novo; os de rede e 5xx, uma vez. */
function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 1;
}

export function createQueryClient() {
  const client: QueryClient = new QueryClient({
    // Casamento bloqueado ou com a exclusão agendada (Bloqueado RN07; Retenção RN05): ao
    // receber o 403 WEDDING_BLOCKED ou o 409 WEDDING_DELETION_SCHEDULED, o app refaz o GET
    // /v1/me, de onde saem as faixas e os botões desabilitados de todas as telas.
    mutationCache: new MutationCache({
      onError: (error) => {
        const code = apiErrorCode({ error });
        if (code === 'WEDDING_BLOCKED' || code === 'WEDDING_DELETION_SCHEDULED') {
          void client.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
        }
      },
    }),
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  return client;
}
