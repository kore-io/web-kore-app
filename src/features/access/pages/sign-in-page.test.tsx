import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';
import { redirectTo } from '../../../shared/browser/redirect';

vi.mock('../../../shared/browser/redirect', () => ({ redirectTo: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const inAMinute = () => new Date(Date.now() + 60_000).toISOString();

async function askCode(user: ReturnType<typeof userEvent.setup>, email = 'ana@exemplo.com') {
  await user.type(screen.getByRole('textbox', { name: 'E-\u2060mail' }), email);
  await user.click(screen.getByRole('button', { name: 'Receber código' }));
}

describe('Entrar ligado à API (Login sem senha e sessão; decisões 150, 151 e 157)', () => {
  it('e-\u2060mail inválido mostra o erro do campo e não chama a API', async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi(() => Response.json({}));
    renderRoute({ url: '/entrar' });
    await askCode(user, 'ana@');
    expect(screen.getByText('Informe um e-\u2060mail válido.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pede o código com a origem, confirma e volta ao ?next= (RN06 e RN10)', async () => {
    const user = userEvent.setup();
    const requests: unknown[] = [];
    mockApi(({ path, body }) => {
      requests.push({ path, body });
      if (path === '/v1/auth/login-challenges')
        return Response.json(
          { email: 'ana@exemplo.com', resendAvailableAt: inAMinute() },
          { status: 202 },
        );
      return Response.json({
        user: { id: 'u1', email: 'ana@exemplo.com', isNew: false },
        next: 'home',
      });
    });
    const { router } = renderRoute({ url: '/entrar?next=/perfis' });
    await askCode(user);
    expect(
      await screen.findByRole('heading', { name: 'Confira seu e-\u2060mail' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reenviar código em (1:00|0:5\d)/ })).toBeDisabled();
    await user.keyboard('481905');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/perfis'));
    expect(requests).toEqual([
      { path: '/v1/auth/login-challenges', body: { email: 'ana@exemplo.com', origin: 'none' } },
      {
        path: '/v1/auth/login-challenges/verify',
        body: { email: 'ana@exemplo.com', code: '481905' },
      },
    ]);
  });

  it('a origem vem da navegação (convite, cadastro)', async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi(() =>
      Response.json({ email: 'a@exemplo.com', resendAvailableAt: inAMinute() }, { status: 202 }),
    );
    renderRoute({ url: '/entrar', state: { origin: 'referral', originRef: 'LUCAS10' } });
    await askCode(user, 'a@exemplo.com');
    await screen.findByRole('heading', { name: 'Confira seu e-\u2060mail' });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      email: 'a@exemplo.com',
      origin: 'referral',
      originRef: 'LUCAS10',
    });
  });

  it('código errado mostra as tentativas e marca as casas', async () => {
    const user = userEvent.setup();
    mockApi(({ path }) =>
      path === '/v1/auth/login-challenges'
        ? Response.json({ email: 'a@exemplo.com', resendAvailableAt: inAMinute() }, { status: 202 })
        : apiError({ status: 401, body: { error: 'INVALID_CODE', attemptsLeft: 1 } }),
    );
    renderRoute({ url: '/entrar' });
    await askCode(user);
    await screen.findByRole('heading', { name: 'Confira seu e-\u2060mail' });
    await user.keyboard('000000');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText(/Você ainda tem 1 tentativa;/)).toBeInTheDocument();
    // Decisão 161 (Penpot, Código incorreto): os números ficam e o Entrar segue habilitado.
    expect(screen.getByRole('textbox', { name: 'Número 6 de 6' })).toHaveValue('0');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('5 erros com código novo: avisa e reinicia a contagem (RN05)', async () => {
    const user = userEvent.setup();
    mockApi(({ path }) =>
      path === '/v1/auth/login-challenges'
        ? Response.json(
            { email: 'a@exemplo.com', resendAvailableAt: new Date().toISOString() },
            { status: 202 },
          )
        : apiError({ status: 410, body: { error: 'CHALLENGE_LOCKED', newCodeSent: true } }),
    );
    renderRoute({ url: '/entrar' });
    await askCode(user);
    await screen.findByRole('heading', { name: 'Confira seu e-\u2060mail' });
    await user.keyboard('000000');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Pedimos um código novo para você')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reenviar código em/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
  });

  it('muitos pedidos (RN04) e limite por IP (decisão 157(2)) viram avisos', async () => {
    const user = userEvent.setup();
    let calls = 0;
    mockApi(() => {
      calls += 1;
      return calls === 1
        ? apiError({ status: 429, body: { error: 'TOO_MANY_REQUESTS', retryAfterMinutes: 0.2 } })
        : apiError({ status: 429, body: { error: 'RATE_LIMITED' } });
    });
    renderRoute({ url: '/entrar' });
    await askCode(user);
    expect(await screen.findByText('Tente de novo em 1 minuto.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Receber código' }));
    expect(await screen.findByText('Espere um pouco e tente de novo.')).toBeInTheDocument();
  });

  it('pedido cedo demais (TOO_SOON) segue para o código com a contagem', async () => {
    const user = userEvent.setup();
    mockApi(() =>
      apiError({ status: 429, body: { error: 'TOO_SOON', resendAvailableAt: inAMinute() } }),
    );
    renderRoute({ url: '/entrar' });
    await askCode(user);
    expect(
      await screen.findByRole('heading', { name: 'Confira seu e-\u2060mail' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reenviar código em/ })).toBeDisabled();
  });

  it('erro de rede vira o aviso genérico (decisão 157(3))', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderRoute({ url: '/entrar' });
    await askCode(user);
    expect(await screen.findByText('Não foi possível continuar')).toBeInTheDocument();
  });

  it('reenviar manda outro código e avisa no Toast (decisão 151)', async () => {
    const user = userEvent.setup();
    mockApi(() =>
      Response.json(
        { email: 'ana@exemplo.com', resendAvailableAt: new Date().toISOString() },
        { status: 202 },
      ),
    );
    renderRoute({ url: '/entrar' });
    await askCode(user);
    await user.click(await screen.findByRole('button', { name: 'Reenviar código' }));
    expect(
      await screen.findByText('Enviamos um código novo para ana@exemplo.com.'),
    ).toBeInTheDocument();
  });

  it('?error= do Google mostra o aviso e sai da URL (decisão 150(3))', async () => {
    mockApi(() => Response.json({}));
    const { router } = renderRoute({ url: '/entrar?error=google_unverified&next=/app' });
    expect(screen.getByText('O Google não confirmou seu e-\u2060mail')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe('?next=%2Fapp'));
  });

  it('Continuar com Google vai ao início do login na API, com a origem e a volta', async () => {
    const user = userEvent.setup();
    renderRoute({ url: '/entrar?next=/app/convidados' });
    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }));
    expect(redirectTo).toHaveBeenCalledWith({
      url: 'http://api.test/v1/auth/google?origin=none&next=%2Fapp%2Fconvidados',
    });
  });

  it('?next= de fora do app é ignorado (decisão 136(7))', async () => {
    const user = userEvent.setup();
    renderRoute({ url: '/entrar?next=//malicioso.com' });
    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }));
    expect(redirectTo).toHaveBeenCalledWith({ url: 'http://api.test/v1/auth/google?origin=none' });
  });

  it('Sessão expirada abre o Entrar com o aviso (RN10)', () => {
    renderRoute({ url: '/sessao-expirada?next=/app' });
    expect(screen.getByText('Sua sessão terminou')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Entre no Kore' })).toBeInTheDocument();
  });
});
