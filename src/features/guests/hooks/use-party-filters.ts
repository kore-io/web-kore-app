import { useSearchParams } from 'react-router';
import type {
  PartiesControllerListV1Params,
  PartiesControllerListV1Rsvp,
  PartiesControllerListV1Sent,
} from '../../../shared/api/generated/model';

/**
 * Valores dos filtros na URL (decisão 198): `?q=&resposta=&envio=&tag=`, em português como
 * os caminhos (a tag vai pelo id); a tela troca pelos valores da API.
 */
export const rsvpFilters = {
  confirmados: 'confirmed',
  recusados: 'declined',
  pendentes: 'pending',
} as const satisfies Record<string, PartiesControllerListV1Rsvp>;

export const sentFilters = {
  'nao-enviado': 'not_sent',
  enviado: 'sent',
  visualizado: 'viewed',
  respondido: 'responded',
} as const satisfies Record<string, PartiesControllerListV1Sent>;

/**
 * A ordem da lista na URL (`?ordem=respondido`): "Respondido em", mais recentes primeiro,
 * para a notificação agrupada (Central RN05; Dashboard RN04; decisão 246). Sem ela, a
 * alfabética (o padrão da API).
 */
export const orderParams = {
  respondido: 'respondedAt',
} as const satisfies Record<string, NonNullable<PartiesControllerListV1Params['order']>>;

export type OrderParam = keyof typeof orderParams;

export type RsvpFilter = keyof typeof rsvpFilters;
export type SentFilter = keyof typeof sentFilters;

export interface PartyFilters {
  q: string;
  rsvp: RsvpFilter | '';
  sent: SentFilter | '';
  /** Id de uma tag ativa (Tags RN09); vazio, todas. */
  tag: string;
  /** A ordem da lista; vazio, a alfabética. Não é filtro (não muda o vazio). */
  order: OrderParam | '';
}

/** Limite da busca no contrato (`q` até 80 caracteres). */
export const SEARCH_MAX_LENGTH = 80;

function pick<T extends string>({ value, options }: { value: string | null; options: object }) {
  return value !== null && Object.hasOwn(options, value) ? (value as T) : '';
}

/** Filtros e busca da lista, guardados na URL (o voltar do navegador e o link funcionam). */
export function usePartyFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters: PartyFilters = {
    q: (searchParams.get('q') ?? '').slice(0, SEARCH_MAX_LENGTH),
    rsvp: pick<RsvpFilter>({ value: searchParams.get('resposta'), options: rsvpFilters }),
    sent: pick<SentFilter>({ value: searchParams.get('envio'), options: sentFilters }),
    tag: searchParams.get('tag') ?? '',
    order: pick<OrderParam>({ value: searchParams.get('ordem'), options: orderParams }),
  };

  function setFilters(next: Partial<PartyFilters>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.q.trim()) params.set('q', merged.q);
    if (merged.rsvp) params.set('resposta', merged.rsvp);
    if (merged.sent) params.set('envio', merged.sent);
    if (merged.tag) params.set('tag', merged.tag);
    if (merged.order) params.set('ordem', merged.order);
    setSearchParams(params, { replace: true });
  }

  return { filters, setFilters };
}

/** Parâmetros do GET /parties a partir dos filtros. */
export function toListParams({
  filters,
}: {
  filters: PartyFilters;
}): PartiesControllerListV1Params {
  const q = filters.q.trim();
  return {
    ...(q && { q }),
    ...(filters.rsvp && { rsvp: rsvpFilters[filters.rsvp] }),
    ...(filters.sent && { sent: sentFilters[filters.sent] }),
    ...(filters.tag && { tag: filters.tag }),
    ...(filters.order && { order: orderParams[filters.order] }),
  };
}

/** O caminho da lista de grupos na ordem de "Respondido em" (a notificação agrupada). */
export function guestsByRespondedAt(guests: string): string {
  return `${guests}?ordem=respondido`;
}
