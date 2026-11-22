import { describe, expect, it } from 'vitest';
import { sentDay } from './wedding-detail-texts';

describe('sentDay', () => {
  it('mostra o dia no fuso do casamento, e não no do aparelho nem no de São Paulo (decisão 263(2))', () => {
    const at = '2026-09-20T03:30:00Z';
    expect(sentDay({ at, timezone: 'America/Manaus' })).toBe('19/09');
    expect(sentDay({ at, timezone: 'America/Sao_Paulo' })).toBe('20/09');
    expect(sentDay({ at: '2026-09-20T23:30:00Z', timezone: 'America/Noronha' })).toBe('20/09');
    expect(sentDay({ at: '2026-09-20T23:30:00Z', timezone: 'Asia/Tokyo' })).toBe('21/09');
  });
});
