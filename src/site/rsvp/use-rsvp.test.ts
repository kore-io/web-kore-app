import { describe, expect, it } from 'vitest';
import { apiError, mockApi } from '../../../tests/render-route';
import { deadlineText, sendRsvp } from './use-rsvp';

const body = { version: 3, signedByGuestId: 'g1', guests: [] };

describe('o envio do RSVP (Confirmar presença RN07 a RN11, RN14)', () => {
  it.each([
    [400, { statusCode: 400, errors: [{ path: 'guests.0.name', code: 'MAX_LENGTH' }] }, 'invalid'],
    [
      409,
      { statusCode: 409, error: 'RSVP_CHANGED', current: { party: { version: 4 } } },
      'changed',
    ],
    [409, { statusCode: 409, error: 'RSVP_CLOSED', reason: 'post_event' }, 'closed'],
    [401, { statusCode: 401, error: 'PARTY_SESSION_INVALID' }, 'linkInvalid'],
    [403, { statusCode: 403, error: 'PREVIEW_READ_ONLY' }, 'previewReadOnly'],
    [429, { statusCode: 429, error: 'RSVP_LIMIT' }, 'limit'],
    [429, { statusCode: 429, error: 'RSVP_RATE_LIMITED' }, 'failed'],
    [500, { statusCode: 500 }, 'failed'],
  ])('%i %j → %s', async (status, error, kind) => {
    mockApi(() => apiError({ status, body: error }));
    expect((await sendRsvp({ slug: 'ana-e-marcos', body })).kind).toBe(kind);
  });

  it('o 409 RSVP_CLOSED traz o motivo', async () => {
    mockApi(() =>
      apiError({ status: 409, body: { error: 'RSVP_CLOSED', reason: 'deadline_passed' } }),
    );
    expect(await sendRsvp({ slug: 'ana-e-marcos', body })).toEqual({
      kind: 'closed',
      reason: 'deadline_passed',
    });
  });

  it('o prazo por extenso curto, sem o ano corrente (R2)', () => {
    const now = new Date('2026-09-20T12:00:00Z');
    expect(deadlineText({ day: '2026-10-15', now })).toBe('15 de out.');
    expect(deadlineText({ day: '2027-01-10', now })).toBe('10 de jan. de 2027');
  });
});
