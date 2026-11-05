import { ToastProvider } from '@kore-io/design';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { routes } from '../src/app/routes';

/** Abre o app numa rota, com os provedores reais e um QueryClient sem retry. */
export function renderRoute({ url, state }: { url: string; state?: unknown }) {
  const router = createMemoryRouter(routes, { initialEntries: [{ ...splitUrl(url), state }] });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider label="Avisos" dismissLabel="Fechar">
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, router };
}

function splitUrl(url: string) {
  const parsed = new URL(url, 'http://app.test');
  return { pathname: parsed.pathname, search: parsed.search };
}

type Handler = (request: { method: string; path: string; body: unknown }) => Response;

/** Troca o fetch por um que responde pela rota (método e caminho da API). */
export function mockApi(handler: Handler) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    return handler({ method: init?.method ?? 'GET', path: url.pathname + url.search, body });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function apiError({ status, body }: { status: number; body: Record<string, unknown> }) {
  return Response.json({ statusCode: status, message: 'x', ...body }, { status });
}
