import { ToastProvider } from '@kore-io/design';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider, type RouteObject } from 'react-router';
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

/**
 * As telas da área do casal sem o layout dela. O layout manda quem não está no perfil de
 * casal para a Seleção de perfil (na F1 só o casal entra, decisões 152 e 198), e a
 * decisão 198(2) pede as versões da cerimonialista em teste unitário: com este helper, o
 * /me de cerimonialista abre a tela, e o código escolhe o texto pelo perfil ativo.
 */
export function renderAreaScreen({ url }: { url: string }) {
  const area = findRoute(routes, 'couple-area');
  const screens: RouteObject[] = [
    { path: area?.path ?? '/app', element: <Outlet />, children: area?.children ?? [] },
  ];
  const router = createMemoryRouter(screens, { initialEntries: [splitUrl(url)] });
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

function findRoute(list: RouteObject[], id: string): RouteObject | undefined {
  for (const route of list) {
    if (route.id === id) return route;
    const found = route.children && findRoute(route.children, id);
    if (found) return found;
  }
  return undefined;
}

function splitUrl(url: string) {
  const parsed = new URL(url, 'http://app.test');
  return { pathname: parsed.pathname, search: parsed.search };
}

type Handler = (request: {
  method: string;
  path: string;
  body: unknown;
}) => Response | Promise<Response>;

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
