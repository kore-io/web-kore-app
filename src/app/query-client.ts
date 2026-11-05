import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../shared/api/http-client';

/** Erros do cliente (4xx) não melhoram tentando de novo; os de rede e 5xx, uma vez. */
function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 1;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
