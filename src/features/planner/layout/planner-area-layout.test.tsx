import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

afterEach(() => {
  vi.unstubAllGlobals();
});

const me = (overrides: Record<string, unknown> = {}) => ({
  user: {
    id: 'u1',
    name: 'Juliana Prado',
    email: 'juliana@pradoassessoria.com.br',
    platformRole: 'none',
  },
  activeProfile: 'planner',
  authenticatedAt: '2026-11-14T12:00:00Z',
  memberships: [],
  profiles: ['planner'],
  lastProfileOnDevice: 'planner',
  planner: { organization: 'Prado Assessoria', weddingsCount: 2 },
  referrer: null,
  plannerSignupEnabled: true,
  ...overrides,
});

function meOnly(path: string, body: object = me()) {
  return path === '/v1/me'
    ? Response.json(body)
    : apiError({ status: 404, body: { error: 'NOT_FOUND' } });
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Menu do usuário' }));
  return screen.findByRole('menu');
}

describe('a moldura da Área do cerimonialista (D3; Cadastro e perfil RN07 e RN08)', () => {
  it('a Sidebar sem Comissões, a Topbar com a assessoria e o sino sem contador (Penpot 03, sem a F3)', async () => {
    mockApi(({ path }) => meOnly(path));
    const { container } = renderRoute({ url: '/cerimonialista' });
    expect(
      await within(await screen.findByRole('banner')).findByText('Prado Assessoria'),
    ).toBeInTheDocument();
    const nav = screen.getAllByRole('navigation', { name: 'Menu principal' })[0];
    expect(
      within(nav as HTMLElement)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Meus casamentos', 'Novo casamento', 'Link de indicação', 'Modelos']);
    expect(screen.getAllByRole('link', { name: 'Meus casamentos' })[0]).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByText('Comissões')).toBeNull();
    expect(screen.getByRole('button', { name: 'Notificações' })).toBeInTheDocument();
    await expectNoA11yViolations({ container });
  });

  it('o sino leva às Notificações da cerimonialista (decisão 254(2))', async () => {
    const user = userEvent.setup();
    mockApi(({ path }) => meOnly(path));
    const { router } = renderRoute({ url: '/cerimonialista' });
    await user.click(await screen.findByRole('button', { name: 'Notificações' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/cerimonialista/notificacoes'),
    );
  });

  it('o menu: a pessoa, "Cerimonialista · Prado Assessoria", Meu perfil, Configurações, Criar outro perfil e Sair (Voz)', async () => {
    const user = userEvent.setup();
    mockApi(({ path }) => meOnly(path));
    renderRoute({ url: '/cerimonialista' });
    const menu = await openMenu(user);
    expect(screen.getByText('Cerimonialista · Prado Assessoria')).toBeInTheDocument();
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Meu perfil', 'Configurações', 'Criar outro perfil Casal', 'Sair']);
  });

  it('Meu perfil, Configurações e Criar outro perfil levam às telas (RN08, RN09, RN11)', async () => {
    const user = userEvent.setup();
    mockApi(({ path }) => meOnly(path));
    const { router } = renderRoute({ url: '/cerimonialista' });
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Meu perfil' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cerimonialista/perfil'));
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Configurações' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/cerimonialista/configuracoes/acesso'),
    );
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /Criar outro perfil/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cadastro'));
  });

  it('com os dois perfis, só o Trocar de perfil, com o casal (RN08; Voz)', async () => {
    const user = userEvent.setup();
    mockApi(({ path }) =>
      meOnly(
        path,
        me({
          profiles: ['couple', 'planner'],
          memberships: [
            {
              weddingId: 'w1',
              role: 'owner',
              weddingName: 'Juliana & Tiago',
              eventDate: '2027-03-20',
              city: 'Valinhos',
              state: 'SP',
            },
          ],
        }),
      ),
    );
    const { router } = renderRoute({ url: '/cerimonialista' });
    const menu = await openMenu(user);
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Meu perfil', 'Configurações', 'Trocar de perfil Casal · Juliana & Tiago', 'Sair']);
    await user.click(screen.getByRole('menuitem', { name: /Trocar de perfil/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/perfis'));
  });

  it('o gate é o perfil que a conta tem: sem o de cerimonialista, vai ao casamento em /app (Colaboradora RN01)', async () => {
    mockApi(({ path }) => meOnly(path, me({ profiles: ['couple'], planner: null })));
    const { router } = renderRoute({ url: '/cerimonialista/perfil' });
    await waitFor(() => expect(router.state.location.pathname).not.toMatch(/^\/cerimonialista/));
    expect(screen.queryByText('Prado Assessoria')).toBeNull();
  });

  it('o perfil ativo de casal não fecha a Área: o gate não olha o perfil ativo (decisão 224)', async () => {
    mockApi(({ path }) =>
      meOnly(path, me({ activeProfile: 'couple', profiles: ['couple', 'planner'] })),
    );
    const { router } = renderRoute({ url: '/cerimonialista' });
    expect(
      await within(await screen.findByRole('banner')).findByText('Prado Assessoria'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/cerimonialista');
  });

  it('sem sessão, a Sessão expirada com a página no next (Login RN10)', async () => {
    mockApi(() => apiError({ status: 401, body: { error: 'SESSION_EXPIRED' } }));
    const { router } = renderRoute({ url: '/cerimonialista/perfil' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/sessao-expirada'));
    expect(router.state.location.search).toBe(
      `?next=${encodeURIComponent('/cerimonialista/perfil')}`,
    );
  });

  it('a falha do /me por rede: o aviso com o Tentar de novo (decisão 164)', async () => {
    mockApi(() => apiError({ status: 503, body: { error: 'UNAVAILABLE' } }));
    renderRoute({ url: '/cerimonialista' });
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });
});
