import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ApiError } from '../../shared/api/http-client';
import { useRequestReauth } from './hooks/use-request-reauth';
import { destinationAfterLogin } from './login-navigation';
import {
  consumeReauthReturn,
  isReauthRequired,
  REAUTH_STORAGE_KEY,
  rememberReauthReturn,
} from './reauth';

afterEach(() => window.sessionStorage.clear());

describe('a reentrada do REAUTH_REQUIRED (Retenção RN08)', () => {
  it('reconhece o 403 REAUTH_REQUIRED e só ele', () => {
    expect(
      isReauthRequired({
        error: new ApiError({ status: 403, body: { error: 'REAUTH_REQUIRED' } }),
      }),
    ).toBe(true);
    expect(
      isReauthRequired({
        error: new ApiError({ status: 403, body: { error: 'ACTION_NOT_ALLOWED' } }),
      }),
    ).toBe(false);
    expect(isReauthRequired({ error: new TypeError('Failed to fetch') })).toBe(false);
  });

  it('a marca vale uma vez e só para a mesma tela', () => {
    rememberReauthReturn({ path: '/app/configuracoes/casamento' });
    expect(consumeReauthReturn({ returnPath: '/app/configuracoes/casamento' })).toBe(true);
    expect(consumeReauthReturn({ returnPath: '/app/configuracoes/casamento' })).toBe(false);

    rememberReauthReturn({ path: '/app/configuracoes/casamento' });
    expect(consumeReauthReturn({ returnPath: '/app' })).toBe(false);
    expect(window.sessionStorage.getItem(REAUTH_STORAGE_KEY)).toBeNull();
  });

  it('a marca com um caminho de fora do app não vale', () => {
    window.sessionStorage.setItem(REAUTH_STORAGE_KEY, '//malicioso.com');
    expect(consumeReauthReturn({ returnPath: '//malicioso.com' })).toBe(false);
  });

  it('na reentrada, volta à tela mesmo com mais de um perfil (sem a Seleção de perfil)', () => {
    const returnPath = '/cerimonialista/dados-para-receber';
    expect(destinationAfterLogin({ next: 'choose_profile', returnPath, reauth: true })).toEqual({
      kind: 'route',
      path: returnPath,
    });
    expect(destinationAfterLogin({ next: 'home', returnPath, reauth: true })).toEqual({
      kind: 'route',
      path: returnPath,
    });
    // Fora da reentrada, a Seleção de perfil continua (RN14 do Login).
    expect(destinationAfterLogin({ next: 'choose_profile', returnPath })).toEqual({
      kind: 'route',
      path: '/perfis',
    });
  });

  it('o pedido leva ao Entrar com o aviso da tela e o caminho de volta', async () => {
    function Screen() {
      const requestReauth = useRequestReauth();
      return (
        <button
          type="button"
          onClick={() =>
            requestReauth({ message: 'Por segurança, entrem de novo para excluir o casamento.' })
          }
        >
          Excluir
        </button>
      );
    }
    const router = createMemoryRouter(
      [
        { path: '/app/configuracoes/casamento', element: <Screen /> },
        { path: '/entrar', element: <p>Entrar</p> },
      ],
      { initialEntries: ['/app/configuracoes/casamento?aba=1'] },
    );
    render(<RouterProvider router={router} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Excluir' }));
    await act(async () => {});
    expect(router.state.location.pathname).toBe('/entrar');
    expect(router.state.location.search).toBe(
      `?next=${encodeURIComponent('/app/configuracoes/casamento?aba=1')}`,
    );
    expect(router.state.location.state).toEqual({
      notice: {
        kind: 'reauth',
        message: 'Por segurança, entrem de novo para excluir o casamento.',
      },
    });
    expect(window.sessionStorage.getItem(REAUTH_STORAGE_KEY)).toBe(
      '/app/configuracoes/casamento?aba=1',
    );
  });
});
