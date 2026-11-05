import { describe, expect, it } from 'vitest';
import { menuUser } from './session-user';

const user = { id: 'u1', email: 'ana.moreira@gmail.com', platformRole: 'none' as const };

describe('pessoa no Menu do usuário (decisão 163(3))', () => {
  it('com nome: o nome e as iniciais do primeiro e do último nome', () => {
    expect(menuUser({ user: { ...user, name: 'Ana Beatriz Moreira' } })).toEqual({
      name: 'Ana Beatriz Moreira',
      email: 'ana.moreira@gmail.com',
      initials: 'AM',
    });
    expect(menuUser({ user: { ...user, name: 'Ana' } }).initials).toBe('A');
  });

  it('sem nome: o e-mail no lugar do nome e a primeira letra do e-mail', () => {
    expect(menuUser({ user: { ...user, name: null } })).toEqual({
      name: 'ana.moreira@gmail.com',
      email: 'ana.moreira@gmail.com',
      initials: 'A',
    });
  });
});
