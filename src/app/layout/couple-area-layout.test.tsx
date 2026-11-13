import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../tests/a11y';
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
  memberships: [
    {
      weddingId: 'w1',
      role: 'owner',
      weddingName: 'Ana & Marcos',
      eventDate: '2026-11-14',
      city: 'Campinas',
      state: 'SP',
    },
  ],
  profiles: ['couple'],
  lastProfileOnDevice: 'couple',
  planner: null,
  referrer: null,
  ...overrides,
});

/** Só o /me responde; as telas da área (o Dashboard) ficam com o 404 e o aviso delas. */
function meOnly(path: string, body: object = me()) {
  return path === '/v1/me'
    ? Response.json(body)
    : apiError({ status: 404, body: { error: 'NOT_FOUND' } });
}

describe('área do casal com o /v1/me (decisão 163)', () => {
  it('a Topbar e o menu com os nomes do casal, a pessoa e só o Sair (163(2))', async () => {
    const user = userEvent.setup();
    mockApi(({ path }) => meOnly(path));
    renderRoute({ url: '/app' });
    const trigger = await screen.findByRole('button', { name: 'Menu do usuário' });
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(within(screen.getByRole('banner')).getByText('Ana & Marcos')).toBeInTheDocument();
    await user.click(trigger);
    const menu = await screen.findByRole('menu');
    expect(
      screen.getByText('Ana Beatriz Moreira', { selector: '*:not(button *)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('ana.moreira@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Perfil ativo: Casal · Ana & Marcos')).toBeInTheDocument();
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Sair']);
  });

  it('conta sem nome: o e-mail no lugar do nome', async () => {
    mockApi(({ path }) =>
      meOnly(
        path,
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
    // Dois perfis com o de cerimonialista ativo: a Seleção mostra a escolha.
    mockApi(({ path }) =>
      meOnly(
        path,
        me({
          activeProfile: 'planner',
          profiles: ['couple', 'planner'],
          planner: { organization: 'Prado Assessoria', weddingsCount: 3 },
        }),
      ),
    );
    const { router } = renderRoute({ url: '/app' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/perfis'));
    expect(
      await screen.findByRole('heading', { name: 'Com qual perfil você quer entrar?' }),
    ).toBeInTheDocument();
  });

  it('Sair encerra a sessão e vai ao Entrar (RN09)', async () => {
    const user = userEvent.setup();
    const requests: string[] = [];
    mockApi(({ method, path }) => {
      requests.push(`${method} ${path}`);
      return path === '/v1/auth/logout' ? new Response(null, { status: 204 }) : meOnly(path);
    });
    const { router } = renderRoute({ url: '/app' });
    await user.click(await screen.findByRole('button', { name: 'Menu do usuário' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sair' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(requests).toContain('POST /v1/auth/logout');
  });

  it('Sair com a sessão já encerrada (401) vale como saído', async () => {
    const user = userEvent.setup();
    mockApi(({ path }) =>
      path === '/v1/auth/logout'
        ? apiError({ status: 401, body: { error: 'SESSION_EXPIRED' } })
        : meOnly(path),
    );
    const { router } = renderRoute({ url: '/app' });
    await user.click(await screen.findByRole('button', { name: 'Menu do usuário' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sair' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(screen.queryByText(/Não foi possível continuar/)).toBeNull();
  });

  it.each([
    ['rede', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['5xx', () => apiError({ status: 503, body: { error: 'Service Unavailable' } })],
  ])('se o Sair falhar (%s), avisa no Toast e fica na área (decisão 163(5))', async (_, fail) => {
    const user = userEvent.setup();
    mockApi(({ path }) => (path === '/v1/auth/logout' ? fail() : meOnly(path)));
    const { router } = renderRoute({ url: '/app' });
    await user.click(await screen.findByRole('button', { name: 'Menu do usuário' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sair' }));
    expect(
      await screen.findByText('Não foi possível continuar. Confira sua conexão e tente de novo.'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
  });

  it.each([
    ['rede', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['5xx', () => apiError({ status: 503, body: { error: 'Service Unavailable' } })],
  ])(
    'o /me falhando (%s): aviso com o Tentar de novo, que refaz o /me (decisão 164)',
    async (_, fail) => {
      const user = userEvent.setup();
      let calls = 0;
      // Conta só o /me: o layout também lê o site (o item Músicas, Música RN03).
      mockApi(({ path }) => {
        if (path !== '/v1/me') return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
        calls += 1;
        return calls === 1 ? fail() : Response.json(me());
      });
      const { container } = renderRoute({ url: '/app' });
      expect(await screen.findByText('Não foi possível continuar')).toBeInTheDocument();
      expect(screen.getByText('Confira sua conexão e tente de novo.')).toBeInTheDocument();
      await expectNoA11yViolations({ container });
      await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
      expect(await screen.findByRole('button', { name: 'Menu do usuário' })).toBeInTheDocument();
      // O Tentar de novo refaz o /me; o Dashboard, ao montar, também o relê (useActiveWedding).
      expect(calls).toBeGreaterThanOrEqual(2);
    },
  );
});
