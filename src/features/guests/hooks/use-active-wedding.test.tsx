import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '../../../../tests/render-route';
import { useActiveWedding } from './use-active-wedding';

afterEach(() => {
  vi.unstubAllGlobals();
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('casamento ativo e a versão das frases (decisão 189(1))', () => {
  it.each([
    ['couple', 'couple'],
    ['planner', 'planner'],
    ['seller', 'planner'],
  ])('perfil %s lê a versão %s', async (profile, audience) => {
    mockApi(() =>
      Response.json({
        user: { id: 'u1', name: 'Ana', email: 'a@x.com', platformRole: 'none' },
        activeProfile: profile,
        authenticatedAt: '2026-11-05T12:00:00Z',
        memberships: [
          {
            weddingId: 'w1',
            role: 'collaborator',
            weddingName: 'Ana & Marcos',
            eventDate: null,
            city: null,
            state: null,
          },
        ],
        profiles: [profile],
        lastProfileOnDevice: profile,
        planner: null,
        referrer: null,
      }),
    );
    const { result } = renderHook(() => useActiveWedding(), { wrapper });
    await waitFor(() => expect(result.current.weddingId).toBe('w1'));
    expect(result.current.audience).toBe(audience);
  });
});
