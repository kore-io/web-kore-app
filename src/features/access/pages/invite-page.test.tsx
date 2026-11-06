import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

vi.mock('../../../shared/browser/redirect', () => ({ redirectTo: vi.fn(), reloadPage: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const me = (email = 'marcos.rocha@gmail.com', name: string | null = 'Marcos Rocha') => ({
  user: { id: 'u2', name, email, platformRole: 'none' },
  activeProfile: null,
  authenticatedAt: '2026-11-05T12:00:00Z',
});

const wedding = {
  names: 'Ana & Marcos',
  eventDate: '2026-11-14',
  city: 'Campinas',
  state: 'SP',
};

const partnerInvite = {
  kind: 'partner',
  email: 'marcos.rocha@gmail.com',
  invitedBy: { name: 'Ana', role: 'owner' },
  wedding: { ...wedding, partnerTitleNeeded: false },
  sessionEmailMismatch: false,
};

const coupleInvite = {
  kind: 'couple',
  email: 'ana.moreira@gmail.com',
  invitedBy: { name: 'Prado Assessoria', role: 'planner' },
  wedding: { ...wedding, partnerNames: ['Ana', 'Marcos'] },
  sitePreview: null,
  referrer: { name: 'Juliana Prado', discountPercent: 10 },
  sessionEmailMismatch: false,
};

const plannerInvite = {
  kind: 'planner',
  email: 'juliana@prado.com.br',
  invitedBy: { name: 'Ana', role: 'owner' },
  wedding,
  sessionEmailMismatch: false,
  needsName: true,
};

type Request = { method: string; path: string; body: unknown };

/**
 * A API do convite: o /me (com ou sem sessão), o GET do convite e as respostas do aceite e
 * da recusa. Guarda as chamadas.
 */
function api({
  session,
  invitation,
  answer = () => undefined,
}: {
  session: ReturnType<typeof me> | null;
  invitation: Record<string, unknown> | Response;
  answer?: (request: Request) => Response | undefined;
}) {
  const calls: Request[] = [];
  let activeProfile: string | null = null;
  mockApi((request) => {
    calls.push(request);
    const answered = answer(request);
    if (answered) return answered;
    if (request.path === '/v1/me') {
      return session
        ? Response.json({ ...session, activeProfile })
        : apiError({ status: 401, body: { error: 'SESSION_EXPIRED' } });
    }
    if (request.path === '/v1/access-invitations/tk1') {
      return invitation instanceof Response ? invitation : Response.json(invitation);
    }
    if (request.path === '/v1/access-invitations/tk1/accept') {
      // Decisão 178: o aceite de dono passa a sessão ao perfil de casal.
      if ((invitation as { kind?: string }).kind !== 'planner') activeProfile = 'couple';
      return Response.json({
        weddingId: 'w1',
        role: (invitation as { kind?: string }).kind === 'planner' ? 'collaborator' : 'owner',
        weddingStatus: 'draft',
        attributedToMe: false,
      });
    }
    if (request.path === '/v1/me/active-profile') {
      activeProfile = 'couple';
      return Response.json({ activeProfile: 'couple', home: '/app' });
    }
    if (request.path === '/v1/access-invitations/tk1/decline') {
      return new Response(null, { status: 204 });
    }
    if (request.path === '/v1/auth/login-challenges') {
      return Response.json(
        { email: 'marcos.rocha@gmail.com', resendAvailableAt: '2026-11-05T12:01:00Z' },
        { status: 202 },
      );
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const accepted = (calls: Request[]) =>
  calls.filter((call) => call.path === '/v1/access-invitations/tk1/accept');

describe('Convite do parceiro (RN06 a RN08; decisões 156, 172 e 174)', () => {
  it('sem sessão: guarda o token e entra pelo e-⁠mail com a origem do convite', async () => {
    const user = userEvent.setup();
    const calls = api({ session: null, invitation: partnerInvite });
    renderRoute({ url: '/convite/tk1' });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ana convidou você para o casamento' }),
    ).toBeInTheDocument();
    expect(screen.getByText('sáb., 14 de nov. de 2026 · Campinas (SP)')).toBeInTheDocument();
    expect(window.localStorage.getItem('kore.inviteToken')).toBe('tk1');
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));
    await screen.findByRole('heading', { level: 1, name: 'Confira seu e-\u2060mail' });
    expect(calls.find((call) => call.path === '/v1/auth/login-challenges')?.body).toMatchObject({
      email: 'marcos.rocha@gmail.com',
      origin: 'invite',
    });
    expect(window.sessionStorage.getItem('kore.inviteAccepting')).toBe('tk1');
  });

  it('com sessão: aceita e abre o casamento, já no perfil de casal (decisão 178)', async () => {
    const user = userEvent.setup();
    const calls = api({ session: me(), invitation: partnerInvite });
    const { router } = renderRoute({ url: '/convite/tk1' });
    await user.click(await screen.findByRole('button', { name: 'Aceitar convite' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(accepted(calls)[0]?.body).toEqual({ confirmOtherAccount: false });
    expect(calls.some((call) => call.path === '/v1/me/active-profile')).toBe(false);
    expect(window.localStorage.getItem('kore.inviteToken')).toBeNull();
  });

  it('título do noivo livre nulo: pergunta "Você é o noivo ou a noiva?" (172(2))', async () => {
    const user = userEvent.setup();
    const calls = api({
      session: me(),
      invitation: { ...partnerInvite, wedding: { ...wedding, partnerTitleNeeded: true } },
    });
    const { router } = renderRoute({ url: '/convite/tk1' });
    await user.click(await screen.findByRole('button', { name: 'Aceitar convite' }));
    await screen.findByRole('heading', { level: 1, name: 'Você é o noivo ou a noiva?' });
    expect(accepted(calls)).toHaveLength(0);
    await user.click(screen.getByRole('radio', { name: 'Noivo' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(accepted(calls)[0]?.body).toEqual({ confirmOtherAccount: false, myTitle: 'groom' });
  });

  it('volta do login com outro e-⁠mail: Outra conta e o aceite confirmado (RN07)', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem('kore.inviteAccepting', 'tk1');
    const calls = api({
      session: me('marcos.vr@hotmail.com'),
      invitation: { ...partnerInvite, sessionEmailMismatch: true },
    });
    const { router } = renderRoute({ url: '/convite/tk1' });
    expect(
      await screen.findByText(
        'O convite foi enviado para marcos.rocha@gmail.com, mas você entrou como marcos.vr@hotmail.com.',
      ),
    ).toBeInTheDocument();
    expect(accepted(calls)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Sim, usar marcos.vr@hotmail.com' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(accepted(calls)[0]?.body).toEqual({ confirmOtherAccount: true });
  });

  it('volta do login com o mesmo e-\u2060mail: o aceite continua sozinho (decisão 142)', async () => {
    window.sessionStorage.setItem('kore.inviteAccepting', 'tk1');
    const calls = api({ session: me(), invitation: partnerInvite });
    const { router } = renderRoute({ url: '/convite/tk1' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(accepted(calls)).toHaveLength(1);
    expect(window.sessionStorage.getItem('kore.inviteAccepting')).toBeNull();
  });

  it('Outra conta → Entrar com outra conta: sai e volta ao Entrar com a origem do convite', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem('kore.inviteAccepting', 'tk1');
    const calls = api({
      session: me('marcos.vr@hotmail.com'),
      invitation: { ...partnerInvite, sessionEmailMismatch: true },
      answer: ({ path }) =>
        path === '/v1/auth/logout' ? new Response(null, { status: 204 }) : undefined,
    });
    const { router } = renderRoute({ url: '/convite/tk1' });
    await user.click(await screen.findByRole('button', { name: 'Entrar com outra conta' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(router.state.location.state).toEqual({ origin: 'invite' });
    expect(calls.some((call) => call.path === '/v1/auth/logout')).toBe(true);
    expect(window.localStorage.getItem('kore.inviteToken')).toBe('tk1');
    expect(window.sessionStorage.getItem('kore.inviteAccepting')).toBe('tk1');
  });

  it('recusar sem sessão: avisa e vai ao Entrar (RN11; decisão 174(3))', async () => {
    const user = userEvent.setup();
    const calls = api({ session: null, invitation: partnerInvite });
    const { router } = renderRoute({ url: '/convite/tk1' });
    await user.click(await screen.findByRole('button', { name: 'Recusar convite' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(await screen.findByText('Convite recusado.')).toBeInTheDocument();
    expect(calls.some((call) => call.path === '/v1/access-invitations/tk1/decline')).toBe(true);
    expect(window.localStorage.getItem('kore.inviteToken')).toBeNull();
  });
});

describe('Convite do casal (RN09; decisões 172(1), 173 e 174)', () => {
  it('com sessão: Aceitar e virar dono → Quem é você? → aceite com o nome e o título', async () => {
    const user = userEvent.setup();
    const calls = api({ session: me('ana.moreira@gmail.com', null), invitation: coupleInvite });
    const { router } = renderRoute({ url: '/convite/tk1' });
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Prado Assessoria preparou o site do casamento de vocês',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('14 de novembro de 2026 · Campinas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver o site completo' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Aceitar e virar dono' }));
    await screen.findByRole('heading', { level: 1, name: 'Quem é você?' });
    await user.click(screen.getByRole('radio', { name: 'Ana' }));
    await user.click(screen.getByRole('radio', { name: 'Noiva' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(accepted(calls)[0]?.body).toEqual({
      confirmOtherAccount: false,
      partnerIndex: 1,
      myTitle: 'bride',
    });
  });

  it('sem sessão: Aceitar leva ao Entrar com a origem do convite, e o aceite continua', async () => {
    const user = userEvent.setup();
    api({ session: null, invitation: coupleInvite });
    const { router } = renderRoute({ url: '/convite/tk1' });
    await user.click(await screen.findByRole('button', { name: 'Aceitar e virar dono' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(router.state.location.state).toEqual({ origin: 'invite' });
    expect(window.sessionStorage.getItem('kore.inviteAccepting')).toBe('tk1');
  });

  it('dona de outro casamento: Você já tem um casamento (172(3) revista)', async () => {
    const user = userEvent.setup();
    api({
      session: me('ana.moreira@gmail.com'),
      invitation: coupleInvite,
      answer: ({ path }) =>
        path.endsWith('/accept')
          ? apiError({ status: 409, body: { error: 'ALREADY_OWNER', weddingId: 'w9' } })
          : undefined,
    });
    renderRoute({ url: '/convite/tk1' });
    await user.click(await screen.findByRole('button', { name: 'Aceitar e virar dono' }));
    await user.click(await screen.findByRole('radio', { name: 'Ana' }));
    await user.click(screen.getByRole('radio', { name: 'Noiva' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Você já tem um casamento no Kore.' }),
    ).toBeInTheDocument();
  });

  it('já faz parte deste casamento: passa ao perfil de casal e abre (ALREADY_MEMBER)', async () => {
    const user = userEvent.setup();
    const calls = api({
      session: me('ana.moreira@gmail.com'),
      invitation: coupleInvite,
      answer: ({ path }) =>
        path.endsWith('/accept')
          ? apiError({ status: 409, body: { error: 'ALREADY_MEMBER' } })
          : undefined,
    });
    const { router } = renderRoute({ url: '/convite/tk1' });
    await user.click(await screen.findByRole('button', { name: 'Aceitar e virar dono' }));
    await user.click(await screen.findByRole('radio', { name: 'Marcos' }));
    await user.click(screen.getByRole('radio', { name: 'Noivo' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(calls.find((call) => call.path === '/v1/me/active-profile')?.body).toEqual({
      profile: 'couple',
    });
  });
});

describe('Convite do cerimonialista (RN10; decisões 168(4) e 174(6))', () => {
  it('sem nome na conta: pede o Seu nome, aceita e vai à Seleção de perfil', async () => {
    const user = userEvent.setup();
    const calls = api({ session: me('juliana@prado.com.br', null), invitation: plannerInvite });
    const { router } = renderRoute({ url: '/convite/tk1' });
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Ana e Marcos convidaram você como cerimonialista',
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));
    expect(screen.getByRole('textbox', { name: 'Seu nome' })).toHaveAccessibleDescription(
      'Informe seu nome.',
    );
    expect(accepted(calls)).toHaveLength(0);
    await user.type(screen.getByRole('textbox', { name: 'Seu nome' }), 'Juliana Prado');
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/perfis'));
    expect(accepted(calls)[0]?.body).toEqual({
      confirmOtherAccount: false,
      name: 'Juliana Prado',
    });
  });
});

describe('Convite que não vale e erros (RN12)', () => {
  it('410 no GET: Convite inválido, sem dados do casamento', async () => {
    api({
      session: null,
      invitation: apiError({ status: 410, body: { error: 'INVITATION_INVALID', reason: 'used' } }),
    });
    renderRoute({ url: '/convite/tk1' });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Este convite não vale mais' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Ana & Marcos')).toBeNull();
  });

  it('o casamento já tem 2 donos no aceite: Convite inválido (decisão 174(4))', async () => {
    const user = userEvent.setup();
    api({
      session: me(),
      invitation: partnerInvite,
      answer: ({ path }) =>
        path.endsWith('/accept')
          ? apiError({ status: 409, body: { error: 'OWNERS_FULL' } })
          : undefined,
    });
    renderRoute({ url: '/convite/tk1' });
    await user.click(await screen.findByRole('button', { name: 'Aceitar convite' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Este convite não vale mais' }),
    ).toBeInTheDocument();
  });

  it('vendedor no convite do cerimonialista: Convite inválido (decisão 175)', async () => {
    const user = userEvent.setup();
    api({
      session: me('lucas@kore.com.br', 'Lucas Mendes'),
      invitation: { ...plannerInvite, needsName: false },
      answer: ({ path }) =>
        path.endsWith('/accept')
          ? apiError({ status: 409, body: { error: 'SELLER_CANNOT_BE_PLANNER' } })
          : undefined,
    });
    renderRoute({ url: '/convite/tk1' });
    await user.click(await screen.findByRole('button', { name: 'Aceitar convite' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Este convite não vale mais' }),
    ).toBeInTheDocument();
  });

  it('o GET falhou (rede ou 5xx): o aviso com o Tentar de novo (decisão 164)', async () => {
    api({ session: null, invitation: apiError({ status: 500, body: { error: 'x' } }) });
    renderRoute({ url: '/convite/tk1' });
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });
});
