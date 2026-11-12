import type { SiteEditorResponse } from '../../shared/api/generated/model';

/** O que impede publicar, já sabido antes do clique (decisão 228(4)). */
export type PublishBlock =
  | 'notOwner'
  | 'awaitingCouple'
  | 'courtesyDisabled'
  | 'slugMissing'
  | 'eventDateMissing'
  | 'timezoneMissing';

/**
 * O motivo que desabilita o Publicar, do mais forte ao mais fraco (Publicação por Cortesia
 * RN01 a RN04): só o dono publica; o casal precisa ter aceitado; a chave do servidor; o
 * endereço; a data e o fuso (que vem da UF). Nulo: dá para publicar.
 */
export function publishBlock({
  site,
  role,
}: {
  site: Pick<SiteEditorResponse, 'status' | 'slug' | 'eventDate' | 'timezone' | 'publication'>;
  role: string | undefined;
}): PublishBlock | null {
  if (role !== 'owner') return 'notOwner';
  if (site.status === 'awaiting_couple') return 'awaitingCouple';
  if (!site.publication.courtesyEnabled) return 'courtesyDisabled';
  if (!site.slug) return 'slugMissing';
  if (!site.eventDate) return 'eventDateMissing';
  if (!site.timezone || !site.publication.endDateMax) return 'timezoneMissing';
  return null;
}

/** Só o rascunho (e o que espera o casal) tem o que publicar (RN03). */
export function canOpenPublish(status: string): boolean {
  return status === 'draft' || status === 'awaiting_couple';
}

/** A data de saída do ar dentro dos limites do servidor (RN04); as datas são AAAA-MM-DD. */
export function endDateInRange({
  endDate,
  min,
  max,
}: {
  endDate: string;
  min: string | null;
  max: string | null;
}): boolean {
  return Boolean(endDate && min && max && endDate >= min && endDate <= max);
}

const SHORT_DATE = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "14 de nov. de 2027", como na ajuda do campo (Penpot A1). */
export function shortDate(day: string): string {
  return SHORT_DATE.format(new Date(`${day}T12:00:00Z`));
}
