import { describe, expect, it } from 'vitest';
import { addMonths, lifecycleView } from './lifecycle';

describe('addMonths, em paridade com a API (316(7); 329(2); Preço RN02)', () => {
  it.each([
    // Os casos do monthsAfter da API (months-after.spec.ts).
    ['2026-05-10', 6, '2026-11-10'],
    ['2026-08-31', 6, '2027-02-28'],
    // Os da RN02 do Preço: 29/02 e 31/01.
    ['2028-02-29', 12, '2029-02-28'],
    ['2027-01-31', 1, '2027-02-28'],
    ['2028-01-31', 1, '2028-02-29'],
    ['2026-11-14', 12, '2027-11-14'],
  ])('%s + %i meses = %s', (day, months, expected) => {
    expect(addMonths({ day, months })).toBe(expected);
  });
});

const base = {
  status: 'published',
  graceUntil: null as string | null,
  expiredAt: null as string | null,
  paidThrough: '2027-02-14' as string | null,
};
const SP = 'America/Sao_Paulo';

describe('lifecycleView (Data de saída RN01 e RN06; 314; 329)', () => {
  it.each([
    // graceUntil 21/02: expira em 22/02; N = 22/02 − hoje.
    ['2027-02-15T15:00:00Z', 7],
    ['2027-02-20T15:00:00Z', 2],
    ['2027-02-21T15:00:00Z', 1],
  ])('a carência em %s: faltam %i dias', (now, daysLeft) => {
    expect(
      lifecycleView({
        lifecycle: { ...base, status: 'grace', graceUntil: '2027-02-21' },
        eventDate: '2026-11-14',
        timezone: SP,
        now: new Date(now),
      }),
    ).toEqual({ kind: 'grace', daysLeft, graceUntil: '2027-02-21' });
  });

  it('o dia conta no fuso do casamento: 01h de 21/02 em UTC ainda é 20/02 em São Paulo', () => {
    const view = lifecycleView({
      lifecycle: { ...base, status: 'grace', graceUntil: '2027-02-21' },
      eventDate: '2026-11-14',
      timezone: SP,
      now: new Date('2027-02-21T01:00:00Z'),
    });
    expect(view).toMatchObject({ daysLeft: 2 });
  });

  it('o expirado comum: Renovem', () => {
    expect(
      lifecycleView({
        lifecycle: { ...base, status: 'expired', expiredAt: '2027-02-22' },
        eventDate: '2026-11-14',
        timezone: SP,
        now: new Date('2027-03-01T15:00:00Z'),
      }),
    ).toMatchObject({ kind: 'expired', variant: 'renew', since: '2027-02-22' });
  });

  it('o caso B: o paidThrough depois de hoje volta de graça (293(5))', () => {
    expect(
      lifecycleView({
        lifecycle: {
          ...base,
          status: 'expired',
          expiredAt: '2027-01-18',
          paidThrough: '2027-02-14',
        },
        eventDate: '2026-11-14',
        timezone: SP,
        now: new Date('2027-01-20T15:00:00Z'),
      }),
    ).toMatchObject({ variant: 'paidAhead', paidThrough: '2027-02-14' });
  });

  it('sem renovação: hoje no fuso já chegou a 12 meses depois do casamento (314(4); 329(2))', () => {
    const lifecycle = { ...base, status: 'expired', expiredAt: '2027-11-10' };
    const at = (now: string) =>
      lifecycleView({ lifecycle, eventDate: '2026-11-14', timezone: SP, now: new Date(now) });
    // 13/11 às 23h em São Paulo (14/11 em UTC): ainda dá para renovar até 14/11.
    expect(at('2027-11-14T02:00:00Z')).toMatchObject({ variant: 'renew' });
    expect(at('2027-11-14T15:00:00Z')).toMatchObject({ variant: 'final' });
  });

  it('pós-evento: só o selo; publicado e rascunho: nada', () => {
    const view = (status: string) =>
      lifecycleView({
        lifecycle: { ...base, status },
        eventDate: null,
        timezone: SP,
        now: new Date('2027-02-18T15:00:00Z'),
      });
    expect(view('post_event')).toEqual({ kind: 'post_event' });
    expect(view('published')).toEqual({ kind: 'none' });
    expect(view('draft')).toEqual({ kind: 'none' });
  });
});
