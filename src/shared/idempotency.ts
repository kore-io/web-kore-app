import { useRef } from 'react';

/** O cabeçalho das escritas de dinheiro (Publicar RN03, B2-10; Repasse RN04; 259(3)). */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/**
 * Uma chave por intenção (Publicar RN03, B2-10): a mesma chave com o mesmo corpo devolve o
 * mesmo resultado, e com outro corpo a API recusa (`422 IDEMPOTENCY_KEY_REUSED`). A intenção
 * é o alvo (ex.: o repasse da fila do Backoffice, que vai sem corpo) mais o corpo:
 * - o mesmo alvo e o mesmo corpo de novo (o retry depois de uma falha de rede) reaproveitam
 *   a chave;
 * - outro alvo ou outro corpo (outra forma, outra data) ganham chave nova;
 * - depois de uma resposta definitiva (o cartão recusado, o Pix gerado), `reset()`: a
 *   próxima tentativa é outra intenção, mesmo igual.
 */
export class IdempotencyKeys {
  private last: { intent: string; key: string } | undefined;

  constructor(private readonly newKey: () => string = () => crypto.randomUUID()) {}

  /** O cabeçalho para esta intenção; sem corpo (ex.: o Pagar do Admin), só o alvo conta. */
  headersFor({ target, body }: { target?: string; body?: unknown } = {}): Record<
    typeof IDEMPOTENCY_HEADER,
    string
  > {
    const intent = JSON.stringify([target ?? null, body ?? null]);
    if (this.last === undefined || this.last.intent !== intent) {
      this.last = { intent, key: this.newKey() };
    }
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
