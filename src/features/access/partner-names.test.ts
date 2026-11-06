import { describe, expect, it } from 'vitest';
import { whoAreYouNames } from './partner-names';

describe('nomes do Quem é você? (decisão 182)', () => {
  it('o primeiro nome de cada noivo', () => {
    expect(whoAreYouNames({ names: ['Fernanda Alves', 'João  Lima'] })).toEqual([
      'Fernanda',
      'João',
    ]);
  });

  it('com os dois primeiros nomes iguais, os nomes completos', () => {
    expect(whoAreYouNames({ names: ['Ana Moreira', 'Ana Paula Rocha'] })).toEqual([
      'Ana Moreira',
      'Ana Paula Rocha',
    ]);
    // Igual sem diferença de maiúscula ou acento.
    expect(whoAreYouNames({ names: ['Júlia Prado', 'julia Mendes'] })).toEqual([
      'Júlia Prado',
      'julia Mendes',
    ]);
  });
});
