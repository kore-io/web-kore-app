import { describe, expect, it, vi } from 'vitest';
import { getMeControllerMeV1QueryKey } from '../shared/api/generated/me/me';
import { ApiError } from '../shared/api/http-client';
import { createQueryClient } from './query-client';

describe('createQueryClient', () => {
  it('não repete erro 4xx; repete uma vez erro de rede ou 5xx', () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry;
    if (typeof retry !== 'function') throw new Error('retry deveria ser função');
    expect(retry(0, new ApiError({ status: 401, body: {} }))).toBe(false);
    expect(retry(0, new ApiError({ status: 503, body: {} }))).toBe(true);
    expect(retry(0, new TypeError('Failed to fetch'))).toBe(true);
    expect(retry(1, new TypeError('Failed to fetch'))).toBe(false);
  });

  async function runFailingMutation({ error }: { error: unknown }) {
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const mutation = client.getMutationCache().build(client, {
      mutationFn: () => Promise.reject(error),
    });
    await mutation.execute(undefined).catch(() => undefined);
    return invalidate;
  }

  it('refaz o /me ao receber 403 WEDDING_BLOCKED numa escrita (Bloqueado RN07)', async () => {
    const invalidate = await runFailingMutation({
      error: new ApiError({ status: 403, body: { error: 'WEDDING_BLOCKED' } }),
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: getMeControllerMeV1QueryKey() });
  });

  it('não refaz o /me nos outros erros', async () => {
    const invalidate = await runFailingMutation({
      error: new ApiError({ status: 403, body: { error: 'ACTION_NOT_ALLOWED' } }),
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
