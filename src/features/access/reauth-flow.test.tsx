import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, mockApi, renderRoute } from '../../../tests/render-route';
import { REAUTH_STORAGE_KEY } from './reauth';

afterEach(() => {
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

const inAMinute = () => new Date(Date.now() + 60_000).toISOString();

type Profile = 'couple' | 'planner';

/** O /me de quem tem os dois perfis; a sessão nova nasce sem perfil ativo. */
const me = ({ activeProfile }: { activeProfile: Profile | null }) => ({
  user: { id: 'u1', name: 'Juliana Prado', email: 'juliana@exemplo.com', platformRole: 'none' },
  activeProfile,
  authenticatedAt: '2026-11-24T12:00:00Z',
  memberships: [
    {
      weddingId: 'w1',
      role: 'owner',
      weddingName: 'Juliana & Rui',
      eventDate: '2027-05-15',
      city: 'São Paulo',
      state: 'SP',
    },
  ],
  profiles: ['couple', 'planner'],
  lastProfileOnDevice: null,
  planner: { organization: 'Prado Assessoria', weddingsCount: 1 },
  referrer: null,
  plannerSignupEnabled: true,
});

/**
 * A API do teste: o login responde `next` (choose_profile, quem tem dois perfis), o /me
 * nasce sem perfil e passa ao perfil ativado pelo POST /v1/me/active-profile. As outras
 * leituras das telas ficam com o 404 (a tela mostra o aviso dela; o caminho fica).
 */
function api({ activation = 'ok' }: { activation?: 'ok' | 'fails' } = {}) {
  let activeProfile: Profile | null = null;
  const activations: unknown[] = [];
  const fetchMock = mockApi(({ method, path, body }) => {
    if (path === '/v1/auth/login-challenges')
      return Response.json(
        { email: 'juliana@exemplo.com', resendAvailableAt: inAMinute() },
        { status: 202 },
      );
    if (path === '/v1/auth/login-challenges/verify')
      return Response.json({
        user: { id: 'u1', email: 'juliana@exemplo.com', isNew: false },
        next: 'choose_profile',
      });
    if (path === '/v1/me/active-profile' && method === 'POST') {
      activations.push(body);
      if (activation === 'fails') return apiError({ status: 503, body: { error: 'UNAVAILABLE' } });
      activeProfile = (body as { profile: Profile }).profile;
      return Response.json({
        activeProfile,
        home: activeProfile === 'couple' ? '/app' : '/cerimonialista',
      });
    }
    if (path === '/v1/me') return Response.json(me({ activeProfile }));
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return { activations, fetchMock };
}

function remember({ path, profile }: { path: string; profile: Profile | null }) {
  window.sessionStorage.setItem(REAUTH_STORAGE_KEY, JSON.stringify({ path, profile }));
}

const NOTICE = 'Por segurança, entre de novo para cadastrar a chave.';

async function signInByCode({ path }: { path: string }) {
  const user = userEvent.setup();
  const view = renderRoute({
    url: `/entrar?next=${encodeURIComponent(path)}`,
    state: { notice: { kind: 'reauth', message: NOTICE } },
  });
  expect(screen.getByText(NOTICE)).toBeInTheDocument();
  await user.type(screen.getByRole('textbox', { name: 'E-⁠mail' }), 'juliana@exemplo.com');
  await user.click(screen.getByRole('button', { name: 'Receber código' }));
  await screen.findByRole('heading', { name: 'Confira seu e-⁠mail' });
  // O aviso da reentrada continua no passo do código.
  expect(screen.getByText(NOTICE)).toBeInTheDocument();
  await user.keyboard('481905');
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
  return view;
}

/** Espera a área montar com o perfil (o menu do usuário) e confere que o caminho ficou. */
async function expectSettledAt({
  router,
  path,
}: {
  router: ReturnType<typeof renderRoute>['router'];
  path: string;
}) {
  await screen.findByRole('button', { name: 'Menu do usuário' });
  await waitFor(() => expect(router.state.location.pathname).toBe(path));
  // Mais uma rodada: o guard da área não manda à Seleção de perfil depois de montar.
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(router.state.location.pathname).toBe(path);
}

describe('a reentrada do REAUTH_REQUIRED passa pelo guard da área (Retenção RN08)', () => {
  it('casal com dois perfis: ativa o casal e fica na tela de antes', async () => {
    const path = '/app/configuracoes/notificacoes';
    remember({ path, profile: 'couple' });
    const { activations } = api();
    const { router } = await signInByCode({ path });
    await expectSettledAt({ router, path });
    expect(activations).toEqual([{ profile: 'couple' }]);
    expect(window.sessionStorage.getItem(REAUTH_STORAGE_KEY)).toBeNull();
  });

  it('cerimonialista com dois perfis: ativa a cerimonialista e fica na tela de antes', async () => {
    const path = '/cerimonialista/link-de-indicacao';
    remember({ path, profile: 'planner' });
    const { activations } = api();
    const { router } = await signInByCode({ path });
    await expectSettledAt({ router, path });
    expect(activations).toEqual([{ profile: 'planner' }]);
  });

  it('pela volta do Google, do mesmo jeito', async () => {
    const path = '/app/configuracoes/notificacoes';
    remember({ path, profile: 'couple' });
    const { activations } = api();
    const { router } = renderRoute({
      url: `/entrar/google?step=choose_profile&next=${encodeURIComponent(path)}`,
    });
    await expectSettledAt({ router, path });
    expect(activations).toEqual([{ profile: 'couple' }]);
  });

  it('se a ativação falhar, segue o destino de sempre (a Seleção de perfil)', async () => {
    const path = '/app/configuracoes/notificacoes';
    remember({ path, profile: 'couple' });
    api({ activation: 'fails' });
    const { router } = await signInByCode({ path });
    await waitFor(() => expect(router.state.location.pathname).toBe('/perfis'));
  });

  it('sem a marca (um login comum com ?next=), a Seleção de perfil continua (RN14 do Login)', async () => {
    const { activations } = api();
    const { router } = await signInByCode({ path: '/app/configuracoes/notificacoes' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/perfis'));
    expect(activations).toEqual([]);
  });

  it('sem perfil guardado (nulo), volta à tela sem ativar perfil nenhum', async () => {
    const path = '/sessao-expirada';
    remember({ path, profile: null });
    const { activations } = api();
    const { router } = renderRoute({
      url: `/entrar/google?step=choose_profile&next=${encodeURIComponent(path)}`,
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(path));
    expect(activations).toEqual([]);
  });
});
