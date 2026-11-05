import { afterEach, describe, expect, it } from 'vitest';
import { currentReferralCode, saveReferralCode, storedReferralCode } from './referral-storage';

afterEach(() => window.localStorage.clear());

const day = 24 * 60 * 60 * 1000;

describe('código de indicação no aparelho (RN08, decisão 165)', () => {
  it('guarda o código do link e devolve enquanto vale', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    saveReferralCode({ code: 'Juliana-Prado', now });
    expect(storedReferralCode({ now })).toBe('juliana-prado');
    expect(storedReferralCode({ now: new Date(now.getTime() + 29 * day) })).toBe('juliana-prado');
  });

  it('vale o primeiro link aberto', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    saveReferralCode({ code: 'juliana-prado', now });
    saveReferralCode({ code: 'lucas-andrade', now: new Date(now.getTime() + day) });
    expect(storedReferralCode({ now })).toBe('juliana-prado');
  });

  it('depois de 30 dias não vale mais, e um link novo passa a valer', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    saveReferralCode({ code: 'juliana-prado', now });
    const later = new Date(now.getTime() + 30 * day);
    expect(storedReferralCode({ now: later })).toBeUndefined();
    saveReferralCode({ code: 'lucas-andrade', now: later });
    expect(storedReferralCode({ now: later })).toBe('lucas-andrade');
  });

  it('ignora código inválido', () => {
    saveReferralCode({ code: '<script>' });
    saveReferralCode({ code: '' });
    expect(storedReferralCode()).toBeUndefined();
  });

  it('o código que vale: o guardado ou, sem ele, o do link aberto agora', () => {
    expect(currentReferralCode({ urlCode: 'Lucas-Andrade' })).toBe('lucas-andrade');
    expect(currentReferralCode({ urlCode: null })).toBeUndefined();
    saveReferralCode({ code: 'juliana-prado' });
    expect(currentReferralCode({ urlCode: 'lucas-andrade' })).toBe('juliana-prado');
  });
});
