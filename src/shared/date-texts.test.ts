import { describe, expect, it } from 'vitest';
import { dayAndTimeIn, oneDot, shortDate, shortDayMonth } from './date-texts';

describe('as datas por extenso curto', () => {
  it('"15 de out." no ano corrente e com o ano fora dele', () => {
    const now = new Date(2026, 8, 1);
    expect(shortDayMonth({ day: '2026-10-15', now })).toBe('15 de out.');
    expect(shortDayMonth({ day: '2027-04-30', now })).toBe('30 de abr. de 2027');
  });

  it('a data sempre com o ano: "14 de nov. de 2027"', () => {
    expect(shortDate('2027-11-14')).toBe('14 de nov. de 2027');
  });

  it('um ponto só no fim da frase', () => {
    expect(oneDot('No ar até 14 de fev..')).toBe('No ar até 14 de fev.');
  });

  it('a data e a hora no fuso do casamento, não no do aparelho (decisão 246)', () => {
    // 23h14 em São Paulo é 02h14 do dia seguinte em UTC.
    expect(dayAndTimeIn({ at: '2026-09-13T02:14:00Z', timezone: 'America/Sao_Paulo' })).toEqual({
      date: '12/09',
      time: '23h14',
    });
    expect(dayAndTimeIn({ at: '2026-09-13T02:00:00Z', timezone: 'America/Manaus' })).toEqual({
      date: '12/09',
      time: '22h',
    });
    expect(dayAndTimeIn({ at: '2026-09-13T02:05:00Z', timezone: null })).toEqual({
      date: '12/09',
      time: '23h05',
    });
  });
});
