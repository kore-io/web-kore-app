import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { getMeControllerMeV1QueryKey } from '../../shared/api/generated/me/me';
import { ApiError } from '../../shared/api/http-client';
import { useRequestReauth } from './hooks/use-request-reauth';
import {
  consumeReauthReturn,
  isReauthRequired,
  REAUTH_STORAGE_KEY,
  rememberReauthReturn,
} from './reauth';

afterEach(() => window.sessionStorage.clear());

describe('a marca da reentrada do REAUTH_REQUIRED (Retenção RN08)', () => {
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

  it('vale uma vez, só para a mesma tela, e devolve o perfil guardado', () => {
    const path = '/app/configuracoes/casamento';
    rememberReauthReturn({ path, profile: 'couple' });
    expect(consumeReauthReturn({ returnPath: path })).toEqual({ path, profile: 'couple' });
    expect(consumeReauthReturn({ returnPath: path })).toBeUndefined();

    rememberReauthReturn({ path, profile: 'planner' });
    expect(consumeReauthReturn({ returnPath: '/app' })).toBeUndefined();
    expect(window.sessionStorage.getItem(REAUTH_STORAGE_KEY)).toBeNull();
  });

  it('o perfil nulo (sem perfil, ex.: o staff) também volta', () => {
    rememberReauthReturn({ path: '/admin/cobranca', profile: null });
    expect(consumeReauthReturn({ returnPath: '/admin/cobranca' })).toEqual({
      path: '/admin/cobranca',
      profile: null,
    });
  });

  it('a marca com um caminho de fora do app, um perfil estranho ou quebrada não vale', () => {
    window.sessionStorage.setItem(
      REAUTH_STORAGE_KEY,
      JSON.stringify({ path: '//malicioso.com', profile: 'couple' }),
    );
    expect(consumeReauthReturn({ returnPath: '//malicioso.com' })).toBeUndefined();
    window.sessionStorage.setItem(
      REAUTH_STORAGE_KEY,
      JSON.stringify({ path: '/app', profile: 'admin' }),
    );
    expect(consumeReauthReturn({ returnPath: '/app' })).toBeUndefined();
    window.sessionStorage.setItem(REAUTH_STORAGE_KEY, '/app');
    expect(consumeReauthReturn({ returnPath: '/app' })).toBeUndefined();
  });
});

describe('o pedido da reentrada (useRequestReauth)', () => {
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

  async function request({ activeProfile }: { activeProfile?: string | null }) {
    const queryClient = new QueryClient();
    if (activeProfile !== undefined) {
      queryClient.setQueryData(getMeControllerMeV1QueryKey(), { activeProfile });
    }
    const router = createMemoryRouter(
      [
        { path: '/app/configuracoes/casamento', element: <Screen /> },
        { path: '/entrar', element: <p>Entrar</p> },
      ],
      { initialEntries: ['/app/configuracoes/casamento?aba=1'] },
    );
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Excluir' }));
    await act(async () => {});
    return router;
  }

  it('leva ao Entrar com o aviso da tela, o caminho de volta e o perfil ativo do /me', async () => {
    const router = await request({ activeProfile: 'couple' });
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
    expect(JSON.parse(window.sessionStorage.getItem(REAUTH_STORAGE_KEY) ?? '')).toEqual({
      path: '/app/configuracoes/casamento?aba=1',
      profile: 'couple',
    });
  });

  it('sem o /me em cache, guarda o perfil nulo', async () => {
    await request({});
    expect(JSON.parse(window.sessionStorage.getItem(REAUTH_STORAGE_KEY) ?? '')).toEqual({
      path: '/app/configuracoes/casamento?aba=1',
      profile: null,
    });
  });
});
