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
  identities: [{ provider: 'email' }, { provider: 'google' }],
  ...overrides,
});

function api({
  meBody = me(),
  logoutAll = () => new Response(null, { status: 204 }),
}: {
  meBody?: Record<string, unknown>;
  logoutAll?: () => Response;
} = {}) {
  const calls: string[] = [];
  mockApi(({ method, path }) => {
    if (path === '/v1/me') return Response.json(meBody);
    if (method === 'POST' && path === '/v1/auth/logout-all') {
      calls.push(path);
      return logoutAll();
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

describe('Configurações da cerimonialista (Cadastro e perfil RN11; Penpot 15)', () => {
  it('abre em Acesso, com as abas Acesso e Notificações', async () => {
    api();
    const { router } = renderRoute({ url: '/cerimonialista/configuracoes' });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Configurações' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/cerimonialista/configuracoes/acesso'),
    );
    const tabs = screen.getByRole('navigation', { name: 'Configurações' });
    await waitFor(() =>
      expect(within(tabs).getByRole('link', { name: 'Acesso' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
    expect(within(tabs).getByRole('link', { name: 'Notificações' })).toHaveAttribute(
      'href',
      '/cerimonialista/configuracoes/notificacoes',
    );
  });

  it('Formas de entrar: Google e E-mail com código, com o selo Conectado (decisão 254(1))', async () => {
    api();
    const { container } = renderRoute({ url: '/cerimonialista/configuracoes/acesso' });
    const section = await screen.findByRole('region', { name: 'Formas de entrar' });
    expect(
      within(section)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['GoogleConectado', 'E-⁠mail com códigoConectado']);
    // Sem os Aparelhos conectados, que ficam fora da F6.
    expect(screen.queryByText('Aparelhos conectados')).toBeNull();
    await expectNoA11yViolations({ container });
  });

  it('só com o e-mail, só a linha do E-mail com código', async () => {
    api({ meBody: me({ identities: [{ provider: 'email' }] }) });
    renderRoute({ url: '/cerimonialista/configuracoes/acesso' });
    const section = await screen.findByRole('region', { name: 'Formas de entrar' });
    expect(within(section).getAllByRole('listitem')).toHaveLength(1);
    expect(within(section).queryByText('Google')).toBeNull();
  });

  it('Sair de todos os aparelhos: a confirmação da Voz, o POST e o Entrar (Login RN09)', async () => {
    const user = userEvent.setup();
    const calls = api();
    const { router } = renderRoute({ url: '/cerimonialista/configuracoes/acesso' });
    await user.click(await screen.findByRole('button', { name: 'Sair de todos os aparelhos' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Sair de todos os aparelhos?',
    });
    expect(
      within(dialog).getByText(
        'Você vai precisar entrar de novo em cada aparelho, inclusive neste.',
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Sair de todos' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(calls).toEqual(['/v1/auth/logout-all']);
  });

  it('Cancelar fecha a confirmação sem sair', async () => {
    const user = userEvent.setup();
    const calls = api();
    renderRoute({ url: '/cerimonialista/configuracoes/acesso' });
    await user.click(await screen.findByRole('button', { name: 'Sair de todos os aparelhos' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(calls).toEqual([]);
  });

  it('a falha do POST por rede: o aviso genérico, e a pessoa fica', async () => {
    const user = userEvent.setup();
    api({ logoutAll: () => apiError({ status: 503, body: { error: 'UNAVAILABLE' } }) });
    const { router } = renderRoute({ url: '/cerimonialista/configuracoes/acesso' });
    await user.click(await screen.findByRole('button', { name: 'Sair de todos os aparelhos' }));
    await user.click(await screen.findByRole('button', { name: 'Sair de todos' }));
    const region = screen.getByRole('region', { name: /^Avisos/ });
    expect(await within(region).findByText(/^Não foi possível continuar/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/cerimonialista/configuracoes/acesso');
  });
});
