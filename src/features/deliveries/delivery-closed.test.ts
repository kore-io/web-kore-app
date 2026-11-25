import { describe, expect, it } from 'vitest';
import { deliveriesClosed } from './delivery-closed';

const membership = (lifecycle: Record<string, unknown>) => ({
  eventDate: '2026-11-14',
  timezone: 'America/Sao_Paulo',
  lifecycle: {
    status: 'expired',
    endDate: null,
    graceUntil: null,
    expiredAt: '2027-02-22',
    paidThrough: null,
    deletionScheduledFor: null,
    blocked: false,
    ...lifecycle,
  } as never,
});
const now = new Date('2027-03-01T15:00:00Z');

describe('deliveriesClosed (Envios RN01; Data de saída RN07; 314(3); 330)', () => {
  it.each([
    ['published', null],
    ['grace', null],
    ['post_event', 'post_event'],
    ['draft', 'not_published'],
    ['awaiting_couple', 'not_published'],
    ['expired', 'expired'],
  ])('%s → %s', (status, expected) => {
    expect(deliveriesClosed({ status, membership: membership({}), now })).toBe(expected);
  });

  it('sem renovação: hoje já chegou a 12 meses depois do casamento', () => {
    expect(
      deliveriesClosed({
        status: 'expired',
        membership: membership({ expiredAt: '2027-11-10' }),
        now: new Date('2027-11-20T15:00:00Z'),
      }),
    ).toBe('expired_final');
  });

  it('sem o lifecycle no /me, o expirado comum', () => {
    expect(deliveriesClosed({ status: 'expired', membership: undefined, now })).toBe('expired');
  });
});
