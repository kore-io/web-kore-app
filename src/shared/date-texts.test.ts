import { describe, expect, it } from 'vitest';
import { oneDot, shortDate, shortDayMonth } from './date-texts';

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
});
