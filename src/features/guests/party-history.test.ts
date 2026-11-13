import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import { historyAt, historyLine } from './party-history';

const t = i18next.getFixedT('pt-BR', 'guests');
const at = new Date(2026, 8, 12, 20, 14).toISOString();
const line = (entry: object) =>
  historyLine({ t, entry: { at, ...entry } as never, plusOneLabel: 'Acompanhante' });

describe('o Histórico do grupo (Prazo e respostas RN05)', () => {
  it('os envios por canal e o convite aberto', () => {
    expect(line({ kind: 'sent', channel: 'whatsapp' })).toBe('Convite enviado pelo WhatsApp');
    expect(line({ kind: 'sent', channel: 'email' })).toBe('Convite enviado por e-\u2060mail');
    expect(line({ kind: 'sent', channel: 'link' })).toBe('Mensagem do convite copiada');
    expect(line({ kind: 'sent', channel: 'qr' })).toBe('QR code do convite baixado');
    expect(line({ kind: 'save_the_date', channel: 'whatsapp' })).toBe(
      'Save the date enviado pelo WhatsApp',
    );
    expect(line({ kind: 'reminder', channel: 'whatsapp' })).toBe('Lembrete enviado pelo WhatsApp');
    expect(line({ kind: 'viewed' })).toBe('Convite aberto');
  });

  it('a resposta do grupo, com a parte com zero fora e o singular', () => {
    const response = { kind: 'response', actor: 'party', signedBy: 'Célia' };
    expect(line({ ...response, confirmed: 3, declined: 0 })).toBe(
      'Respondido por Célia: 3 confirmados',
    );
    expect(line({ ...response, confirmed: 2, declined: 1 })).toBe(
      'Respondido por Célia: 2 confirmados, 1 recusado',
    );
    expect(line({ ...response, confirmed: 0, declined: 3 })).toBe(
      'Respondido por Célia: 3 recusados',
    );
    expect(
      line({ kind: 'response', actor: 'party', signedBy: null, confirmed: 1, declined: 0 }),
    ).toBe('Respondido pelo grupo: 1 confirmado');
  });

  it('a alteração do casal, com quem alterou e o convidado', () => {
    const changed = { kind: 'response', actor: 'couple', actorName: 'Ana' };
    expect(line({ ...changed, guest: { name: 'Pedro Moreira', status: 'declined' } })).toBe(
      'Resposta alterada por Ana: Pedro Moreira não vai',
    );
    expect(line({ ...changed, guest: { name: null, status: 'confirmed' } })).toBe(
      'Resposta alterada por Ana: Acompanhante vai',
    );
  });

  it('a hora: "12/09 às 20h14" e a cheia sem minutos', () => {
    expect(historyAt({ t, at })).toBe('12/09 às 20h14');
    expect(historyAt({ t, at: new Date(2026, 5, 21, 9, 0).toISOString() })).toBe('21/06 às 9h');
  });
});
