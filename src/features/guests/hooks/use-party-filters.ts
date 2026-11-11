import { useSearchParams } from 'react-router';
import type {
  PartiesControllerListV1Params,
  PartiesControllerListV1Rsvp,
  PartiesControllerListV1Sent,
} from '../../../shared/api/generated/model';

/**
 * Valores dos filtros na URL (decisão 198): `?q=&resposta=&envio=`, em português como os
 * caminhos; a tela troca pelos valores da API.
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

export type RsvpFilter = keyof typeof rsvpFilters;
export type SentFilter = keyof typeof sentFilters;

export interface PartyFilters {
  q: string;
  rsvp: RsvpFilter | '';
  sent: SentFilter | '';
}

/** Limite da busca no contrato (`q` até 80 caracteres). */
export const SEARCH_MAX_LENGTH = 80;

function pick<T extends string>({ value, options }: { value: string | null; options: object }) {
  return value !== null && value in options ? (value as T) : '';
}

/** Filtros e busca da lista, guardados na URL (o voltar do navegador e o link funcionam). */
export function usePartyFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters: PartyFilters = {
    q: (searchParams.get('q') ?? '').slice(0, SEARCH_MAX_LENGTH),
    rsvp: pick<RsvpFilter>({ value: searchParams.get('resposta'), options: rsvpFilters }),
    sent: pick<SentFilter>({ value: searchParams.get('envio'), options: sentFilters }),
  };

  function setFilters(next: Partial<PartyFilters>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.q.trim()) params.set('q', merged.q);
    if (merged.rsvp) params.set('resposta', merged.rsvp);
    if (merged.sent) params.set('envio', merged.sent);
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
  };
}
