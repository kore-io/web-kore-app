import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, mockApi, renderRoute } from '../../../tests/render-route';

afterEach(() => {
  vi.unstubAllGlobals();
});

const me = (overrides: Record<string, unknown> = {}) => ({
  user: {
    id: 'u1',
    name: 'Ana Beatriz Moreira',
    email: 'ana.moreira@gmail.com',
    platformRole: 'none',
  },
  activeProfile: 'couple',
  authenticatedAt: '2026-11-05T12:00:00Z',
  ...overrides,
});

describe('área do casal com o /v1/me (decisão 163)', () => {
  it('mostra a pessoa, o perfil ativo e só o Sair no Menu do usuário', async () => {
    const user = userEvent.setup();
    mockApi(() => Response.json(me()));
    renderRoute({ url: '/app' });
    const trigger = await screen.findByRole('button', { name: 'Menu do usuário' });
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    await user.click(trigger);
    const menu = await screen.findByRole('menu');
    expect(
      screen.getByText('Ana Beatriz Moreira', { selector: '*:not(button *)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('ana.moreira@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Perfil ativo: Casal')).toBeInTheDocument();
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Sair']);
  });

  it('conta sem nome: o e-mail no lugar do nome', async () => {
    mockApi(() =>
      Response.json(
        me({ user: { id: 'u1', name: null, email: 'ana@exemplo.com', platformRole: 'none' } }),
      ),
    );
    renderRoute({ url: '/app' });
    expect(await screen.findByRole('button', { name: 'Menu do usuário' })).toHaveTextContent('A');
  });

  it('sem sessão: vai à Sessão expirada com a página atual no ?next= (RN10)', async () => {
    mockApi(() => apiError({ status: 401, body: { error: 'SESSION_EXPIRED' } }));
    const { router } = renderRoute({ url: '/app' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/sessao-expirada'));
    expect(router.state.location.search).toBe('?next=%2Fapp');
    expect(await screen.findByText('Sua sessão terminou')).toBeInTheDocument();
  });

  it('com outro perfil ativo (ou nenhum): vai à Seleção de perfil (RN14)', async () => {
    mockApi(() => Response.json(me({ activeProfile: 'planner' })));
    const { router } = renderRoute({ url: '/app' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/perfis'));
  });

  it('Sair encerra a sessão e vai ao Entrar (RN09)', async () => {
    const user = userEvent.setup();
    const requests: string[] = [];
    mockApi(({ method, path }) => {
      requests.push(`${method} ${path}`);
      return path === '/v1/auth/logout' ? new Response(null, { status: 204 }) : Response.json(me());
    });
    const { router } = renderRoute({ url: '/app' });
    await user.click(await screen.findByRole('button', { name: 'Menu do usuário' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sair' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(requests).toContain('POST /v1/auth/logout');
  });

  it('se o Sair falhar, avisa no Toast e fica na área (decisão 163(5))', async () => {
    const user = userEvent.setup();
    mockApi(({ path }) => {
      if (path === '/v1/auth/logout') throw new TypeError('Failed to fetch');
      return Response.json(me());
    });
    const { router } = renderRoute({ url: '/app' });
    await user.click(await screen.findByRole('button', { name: 'Menu do usuário' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sair' }));
    expect(
      await screen.findByText('Não foi possível continuar. Confira sua conexão e tente de novo.'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
  });
});
