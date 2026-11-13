/**
 * Um grupo de resposta de verdade, com o id e o nome (Central RN04). A API também grava na
 * central do casal os avisos de cobrança (Publicar e pagar RN13), com outro formato no
 * payload (ex.: `{ kind: 'payment_confirmed' }`), que o app só desenha no front da F3.
 */
export function isResponseGroup(group: unknown): boolean {
  if (typeof group !== 'object' || group === null) return false;
  const value = group as { partyId?: unknown; name?: unknown };
  return typeof value.partyId === 'string' && typeof value.name === 'string';
}

/** Um item que a central e a Atividade desenham: só grupos de resposta, ao menos um. */
export function isResponseItem(groups: readonly unknown[]): boolean {
  return groups.length > 0 && groups.every(isResponseGroup);
}
