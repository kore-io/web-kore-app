import { describe, expect, it } from 'vitest';
import {
  dayAndTimeIn,
  dayMonthIn,
  dayMonthTimeIn,
  oneDot,
  shortDate,
  shortDayMonth,
} from './date-texts';

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
      day: '2026-09-12',
    });
    expect(dayAndTimeIn({ at: '2026-09-13T02:00:00Z', timezone: 'America/Manaus' })).toEqual({
      date: '12/09',
      time: '22h',
      day: '2026-09-12',
    });
    expect(dayAndTimeIn({ at: '2026-09-13T02:05:00Z', timezone: null })).toEqual({
      date: '12/09',
      time: '23h05',
      day: '2026-09-12',
    });
  });

  it('um instante por extenso curto no fuso do casamento, com o ano só fora do corrente', () => {
    const now = new Date('2026-09-01T12:00:00Z');
    // 01h de 29/09 em UTC ainda é 28/09 em São Paulo.
    expect(dayMonthIn({ at: '2026-09-29T01:00:00Z', timezone: 'America/Sao_Paulo', now })).toBe(
      '28 de set.',
    );
    expect(dayMonthIn({ at: '2027-04-30T15:00:00Z', timezone: 'America/Sao_Paulo', now })).toBe(
      '30 de abr. de 2027',
    );
    expect(dayMonthIn({ at: '2026-09-29T01:00:00Z', timezone: null, now })).toBe('28 de set.');
  });

  it('o ano corrente é o do fuso: na virada, 31/12 em São Paulo ainda é o ano corrente', () => {
    // 02h de 01/01/2027 em UTC é 23h de 31/12/2026 em São Paulo.
    const now = new Date('2027-01-01T02:00:00Z');
    expect(dayMonthIn({ at: '2026-12-31T20:00:00Z', timezone: 'America/Sao_Paulo', now })).toBe(
      '31 de dez.',
    );
    expect(dayMonthIn({ at: '2027-01-05T15:00:00Z', timezone: 'America/Sao_Paulo', now })).toBe(
      '5 de jan. de 2027',
    );
  });

  it('o instante com a hora: "28 de set. às 14h" e "11 de ago. às 15h20"', () => {
    const now = new Date('2026-08-01T12:00:00Z');
    expect(dayMonthTimeIn({ at: '2026-09-28T17:00:00Z', timezone: 'America/Sao_Paulo', now })).toBe(
      '28 de set. às 14h',
    );
    expect(dayMonthTimeIn({ at: '2026-08-11T18:20:00Z', timezone: 'America/Sao_Paulo', now })).toBe(
      '11 de ago. às 15h20',
    );
  });
});
