/** Um grupo de resposta de verdade, com o id e o nome (Central RN04). */
export interface ResponseGroup {
  partyId: string;
  name: string;
}

/**
 * O grupo de resposta. A API também grava na central do casal os avisos de cobrança
 * (Publicar e pagar RN13), com outro formato no payload (ex.: `{ kind: 'payment_confirmed' }`),
 * que o app só desenha no front da F3.
 */
export function isResponseGroup<T>(group: T): group is T & ResponseGroup {
  if (typeof group !== 'object' || group === null) return false;
  const value = group as { partyId?: unknown; name?: unknown };
  return typeof value.partyId === 'string' && typeof value.name === 'string';
}

/** Os grupos, se o item é de respostas (ao menos um, todos de resposta); senão, nulo. */
export function responseGroups<T>(groups: readonly T[]): (T & ResponseGroup)[] | null {
  if (groups.length === 0 || !groups.every(isResponseGroup)) return null;
  return groups.filter(isResponseGroup);
}

/** Um item que a central e a Atividade desenham: só grupos de resposta, ao menos um. */
export function isResponseItem(groups: readonly unknown[]): boolean {
  return responseGroups(groups) !== null;
}
