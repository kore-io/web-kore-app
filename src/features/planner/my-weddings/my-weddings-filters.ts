import type { MyWeddingItemResponse } from '../../../shared/api/generated/model';

/** "Ana e Marcos": os primeiros nomes que a API devolve, juntos pelo app (RN02). */
export function coupleName({ partnerNames }: { partnerNames: readonly string[] }): string {
  return partnerNames.filter(Boolean).join(' e ');
}

/** "14/11/2026" a partir do aaaa-mm-dd do casamento, sem passar por fuso. */
export function shortDate({ date }: { date: string }): string {
  const [year, month, day] = date.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

/** Os 6 status do filtro, na ordem da RN02 (decisão 224, recomendação 10). */
export const STATUS_FILTERS = [
  'awaiting_couple',
  'draft',
  'published',
  'post_event',
  'grace',
  'expired',
] as const satisfies readonly MyWeddingItemResponse['status'][];

export type StatusFilter = (typeof STATUS_FILTERS)[number] | 'all';

export interface MyWeddingsFilters {
  search: string;
  status: StatusFilter;
  /** De e Até (aaaa-mm-dd), só com "Escolher período" (decisão 257(2)). */
  dateMode: 'any' | 'period';
  from: string;
  to: string;
}

export const NO_FILTERS: MyWeddingsFilters = {
  search: '',
  status: 'all',
  dateMode: 'any',
  from: '',
  to: '',
};

/** Sem acento e sem diferenciar maiúsculas (RN02). */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

/** Algum filtro ou a busca está ligado (para o subtítulo e o Limpar filtros). */
export function hasFilters({ filters }: { filters: MyWeddingsFilters }): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    (filters.dateMode === 'period' && (filters.from !== '' || filters.to !== ''))
  );
}

/**
 * A busca e os filtros rodam no app, com a lista inteira na tela (RN02). O período vale
 * pelos dois lados, inclusive; o casamento sem data não entra num período.
 */
export function filterWeddings({
  weddings,
  filters,
}: {
  weddings: readonly MyWeddingItemResponse[];
  filters: MyWeddingsFilters;
}): MyWeddingItemResponse[] {
  const search = normalize(filters.search);
  const period = filters.dateMode === 'period' && (filters.from !== '' || filters.to !== '');
  return weddings.filter((wedding) => {
    if (search && !normalize(coupleName(wedding)).includes(search)) return false;
    if (filters.status !== 'all' && wedding.status !== filters.status) return false;
    if (period) {
      if (!wedding.eventDate) return false;
      const date = wedding.eventDate.slice(0, 10);
      if (filters.from && date < filters.from) return false;
      if (filters.to && date > filters.to) return false;
    }
    return true;
  });
}
