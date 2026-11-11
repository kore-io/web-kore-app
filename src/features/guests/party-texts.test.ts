import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import type { PartyListItemResponse } from '../../shared/api/generated/model';
import { contactText, respondedAtText, responsesText, summaryText } from './party-texts';

const t = i18next.getFixedT('pt-BR', 'guests');

function party(overrides: Partial<PartyListItemResponse> = {}): PartyListItemResponse {
  return {
    id: 'p1',
    name: 'Família Moreira',
    contact: { guestId: 'g1', name: 'Célia Moreira', phoneMasked: '(19) 9****-3310' },
    firstGuestName: 'Luiz Moreira',
    people: 3,
    counts: { confirmed: 0, declined: 0, pending: 3, pendingPlusOnes: 0 },
    deliveryStatus: 'not_sent',
    respondedAt: null,
    respondedBy: null,
    tags: [],
    ...overrides,
  };
}

describe('textos da lista de grupos', () => {
  it('resumo do topo, como no Penpot', () => {
    expect(
      summaryText({
        t,
        summary: {
          guests: 142,
          namedGuests: 140,
          parties: 58,
          confirmed: 96,
          declined: 18,
          pending: 28,
        },
      }),
    ).toBe('142 convidados em 58 grupos · 96 confirmados, 18 recusados e 28 pendentes');
  });

  it('resumo com 0 e 1 usa o plural do zero (decisão 199(2))', () => {
    expect(
      summaryText({
        t,
        summary: { guests: 1, namedGuests: 1, parties: 1, confirmed: 0, declined: 0, pending: 1 },
      }),
    ).toBe('1 convidado em 1 grupo · 0 confirmados, 0 recusados e 1 pendente');
  });

  it('contato com telefone, sem contato e só com e-mail (RN06; 198(e))', () => {
    expect(contactText({ t, party: party() })).toBe('Célia Moreira · (19) 9****-3310');
    expect(
      contactText({ t, party: party({ contact: null, firstGuestName: 'Helena Moreira' }) }),
    ).toBe(
      // "e-mail" sem quebra no hífen (decisão 161).
      'Helena Moreira · sem telefone ou e-\u2060mail',
    );
    expect(
      contactText({
        t,
        party: party({ contact: { guestId: 'g1', name: 'Célia Moreira', phoneMasked: null } }),
      }),
    ).toBe('Célia Moreira');
  });

  it.each([
    [
      { confirmed: 3, declined: 0, pending: 0, pendingPlusOnes: 0 },
      '3 confirmados',
      'nenhum recusado ou pendente',
    ],
    [
      { confirmed: 1, declined: 1, pending: 1, pendingPlusOnes: 1 },
      '1 confirmado',
      '1 recusado · 1 vaga pendente',
    ],
    [
      { confirmed: 0, declined: 0, pending: 1, pendingPlusOnes: 0 },
      'nenhum confirmado',
      'nenhum recusado · 1 pendente',
    ],
    [
      { confirmed: 0, declined: 0, pending: 2, pendingPlusOnes: 0 },
      'nenhum confirmado',
      'nenhum recusado · 2 pendentes',
    ],
    [{ confirmed: 1, declined: 2, pending: 0, pendingPlusOnes: 0 }, '1 confirmado', '2 recusados'],
    [
      { confirmed: 0, declined: 0, pending: 4, pendingPlusOnes: 2 },
      'nenhum confirmado',
      'nenhum recusado · 2 pendentes · 2 vagas pendentes',
    ],
  ])('respostas %o (198(f))', (counts, primary, secondary) => {
    expect(responsesText({ t, counts })).toEqual({ primary, secondary });
  });

  it('respondido em: sem resposta é null; com resposta, data curta e quem respondeu', () => {
    expect(respondedAtText({ t, party: party() })).toBeNull();
    const at = new Date(2026, 8, 12, 20, 14).toISOString();
    expect(respondedAtText({ t, party: party({ respondedAt: at, respondedBy: 'Célia' }) })).toEqual(
      {
        primary: '12/09 às 20h14',
        secondary: 'por Célia',
      },
    );
    const fullHour = new Date(2026, 5, 21, 9, 0).toISOString();
    expect(respondedAtText({ t, party: party({ respondedAt: fullHour }) })?.primary).toBe(
      '21/06 às 9h',
    );
  });
});
