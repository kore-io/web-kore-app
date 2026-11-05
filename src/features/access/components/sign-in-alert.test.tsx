import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { SignInAlert, type SignInNotice } from './sign-in-alert';

describe('SignInAlert (Voz, decisão 150)', () => {
  it.each<[SignInNotice, string, string]>([
    [
      { kind: 'session-expired' },
      'Sua sessão terminou',
      'Entre de novo para continuar. Suas informações estão salvas.',
    ],
    [
      { kind: 'wrong-code', attemptsLeft: 2 },
      'Esse código não confere',
      'Confira os números no e-mail e tente de novo. Você ainda tem 2 tentativas; depois disso, pedimos um código novo para você.',
    ],
    [
      { kind: 'wrong-code', attemptsLeft: 1 },
      'Esse código não confere',
      'Confira os números no e-mail e tente de novo. Você ainda tem 1 tentativa; depois disso, pedimos um código novo para você.',
    ],
    [
      { kind: 'code-expired' },
      'Esse código não vale mais',
      'Peça um novo em Reenviar código. Se você pediu mais de um, use o do e-mail mais recente.',
    ],
    [
      { kind: 'too-many-requests', minutes: 12 },
      'Você pediu muitos códigos',
      'Tente de novo em 12 minutos.',
    ],
    [
      { kind: 'too-many-requests', minutes: 1 },
      'Você pediu muitos códigos',
      'Tente de novo em 1 minuto.',
    ],
    [
      { kind: 'new-code-sent', email: 'ana@exemplo.com' },
      'Pedimos um código novo para você',
      'Depois de 5 tentativas, enviamos outro para ana@exemplo.com. Use o código do e-mail mais recente.',
    ],
    [
      { kind: 'locked', minutes: 3 },
      'Esse código não vale mais',
      'Você pediu muitos códigos. Tente de novo em 3 minutos.',
    ],
    [
      { kind: 'google-unverified' },
      'O Google não confirmou seu e-mail',
      'Para entrar, receba um código no seu e-mail.',
    ],
    [
      { kind: 'google-failed' },
      'Não foi possível entrar com o Google',
      'Tente de novo ou receba um código no seu e-mail.',
    ],
  ])('%o', (notice, title, description) => {
    render(<SignInAlert notice={notice} />);
    expect(screen.getByText(title)).toHaveClass('kore-alert__title');
    expect(screen.getByText(description)).toHaveClass('kore-alert__description');
  });

  it('bloqueado: texto sem dizer o motivo e o e-mail do suporte como link', () => {
    render(<SignInAlert notice={{ kind: 'blocked' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível entrar com esta contaEscreva para suporte@kore.com.br.',
    );
    expect(screen.getByRole('link', { name: 'suporte@kore.com.br' })).toHaveAttribute(
      'href',
      'mailto:suporte@kore.com.br',
    );
  });

  it('a sessão expirada é aviso fixo (sem role=alert); os erros são alert', () => {
    const { rerender } = render(<SignInAlert notice={{ kind: 'session-expired' }} />);
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<SignInAlert notice={{ kind: 'code-expired' }} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('é acessível', async () => {
    const { container } = render(<SignInAlert notice={{ kind: 'blocked' }} />);
    await expectNoA11yViolations({ container });
  });
});
