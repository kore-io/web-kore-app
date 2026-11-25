/**
 * As entradas do Publicar o site (decisão 243(c); E5 da F3): só o rascunho, e o que espera o
 * casal aceitar, têm o que publicar (Publicar e pagar RN01). A tela diz o motivo para quem não
 * pode pagar (a colaboradora e o casal ainda não aceito, decisão 323).
 */
export function canOpenPublish(status: string): boolean {
  return status === 'draft' || status === 'awaiting_couple';
}

/**
 * O Publicar desabilitado, com o motivo, enquanto o casal não aceitou o convite (decisão 325;
 * Dashboard, Casos de borda, decisão 32): no cartão Status, no cabeçalho do Editor e no
 * Checklist.
 */
export function publishWaitsCouple(status: string): boolean {
  return status === 'awaiting_couple';
}
