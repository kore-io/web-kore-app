import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IdempotencyKeys, useIdempotencyKeys } from './idempotency';

function sequentialKeys() {
  let count = 0;
  return new IdempotencyKeys(() => `key-${++count}`);
}

describe('IdempotencyKeys (Publicar RN03, B2-10)', () => {
  it('o mesmo corpo reaproveita a chave (o retry depois da falha de rede)', () => {
    const keys = sequentialKeys();
    const body = { method: 'pix', endDate: '2027-03-14' };
    expect(keys.headersFor({ body })).toEqual({ 'Idempotency-Key': 'key-1' });
    expect(keys.headersFor({ body: { ...body } })).toEqual({ 'Idempotency-Key': 'key-1' });
  });

  it('um corpo diferente ganha chave nova (sem o 422 IDEMPOTENCY_KEY_REUSED)', () => {
    const keys = sequentialKeys();
    keys.headersFor({ body: { method: 'pix' } });
    expect(keys.headersFor({ body: { method: 'card' } })).toEqual({ 'Idempotency-Key': 'key-2' });
  });

  it('depois do reset, o mesmo corpo é outra intenção', () => {
    const keys = sequentialKeys();
    keys.headersFor({ body: { method: 'card' } });
    keys.reset();
    expect(keys.headersFor({ body: { method: 'card' } })).toEqual({ 'Idempotency-Key': 'key-2' });
  });

  it('a chave padrão é um UUID', () => {
    const key = new IdempotencyKeys().headersFor({ body: {} })['Idempotency-Key'];
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('o hook guarda as mesmas chaves entre os renders', () => {
    const { result, rerender } = renderHook(() => useIdempotencyKeys());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
