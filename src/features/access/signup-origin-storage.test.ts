import { afterEach, describe, expect, it } from 'vitest';
import { originFromUrl, saveSignupOrigin, storedSignupOrigin } from './signup-origin-storage';

afterEach(() => window.localStorage.clear());

const day = 24 * 60 * 60 * 1000;
const params = (query: string) => new URLSearchParams(query);

describe('origem do cadastro (decisões 135 e 169(2))', () => {
  it('lê as UTM e o origem=site da URL', () => {
    expect(
      originFromUrl({
        params: params(
          'utm_source=instagram&utm_medium=social&utm_campaign=lancamento&origem=site',
        ),
      }),
    ).toEqual({
      signupSource: 'made_with_kore',
      utmSource: 'instagram',
      utmMedium: 'social',
      utmCampaign: 'lancamento',
    });
    expect(originFromUrl({ params: params('origem=outra&utm_source=') })).toEqual({});
  });

  it('corta a UTM em 200 caracteres (contrato)', () => {
    const long = 'x'.repeat(250);
    expect(originFromUrl({ params: params(`utm_source=${long}`) }).utmSource).toHaveLength(200);
  });

  it('guarda a primeira chegada por 30 dias; a segunda não troca', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    saveSignupOrigin({ origin: { utmSource: 'instagram' }, now });
    saveSignupOrigin({ origin: { utmSource: 'google' }, now: new Date(now.getTime() + day) });
    expect(storedSignupOrigin({ now })).toEqual({ utmSource: 'instagram' });
    expect(storedSignupOrigin({ now: new Date(now.getTime() + 30 * day) })).toEqual({});
  });

  it('descarta da leitura o que o POST não aceita (Crivo)', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    window.localStorage.setItem(
      'kore.signupOrigin',
      JSON.stringify({
        signupSource: 'tiktok',
        utmSource: 42,
        utmMedium: 'x'.repeat(201),
        utmCampaign: 'lancamento',
        savedAt: now.toISOString(),
      }),
    );
    expect(storedSignupOrigin({ now })).toEqual({ utmCampaign: 'lancamento' });
  });

  it('sem nada na URL, não guarda', () => {
    saveSignupOrigin({ origin: {} });
    expect(window.localStorage.getItem('kore.signupOrigin')).toBeNull();
  });
});
