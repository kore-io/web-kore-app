import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiErrorCode, httpClient } from './http-client';

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('httpClient (mutator do Orval)', () => {
  it('chama a API com o cookie de sessão e devolve o corpo', async () => {
    const fetchMock = mockFetch(Response.json({ user: { id: 'u1' } }));
    const body = await httpClient<{ user: { id: string } }>('/v1/me', { method: 'GET' });
    expect(body).toEqual({ user: { id: 'u1' } });
    expect(fetchMock).toHaveBeenCalledWith(
      `${import.meta.env.VITE_API_URL}/v1/me`,
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('204 devolve undefined', async () => {
    mockFetch(new Response(null, { status: 204 }));
    await expect(httpClient('/v1/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('fora do 2xx lança ApiError com o status e o corpo, e o código sai do corpo', async () => {
    mockFetch(
      Response.json(
        {
          statusCode: 429,
          error: 'TOO_SOON',
          message: 'x',
          resendAvailableAt: '2026-11-05T12:00:00Z',
        },
        { status: 429 },
      ),
    );
    const error: unknown = await httpClient('/v1/auth/login-challenges', { method: 'POST' }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, body: { error: 'TOO_SOON' } });
    expect(apiErrorCode({ error })).toBe('TOO_SOON');
  });

  it('corpo que não é JSON vira texto, sem código', async () => {
    mockFetch(new Response('Bad Gateway', { status: 502 }));
    const error: unknown = await httpClient('/v1/me').catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: 502, body: 'Bad Gateway' });
    expect(apiErrorCode({ error })).toBeUndefined();
    expect(apiErrorCode({ error: new Error('rede') })).toBeUndefined();
  });
});
