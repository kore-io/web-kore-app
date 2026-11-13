import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import type { DashboardStatsResponse } from '../../shared/api/generated/model';
import {
  activityDate,
  activityTexts,
  buffetDetail,
  countdownLine,
  guestsDetail,
  rateDetail,
} from './dashboard-texts';

const t = i18next.getFixedT('pt-BR', 'dashboard');

const stats = (overrides: Partial<DashboardStatsResponse> = {}): DashboardStatsResponse => ({
  guestsTotal: 142,
  confirmed: 96,
  declined: 18,
  pending: 28,
  adultsConfirmed: 82,
  childrenConfirmed: 11,
  babiesConfirmed: 3,
  partiesPending: 10,
  rsvpPercent: 80,
  partiesTotal: 58,
  ...overrides,
});

describe('textos do Dashboard (RN01, RN02, RN04)', () => {
  it('a contagem: o plural, o singular, o dia e sem linha depois ou sem data', () => {
    const now = new Date(2026, 10, 13);
    expect(countdownLine({ t, daysUntilEvent: 26, eventDate: '2026-12-09', now })).toBe(
      'Faltam 26 dias para o casamento · qua., 9 de dez.',
    );
    expect(countdownLine({ t, daysUntilEvent: 1, eventDate: '2026-11-14', now })).toBe(
      'Falta 1 dia para o casamento · sáb., 14 de nov.',
    );
    expect(countdownLine({ t, daysUntilEvent: 0, eventDate: '2026-11-13', now })).toBe(
      'O casamento é hoje!',
    );
    expect(countdownLine({ t, daysUntilEvent: -1, eventDate: '2026-11-12', now })).toBeNull();
    expect(countdownLine({ t, daysUntilEvent: null, eventDate: null, now })).toBeNull();
  });

  it('Convidados: a parte com zero sai, e o singular', () => {
    expect(guestsDetail({ t, stats: stats() })).toBe(
      'em 58 grupos · 96 confirmados, 18 recusados e 28 pendentes',
    );
    expect(guestsDetail({ t, stats: stats({ declined: 0, pending: 1, partiesTotal: 1 }) })).toBe(
      'em 1 grupo · 96 confirmados e 1 pendente',
    );
  });

  it('Buffet: as faixas com zero saem; uma pessoa concorda com ela; sem faixa, nada', () => {
    expect(buffetDetail({ t, stats: stats() })).toBe(
      '82 adultos, 11 crianças e 3 bebês confirmados',
    );
    expect(
      buffetDetail({
        t,
        stats: stats({ adultsConfirmed: 1, childrenConfirmed: 0, babiesConfirmed: 0 }),
      }),
    ).toBe('1 adulto confirmado');
    expect(
      buffetDetail({
        t,
        stats: stats({ adultsConfirmed: 0, childrenConfirmed: 1, babiesConfirmed: 0 }),
      }),
    ).toBe('1 criança confirmada');
    expect(
      buffetDetail({
        t,
        stats: stats({ adultsConfirmed: 0, childrenConfirmed: 0, babiesConfirmed: 0 }),
      }),
    ).toBeNull();
  });

  it('Taxa de resposta: com e sem prazo', () => {
    const now = new Date(2026, 8, 1);
    expect(rateDetail({ t, stats: stats(), deadline: '2026-10-15', now })).toBe(
      '114 de 142 responderam · prazo: 15 de out.',
    );
    expect(
      rateDetail({ t, stats: stats({ confirmed: 0, declined: 0 }), deadline: null, now }),
    ).toBe('0 de 142 responderam · sem prazo');
  });

  it('a data da atividade: hoje, ontem e antes', () => {
    const now = new Date(2026, 10, 13, 22, 0);
    expect(activityDate({ t, at: new Date(2026, 10, 13, 20, 14).toISOString(), now })).toBe(
      'hoje às 20h14',
    );
    expect(activityDate({ t, at: new Date(2026, 10, 12, 20, 0).toISOString(), now })).toBe(
      'ontem às 20h',
    );
    expect(activityDate({ t, at: new Date(2026, 8, 24, 19, 40).toISOString(), now })).toBe(
      '24/09 às 19h40',
    );
  });

  it('o item: 1 grupo com os números; vários com os nomes e o "+ n grupos"', () => {
    const group = (name: string, confirmed = 3, declined = 1) => ({
      at: '2026-11-13T20:14:00Z',
      partyId: name,
      name,
      confirmed,
      declined,
    });
    const base = { source: 'notification' as const, readAt: null, at: '', id: 'n1' };
    expect(
      activityTexts({ t, item: { ...base, count: 1, groups: [group('Família Moreira')] } }),
    ).toEqual({
      title: 'Família Moreira respondeu o convite',
      detail: '3 confirmados, 1 recusado',
    });
    expect(
      activityTexts({ t, item: { ...base, count: 1, groups: [group('Tio Jorge', 0, 2)] } }).detail,
    ).toBe('2 recusados');
    expect(
      activityTexts({
        t,
        item: {
          ...base,
          count: 5,
          groups: ['Família Moreira', 'Família Duarte', 'Carla e Rafael', 'Tio Jorge'].map((name) =>
            group(name),
          ),
        },
      }),
    ).toEqual({
      title: '5 grupos responderam',
      detail: 'Família Moreira · Família Duarte · Carla e Rafael · + 2 grupos',
    });
  });
});
