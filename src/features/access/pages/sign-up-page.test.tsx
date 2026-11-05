import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const noSession = () => apiError({ status: 401, body: { error: 'SESSION_EXPIRED' } });
const referral = (discountPercent: number | null) =>
  Response.json({
    code: 'juliana-prado',
    referrerName: 'Juliana Prado',
    kind: 'planner',
    discountPercent,
  });
const inAMinute = () => new Date(Date.now() + 60_000).toISOString();

describe('Cadastro ligado à API (decisão 165)', () => {
  it('?indicacao= guarda o código, sai da URL e mostra a caixa com o desconto', async () => {
    const paths: string[] = [];
    mockApi(({ path }) => {
      paths.push(path);
      return path === '/v1/referrals/juliana-prado' ? referral(10) : noSession();
    });
    const { router } = renderRoute({ url: '/cadastro?indicacao=juliana-prado' });
    expect(await screen.findByText('Indicação de Juliana Prado')).toBeInTheDocument();
    expect(
      screen.getByText('Vocês ganham 10% de desconto na ativação do site.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(JSON.parse(window.localStorage.getItem('kore.referral') ?? '{}')).toMatchObject({
      code: 'juliana-prado',
    });
  });

  it.each([
    ['desconto desligado (null)', () => referral(null)],
    [
      'código inexistente (404)',
      () => apiError({ status: 404, body: { error: 'REFERRAL_NOT_FOUND' } }),
    ],
  ])('%s: cadastro normal, sem a caixa', async (_, answer) => {
    mockApi(({ path }) => (path.startsWith('/v1/referrals/') ? answer() : noSession()));
    renderRoute({ url: '/cadastro?indicacao=juliana-prado' });
    expect(
      await screen.findByRole('heading', { name: 'Crie o site do casamento' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Indicação de/)).toBeNull());
  });

  it('pedir o código leva a origem referral com o código guardado (RN06, RN08)', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    mockApi(({ path, body }) => {
      if (path === '/v1/auth/login-challenges') {
        bodies.push(body);
        return Response.json(
          { email: 'ana@exemplo.com', resendAvailableAt: inAMinute() },
          { status: 202 },
        );
      }
      return path.startsWith('/v1/referrals/') ? referral(10) : noSession();
    });
    renderRoute({ url: '/cadastro?indicacao=juliana-prado' });
    await user.type(await screen.findByRole('textbox', { name: 'E-⁠mail' }), 'ana@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('heading', { name: 'Confira seu e-⁠mail' })).toBeInTheDocument();
    expect(bodies).toEqual([
      { email: 'ana@exemplo.com', origin: 'referral', originRef: 'juliana-prado' },
    ]);
  });

  it('sem indicação, a origem é couple_signup e não chama a rota da indicação', async () => {
    const user = userEvent.setup();
    const calls: { path: string; body: unknown }[] = [];
    mockApi(({ path, body }) => {
      calls.push({ path, body });
      return path === '/v1/auth/login-challenges'
        ? Response.json(
            { email: 'ana@exemplo.com', resendAvailableAt: inAMinute() },
            { status: 202 },
          )
        : noSession();
    });
    renderRoute({ url: '/cadastro' });
    await user.type(await screen.findByRole('textbox', { name: 'E-⁠mail' }), 'ana@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByRole('heading', { name: 'Confira seu e-⁠mail' });
    expect(calls.some((call) => call.path.startsWith('/v1/referrals/'))).toBe(false);
    expect(calls.find((call) => call.path === '/v1/auth/login-challenges')?.body).toEqual({
      email: 'ana@exemplo.com',
      origin: 'couple_signup',
    });
  });

  it('com sessão, vai direto aos Dados do casamento (decisão 165(3))', async () => {
    mockApi(() =>
      Response.json({
        user: { id: 'u1', name: null, email: 'ana@exemplo.com', platformRole: 'none' },
        activeProfile: null,
        authenticatedAt: '2026-11-05T12:00:00Z',
      }),
    );
    renderRoute({ url: '/cadastro' });
    expect(
      await screen.findByRole('heading', { name: 'Conte sobre o casamento' }),
    ).toBeInTheDocument();
  });

  it('o ?indicacao= vale em qualquer rota (o primeiro link vale)', async () => {
    mockApi(() => noSession());
    const { router } = renderRoute({ url: '/entrar?indicacao=lucas-andrade' });
    await waitFor(() => expect(router.state.location.search).toBe(''));
    renderRoute({ url: '/entrar?indicacao=juliana-prado' });
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem('kore.referral') ?? '{}')).toMatchObject({
        code: 'lucas-andrade',
      }),
    );
  });

  it.each([
    ['rede', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['5xx', () => apiError({ status: 503, body: { error: 'Service Unavailable' } })],
  ])(
    'com o /me falhando (%s), o aviso com o Tentar de novo, e não o login (decisão 164)',
    async (_, fail) => {
      const user = userEvent.setup();
      let meCalls = 0;
      mockApi(({ path }) => {
        if (path !== '/v1/me') return noSession();
        meCalls += 1;
        return meCalls === 1
          ? fail()
          : Response.json({
              user: { id: 'u1', name: null, email: 'ana@exemplo.com', platformRole: 'none' },
              activeProfile: null,
              authenticatedAt: '2026-11-05T12:00:00Z',
            });
      });
      renderRoute({ url: '/cadastro' });
      expect(await screen.findByText('Não foi possível continuar')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Crie o site do casamento' })).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
      expect(
        await screen.findByRole('heading', { name: 'Conte sobre o casamento' }),
      ).toBeInTheDocument();
    },
  );
});
