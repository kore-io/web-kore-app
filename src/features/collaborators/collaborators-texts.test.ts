import { describe, expect, it } from 'vitest';
import { availableAtText, initials, memberGroups, sinceDate } from './collaborators-texts';

describe('os textos de Colaboradores', () => {
  it('as iniciais do primeiro e do último nome', () => {
    expect(initials({ name: 'Ana Beatriz Moreira' })).toBe('AM');
    expect(initials({ name: 'juliana' })).toBe('J');
    expect(initials({ name: '  Marcos   Vinícius Rocha ' })).toBe('MR');
  });

  it('o casal e a cerimonialista; o vendedor fica de fora (decisão 271(4))', () => {
    const groups = memberGroups({
      members: [
        { id: 'm1', name: 'Ana', role: 'owner', isMe: true, since: '2026-08-01T12:00:00Z' },
        {
          id: 'm2',
          name: 'Juliana',
          role: 'collaborator',
          kind: 'planner',
          isMe: false,
          since: '2026-08-05T12:00:00Z',
        },
        {
          id: 'm3',
          name: 'Lucas',
          role: 'collaborator',
          kind: 'seller',
          isMe: false,
          since: '2026-08-05T12:00:00Z',
        },
      ],
    });
    expect(groups.owners.map((member) => member.id)).toEqual(['m1']);
    expect(groups.planners.map((member) => member.id)).toEqual(['m2']);
  });

  it('a data em que a trava de 48 h libera, no fuso do casamento (Papéis RN06a)', () => {
    expect(availableAtText({ at: '2026-11-16T17:00:00Z', timezone: 'America/Sao_Paulo' })).toBe(
      '16 de nov. às 14h',
    );
    // 02h30 UTC de 17/11: ainda 16/11 em Manaus.
    expect(availableAtText({ at: '2026-11-17T02:30:00Z', timezone: 'America/Manaus' })).toBe(
      '16 de nov. às 22h30',
    );
    expect(availableAtText({ at: '2026-11-17T02:30:00Z', timezone: null })).toBe(
      '16 de nov. às 23h30',
    );
  });

  it('o "Desde": sem o ano corrente e com o ano quando é outro (decisão 274)', () => {
    const now = new Date('2026-11-16T15:00:00Z');
    expect(sinceDate({ at: '2026-08-05T12:00:00Z', timezone: null, now })).toBe('05/08');
    expect(sinceDate({ at: '2025-08-05T12:00:00Z', timezone: null, now })).toBe('05/08/2025');
    // 01/01 às 01h UTC: ainda 31/12 de 2025 em São Paulo.
    expect(sinceDate({ at: '2026-01-01T01:00:00Z', timezone: 'America/Sao_Paulo', now })).toBe(
      '31/12/2025',
    );
  });
});
