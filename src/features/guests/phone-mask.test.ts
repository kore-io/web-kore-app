import { describe, expect, it } from 'vitest';
import { maskPhone } from './phone-mask';

describe('telefone mascarado do painel (a regra do servidor, RN13)', () => {
  it.each([
    ['+5519998763310', '(19) 9****-3310'],
    ['+551933213310', '(19) 3***-3310'],
    ['+5511998768024', '(11) 9****-8024'],
    ['+351912345678', '+351 9** *** 678'],
    // Os mesmos valores que o maskPhone do api-kore-api devolve (conferido rodando o dele).
    ['+14155552671', '+1 4 *** *** 671'],
    ['+447911123456', '+44 7 *** *** 456'],
  ])('%s vira %s', (e164, masked) => {
    expect(maskPhone({ e164 })).toBe(masked);
  });
});
