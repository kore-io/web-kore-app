import { describe, expect, it } from 'vitest';
import { routeLinks, venueDateLine } from './venue-format';

describe('Site do casal › o cartão do local (Seções RN07)', () => {
  it('"Sáb., 14 de nov. de 2026 · 16h30"; a hora cheia sem minutos; o que faltar some', () => {
    expect(venueDateLine({ date: '2026-11-14', time: '16:30' })).toBe(
      'Sáb., 14 de nov. de 2026 · 16h30',
    );
    expect(venueDateLine({ date: '2026-11-14', time: '18:00' })).toBe(
      'Sáb., 14 de nov. de 2026 · 18h',
    );
    expect(venueDateLine({ date: '2027-05-15', time: null })).toBe('Sáb., 15 de mai. de 2027');
    expect(venueDateLine({ date: null, time: '09:05' })).toBe('9h05');
    expect(venueDateLine({ date: null, time: null })).toBe('');
  });

  it('as rotas pelo endereço inteiro, com & e # codificados', () => {
    expect(routeLinks('Rua A & B, 10 #2')).toEqual({
      googleMaps:
        'https://www.google.com/maps/search/?api=1&query=Rua%20A%20%26%20B%2C%2010%20%232',
      waze: 'https://waze.com/ul?q=Rua%20A%20%26%20B%2C%2010%20%232&navigate=yes',
    });
  });
});
