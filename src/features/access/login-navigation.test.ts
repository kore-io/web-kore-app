import { afterEach, describe, expect, it } from 'vitest';
import { destinationAfterLogin, parseLoginStep, safeReturnPath } from './login-navigation';

afterEach(() => window.localStorage.clear());

describe('caminho de volta (RN10, decisão 136(7))', () => {
  it.each([
    ['/app/convidados?aba=2', '/app/convidados?aba=2'],
    ['//malicioso.com', undefined],
    ['/\\malicioso.com', undefined],
    ['https://malicioso.com', undefined],
    ['/javascript:alert(1)', '/javascript:alert(1)'],
    ['/\t/evil.com', undefined],
    ['/\n/evil.com', undefined],
    ['/\u0000', undefined],
    [`/${'a'.repeat(511)}`, `/${'a'.repeat(511)}`],
    [`/${'a'.repeat(512)}`, undefined],
    ['app', undefined],
    [null, undefined],
  ])('%s → %s', (path, expected) => {
    expect(safeReturnPath({ path })).toBe(expected);
  });
});

describe('destino depois do login (RN06; decisões 142 e 157(4))', () => {
  it('home usa a volta ou a área do casal', () => {
    expect(destinationAfterLogin({ next: 'home' })).toEqual({ kind: 'route', path: '/app' });
    expect(destinationAfterLogin({ next: 'home', returnPath: '/app/x' })).toEqual({
      kind: 'route',
      path: '/app/x',
    });
  });

  it('perfis, cadastro e parceria', () => {
    expect(destinationAfterLogin({ next: 'choose_profile' })).toEqual({
      kind: 'route',
      path: '/perfis',
    });
    expect(destinationAfterLogin({ next: 'couple_signup' })).toEqual({
      kind: 'route',
      path: '/cadastro',
    });
    // Na F6, o cadastro do cerimonialista no app (Cadastro e perfil RN01).
    expect(destinationAfterLogin({ next: 'planner_signup' })).toEqual({
      kind: 'route',
      path: '/cerimonialista/cadastro',
    });
  });

  it('convite: volta ao token guardado; sem ele, Seleção de perfil', () => {
    expect(destinationAfterLogin({ next: 'invite' })).toEqual({ kind: 'route', path: '/perfis' });
    window.localStorage.setItem('kore.inviteToken', 'a/b');
    expect(destinationAfterLogin({ next: 'invite' })).toEqual({
      kind: 'route',
      path: '/convite/a%2Fb',
    });
  });

  it('step da volta do Google', () => {
    expect(parseLoginStep({ step: 'home' })).toBe('home');
    expect(parseLoginStep({ step: 'admin' })).toBeUndefined();
    expect(parseLoginStep({ step: null })).toBeUndefined();
  });
});
