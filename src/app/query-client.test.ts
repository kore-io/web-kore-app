import { describe, expect, it } from 'vitest';
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
});
