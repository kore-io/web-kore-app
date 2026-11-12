import { describe, expect, it } from 'vitest';
import { i18n } from './i18n';

describe('i18n', () => {
  it('usa pt-BR com os textos do namespace comum', () => {
    expect(i18n.language).toBe('pt-BR');
    expect(i18n.t('appName')).toBe('Kore');
  });
});

describe('e-mail sem quebra no hífen (decisão 161)', () => {
  it('põe um WORD JOINER (U+2060) depois do hífen de "e-mail" em todo texto', () => {
    expect(i18n.t('signIn.emailLabel', { ns: 'access' })).toBe('E-\u2060mail');
    expect(i18n.t('code.title', { ns: 'access' })).toBe('Confira seu e-\u2060mail');
  });

  it('não mexe em outros hífens nem no endereço interpolado', () => {
    expect(i18n.t('code.description', { ns: 'access', email: 'ana-maria@exemplo.com' })).toContain(
      'ana-maria@exemplo.com',
    );
  });

  it('o valor interpolado sai idêntico, mesmo com "e-mail" dentro (só o texto fixo muda)', () => {
    for (const email of ['e-mail@empresa.com.br', 'contato.e-mail@x.com']) {
      expect(i18n.t('code.resent', { ns: 'access', email })).toBe(
        `Enviamos um código novo para ${email}.`,
      );
    }
  });
});
