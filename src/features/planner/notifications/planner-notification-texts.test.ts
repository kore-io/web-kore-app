import i18n from 'i18next';
import { describe, expect, it } from 'vitest';
import { plannerNotificationDate } from './planner-notification-texts';

const t = i18n.getFixedT('pt-BR', 'dashboard');
const local = (year: number, month: number, day: number, hour: number, minute: number) =>
  new Date(year, month - 1, day, hour, minute).toISOString();
const now = new Date(2026, 8, 26, 18, 0);

describe('plannerNotificationDate (RN05; decisão 302(1))', () => {
  it('hoje e ontem saem numéricos, sem "hoje às" nem "ontem às"', () => {
    expect(plannerNotificationDate({ t, at: local(2026, 9, 26, 9, 12), now })).toBe(
      '26/09 às 9h12',
    );
    expect(plannerNotificationDate({ t, at: local(2026, 9, 25, 21, 5), now })).toBe(
      '25/09 às 21h05',
    );
  });

  it('hora cheia sem os minutos', () => {
    expect(plannerNotificationDate({ t, at: local(2026, 6, 21, 9, 0), now })).toBe('21/06 às 9h');
  });

  it('o ano só quando não é o corrente', () => {
    expect(plannerNotificationDate({ t, at: local(2025, 9, 26, 9, 12), now })).toBe(
      '26/09/2025 às 9h12',
    );
  });
});
