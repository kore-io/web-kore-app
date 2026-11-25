/**
 * As entradas do Publicar o site (decisão 243(c); E5 da F3): só o rascunho, e o que espera o
 * casal aceitar, têm o que publicar (Publicar e pagar RN01). A tela diz o motivo para quem não
 * pode pagar (a colaboradora e o casal ainda não aceito, decisão 323).
 */
export function canOpenPublish(status: string): boolean {
  return status === 'draft' || status === 'awaiting_couple';
}
