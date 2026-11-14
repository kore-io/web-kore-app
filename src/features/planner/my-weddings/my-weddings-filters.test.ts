import { describe, expect, it } from 'vitest';
import type { MyWeddingItemResponse } from '../../../shared/api/generated/model';
import {
  coupleName,
  filterWeddings,
  hasFilters,
  NO_FILTERS,
  shortDate,
} from './my-weddings-filters';

const wedding = (overrides: Partial<MyWeddingItemResponse>): MyWeddingItemResponse => ({
  partnerNames: ['Ana', 'Marcos'],
  eventDate: '2026-11-14',
  status: 'published',
  rsvpPercent: 80,
  origin: 'referral_link',
  weddingId: 'w1',
  city: 'Campinas',
  state: 'SP',
  guestsTotal: 120,
  createdByMe: false,
  awaitingPayment: false,
  ...overrides,
});

const list = [
  wedding({ weddingId: 'w1' }),
  wedding({
    weddingId: 'w2',
    partnerNames: ['Natália', 'Vinícius'],
    eventDate: '2026-03-15',
    status: 'expired',
  }),
  wedding({
    weddingId: 'w3',
    partnerNames: ['Fernanda', 'João'],
    eventDate: null,
    status: 'awaiting_couple',
  }),
];

describe('Meus casamentos: os nomes, as datas e os filtros (RN02)', () => {
  it('junta os primeiros nomes e escreve a data curta', () => {
    expect(coupleName({ partnerNames: ['Ana', 'Marcos'] })).toBe('Ana e Marcos');
    expect(shortDate({ date: '2026-11-14' })).toBe('14/11/2026');
  });

  it('a busca ignora acento e maiúsculas', () => {
    const found = filterWeddings({ weddings: list, filters: { ...NO_FILTERS, search: 'NATALIA' } });
    expect(found.map((item) => item.weddingId)).toEqual(['w2']);
    expect(
      filterWeddings({ weddings: list, filters: { ...NO_FILTERS, search: 'joão' } }).map(
        (item) => item.weddingId,
      ),
    ).toEqual(['w3']);
  });

  it('o filtro de status', () => {
    expect(
      filterWeddings({ weddings: list, filters: { ...NO_FILTERS, status: 'expired' } }).map(
        (item) => item.weddingId,
      ),
    ).toEqual(['w2']);
  });

  it('o período, inclusive nas pontas, sem os casamentos sem data (decisão 257(2))', () => {
    const filters = {
      ...NO_FILTERS,
      dateMode: 'period' as const,
      from: '2026-03-15',
      to: '2026-11-14',
    };
    expect(filterWeddings({ weddings: list, filters }).map((item) => item.weddingId)).toEqual([
      'w1',
      'w2',
    ]);
    expect(
      filterWeddings({
        weddings: list,
        filters: { ...NO_FILTERS, dateMode: 'period', from: '2026-04-01', to: '' },
      }).map((item) => item.weddingId),
    ).toEqual(['w1']);
  });

  it('"Escolher período" sem datas não filtra nem conta como filtro', () => {
    const filters = { ...NO_FILTERS, dateMode: 'period' as const };
    expect(filterWeddings({ weddings: list, filters })).toHaveLength(3);
    expect(hasFilters({ filters })).toBe(false);
    expect(hasFilters({ filters: { ...NO_FILTERS, search: ' ana ' } })).toBe(true);
  });
});
