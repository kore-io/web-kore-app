import { describe, expect, it } from 'vitest';
import { endDateInRange, publishBlock, shortDate } from './publication';

const ready = {
  status: 'draft',
  slug: 'ana-e-marcos',
  eventDate: '2026-11-14',
  timezone: 'America/Sao_Paulo',
  publication: { courtesyEnabled: true, endDateMin: '2026-11-15', endDateMax: '2027-11-14' },
};

describe('o que impede publicar (Publicação por Cortesia RN01 a RN04; 228(4))', () => {
  it('pronto para publicar: nenhum motivo', () => {
    expect(publishBlock({ site: ready, role: 'owner' })).toBeNull();
  });

  it.each([
    ['a colaboradora', { role: 'collaborator' }, 'notOwner'],
    ['o casal ainda não aceitou', { site: { status: 'awaiting_couple' } }, 'awaitingCouple'],
    [
      'a Cortesia desligada',
      { site: { publication: { ...ready.publication, courtesyEnabled: false } } },
      'courtesyDisabled',
    ],
    ['sem endereço', { site: { slug: null } }, 'slugMissing'],
    ['sem data', { site: { eventDate: null } }, 'eventDateMissing'],
    ['sem fuso (UF)', { site: { timezone: null } }, 'timezoneMissing'],
  ])('%s', (_case, change, expected) => {
    const { role = 'owner', site = {} } = change as { role?: string; site?: object };
    expect(publishBlock({ site: { ...ready, ...site } as typeof ready, role })).toBe(expected);
  });

  it('a colaboradora vem antes de qualquer outro motivo', () => {
    expect(
      publishBlock({
        site: { ...ready, slug: null } as unknown as typeof ready,
        role: 'collaborator',
      }),
    ).toBe('notOwner');
  });

  it('a data de saída do ar entre os limites do servidor, com os dois extremos', () => {
    const range = { min: '2026-11-15', max: '2027-11-14' };
    expect(endDateInRange({ endDate: '2026-11-15', ...range })).toBe(true);
    expect(endDateInRange({ endDate: '2027-11-14', ...range })).toBe(true);
    expect(endDateInRange({ endDate: '2026-11-14', ...range })).toBe(false);
    expect(endDateInRange({ endDate: '2027-12-14', ...range })).toBe(false);
    expect(endDateInRange({ endDate: '', ...range })).toBe(false);
  });

  it('a data curta da ajuda: "14 de nov. de 2027"', () => {
    expect(shortDate('2027-11-14')).toBe('14 de nov. de 2027');
  });
});
