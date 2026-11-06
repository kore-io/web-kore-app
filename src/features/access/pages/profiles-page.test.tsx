import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';
import { redirectTo } from '../../../shared/browser/redirect';

vi.mock('../../../shared/browser/redirect', () => ({ redirectTo: vi.fn(), reloadPage: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const base = {
  user: { id: 'u1', name: 'Juliana Prado', email: 'juliana@prado.com.br', platformRole: 'none' },
  activeProfile: null,
  authenticatedAt: '2026-11-05T12:00:00Z',
  referrer: null,
};

const twoProfiles = {
  ...base,
  profiles: ['couple', 'planner'],
  lastProfileOnDevice: 'planner',
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
  planner: { organization: 'Prado Assessoria', weddingsCount: 12 },
};

type Request = { method: string; path: string; body: unknown };

function api({
  me,
  home = '/app',
  answer = () => undefined,
}: {
  me: Record<string, unknown> | Response;
  home?: string;
  answer?: (request: Request) => Response | undefined;
}) {
  const calls: Request[] = [];
  let activeProfile: string | null = null;
  mockApi((request) => {
    calls.push(request);
    const answered = answer(request);
    if (answered) return answered;
    if (request.path === '/v1/me') {
      return me instanceof Response ? me : Response.json({ ...me, activeProfile });
    }
    if (request.path === '/v1/me/active-profile') {
      const profile = (request.body as { profile: string }).profile;
      activeProfile = profile;
      return Response.json({ activeProfile: profile, home: profile === 'couple' ? '/app' : home });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const chosen = (calls: Request[]) =>
  calls.filter((call) => call.path === '/v1/me/active-profile').map((call) => call.body);

describe('Seleção de perfil (RN14 a RN16 do Login; decisões 152, 174(7) e 176)', () => {
  it('dois perfis: os cartões da Voz, o último usado em destaque, e o casal abre /app', async () => {
    const user = userEvent.setup();
    const calls = api({ me: twoProfiles });
    const { router } = renderRoute({ url: '/perfis' });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Com qual perfil você quer entrar?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Juliana, sua conta tem dois perfis. Você pode trocar depois pelo menu, sem sair.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Cerimonialista Prado Assessoria · 12 casamentos Último usado',
      }),
    ).toHaveClass('kore-profile-option--highlighted');
    await user.click(
      screen.getByRole('button', {
        name: 'Casamento Juliana & Tiago sáb., 20 de mar. de 2027 · Valinhos (SP)',
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(chosen(calls)).toEqual([{ profile: 'couple' }]);
  });

  it('cerimonialista na F0: vai ao destino do Fazer parceria (decisão 176(1))', async () => {
    const user = userEvent.setup();
    api({ me: twoProfiles, home: '/cerimonial' });
    renderRoute({ url: '/perfis' });
    await user.click(await screen.findByRole('button', { name: /^Cerimonialista/ }));
    await waitFor(() =>
      expect(redirectTo).toHaveBeenCalledWith({ url: 'https://kore.com.br/cerimonialistas' }),
    );
  });

  it('um perfil só: entra direto, sem a lista (RN14; decisão 176(2))', async () => {
    const calls = api({
      me: { ...twoProfiles, profiles: ['couple'], planner: null, lastProfileOnDevice: null },
    });
    const { router } = renderRoute({ url: '/perfis' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(chosen(calls)).toEqual([{ profile: 'couple' }]);
    expect(screen.queryByRole('heading', { name: 'Com qual perfil você quer entrar?' })).toBeNull();
  });

  it('sem perfil: Criar o site do casamento e Quero fazer parceria', async () => {
    const user = userEvent.setup();
    api({ me: { ...base, profiles: [], memberships: [], planner: null } });
    const { router } = renderRoute({ url: '/perfis' });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Como você quer usar o Kore?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Ainda não há nenhum perfil com juliana@prado.com.br. Escolha um para começar; dá para criar outro depois.',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Quero fazer parceria/ }));
    expect(redirectTo).toHaveBeenCalledWith({ url: 'https://kore.com.br/cerimonialistas' });
    await user.click(screen.getByRole('button', { name: /^Criar o site do casamento/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cadastro'));
  });

  it('a escolha falhou: o aviso genérico no Toast, e a pessoa fica na tela', async () => {
    const user = userEvent.setup();
    api({
      me: twoProfiles,
      answer: ({ path }) =>
        path === '/v1/me/active-profile'
          ? apiError({ status: 403, body: { error: 'PROFILE_NOT_OWNED' } })
          : undefined,
    });
    const { router } = renderRoute({ url: '/perfis' });
    await user.click(await screen.findByRole('button', { name: /^Casamento/ }));
    expect(
      await screen.findByText('Não foi possível continuar. Confira sua conexão e tente de novo.'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/perfis');
  });

  it('sem sessão: vai ao Entrar', async () => {
    api({ me: apiError({ status: 401, body: { error: 'SESSION_EXPIRED' } }) });
    const { router } = renderRoute({ url: '/perfis' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
  });

  it('o /me falhou: o aviso com o Tentar de novo (decisão 164)', async () => {
    api({ me: apiError({ status: 500, body: { error: 'x' } }) });
    renderRoute({ url: '/perfis' });
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });
});
