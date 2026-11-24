import { useRef } from 'react';

/** O cabeçalho das escritas de dinheiro (Publicar RN03, B2-10; Repasse RN04). */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/**
 * Uma chave por intenção (Publicar RN03, B2-10): a mesma chave com o mesmo corpo devolve o
 * mesmo resultado, e com outro corpo a API recusa (`422 IDEMPOTENCY_KEY_REUSED`). Então:
 * - o mesmo corpo de novo (o retry depois de uma falha de rede) reaproveita a chave;
 * - um corpo diferente (outra forma, outra data) ganha chave nova;
 * - depois de uma resposta definitiva (o cartão recusado, o Pix gerado), `reset()`: a
 *   próxima tentativa é outra intenção, mesmo com o mesmo corpo.
 */
export class IdempotencyKeys {
  private last: { body: string; key: string } | undefined;

  constructor(private readonly newKey: () => string = () => crypto.randomUUID()) {}

  /** O cabeçalho para este corpo. */
  headersFor({ body }: { body: unknown }): Record<typeof IDEMPOTENCY_HEADER, string> {
    const serialized = JSON.stringify(body);
    if (this.last?.body !== serialized) this.last = { body: serialized, key: this.newKey() };
    return { [IDEMPOTENCY_HEADER]: this.last.key };
  }

  reset(): void {
    this.last = undefined;
  }
}

/** As chaves de uma tela (uma intenção por vez), estáveis entre os renders. */
export function useIdempotencyKeys(): IdempotencyKeys {
  const keys = useRef<IdempotencyKeys | null>(null);
  keys.current ??= new IdempotencyKeys();
  return keys.current;
}
