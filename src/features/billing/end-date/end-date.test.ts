import { describe, expect, it } from 'vitest';
import { canChangeEndDateFree, endDateChoice, endDateLimits, paidAhead } from './end-date';

const SP = 'America/Sao_Paulo';
const published = {
  status: 'published',
  endDate: '2027-02-14',
  paidThrough: '2027-02-14',
  eventDate: '2026-11-14',
  timezone: SP,
};
const now = new Date('2026-12-01T15:00:00Z');

describe('Mudar a data: limites, mês pago à frente e a escolha (RN04 e RN05; 289; 293)', () => {
  it('os limites: de amanhã e depois do casamento até 12 meses depois dele', () => {
    expect(endDateLimits({ source: published, now })).toEqual({
      min: '2026-12-02',
      max: '2027-11-14',
    });
    // Antes do casamento, o mínimo é o dia seguinte a ele.
    expect(
      endDateLimits({ source: published, now: new Date('2026-10-01T15:00:00Z') }),
    ).toMatchObject({ min: '2026-11-15' });
  });

  it('o amanhã é o do fuso do casamento', () => {
    // 23h de 01/12 em São Paulo: amanhã é 02/12.
    expect(
      endDateLimits({ source: published, now: new Date('2026-12-02T02:00:00Z') }),
    ).toMatchObject({ min: '2026-12-02' });
  });

  it('mês pago à frente: quem antecipou, e no expirado o paidThrough depois de hoje', () => {
    expect(paidAhead({ source: published, now })).toBeNull();
    expect(paidAhead({ source: { ...published, endDate: '2027-01-10' }, now })).toBe('2027-02-14');
    const expired = { ...published, status: 'expired', endDate: '2026-11-20' };
    expect(paidAhead({ source: expired, now })).toBe('2027-02-14');
    expect(paidAhead({ source: { ...expired, paidThrough: '2026-11-20' }, now })).toBeNull();
  });

  it.each([
    ['2027-02-14', 'same'],
    ['2027-01-10', 'bringForward'],
    ['2027-05-14', 'extend'],
    ['2026-12-01', 'invalid'],
    ['2027-11-15', 'invalid'],
  ])('no ar, %s → %s', (date, expected) => {
    expect(endDateChoice({ source: published, date, now })).toBe(expected);
  });

  it('quem antecipou volta de graça até o paidThrough; depois dele, a extensão', () => {
    const source = { ...published, endDate: '2027-01-10' };
    expect(endDateChoice({ source, date: '2027-02-01', now })).toBe('restore');
    expect(endDateChoice({ source, date: '2027-02-14', now })).toBe('restore');
    expect(endDateChoice({ source, date: '2027-02-15', now })).toBe('extend');
  });

  it('no expirado com mês pago, até o paidThrough volta ao ar (289(1)); sem ele, só a extensão', () => {
    const expired = { ...published, status: 'expired', endDate: '2026-11-20' };
    expect(endDateChoice({ source: expired, date: '2027-02-14', now })).toBe('restore');
    expect(endDateChoice({ source: expired, date: '2027-03-01', now })).toBe('extend');
    expect(canChangeEndDateFree({ source: expired, now })).toBe(true);
    const noAhead = { ...expired, paidThrough: '2026-11-20' };
    expect(canChangeEndDateFree({ source: noAhead, now })).toBe(false);
  });

  it('a carência sem mês pago à frente fica para o E11 (333)', () => {
    const grace = {
      ...published,
      status: 'grace',
      endDate: '2026-11-28',
      paidThrough: '2026-11-28',
    };
    expect(canChangeEndDateFree({ source: grace, now })).toBe(false);
  });
});
