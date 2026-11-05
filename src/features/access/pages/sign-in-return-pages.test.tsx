import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';
import { redirectTo } from '../../../shared/browser/redirect';

vi.mock('../../../shared/browser/redirect', () => ({ redirectTo: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('Botão do e-\u2060mail (/entrar/confirmar, decisões 139 e 157(5))', () => {
  it('confirma o token uma vez e segue o next', async () => {
    const fetchMock = mockApi(() =>
      Response.json({
        user: { id: 'u1', email: 'a@exemplo.com', isNew: true },
        next: 'couple_signup',
      }),
    );
    const { router } = renderRoute({ url: '/entrar/confirmar?token=abcdefghijklmnopqrstuvwxyz' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/cadastro'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      token: 'abcdefghijklmnopqrstuvwxyz',
    });
  });

  it('token vencido volta ao Entrar com o aviso', async () => {
    mockApi(() => apiError({ status: 410, body: { error: 'CHALLENGE_EXPIRED' } }));
    const { router } = renderRoute({ url: '/entrar/confirmar?token=abcdefghijklmnopqrstuvwxyz' });
    expect(await screen.findByText('Esse código não vale mais')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/entrar');
  });

  it('sem token, volta ao Entrar', async () => {
    const fetchMock = mockApi(() => Response.json({}));
    const { router } = renderRoute({ url: '/entrar/confirmar' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Volta do Google (/entrar/google, decisão 147)', () => {
  it('step home com next segue para a página de volta', async () => {
    const { router } = renderRoute({ url: '/entrar/google?step=home&next=/perfis' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/perfis'));
  });

  it('step invite volta ao convite guardado (decisão 142)', async () => {
    window.localStorage.setItem('kore.inviteToken', 'tok123');
    const { router } = renderRoute({ url: '/entrar/google?step=invite' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/convite/tok123'));
  });

  it('planner_signup vai à página de parceria na F0 (decisão 157(4))', async () => {
    renderRoute({ url: '/entrar/google?step=planner_signup' });
    await waitFor(() =>
      expect(redirectTo).toHaveBeenCalledWith({ url: 'https://kore.com.br/cerimonialistas' }),
    );
  });

  it('sem step válido, volta ao Entrar com o erro do Google', async () => {
    const { router } = renderRoute({ url: '/entrar/google?step=xyz' });
    expect(await screen.findByText('Não foi possível entrar com o Google')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/entrar');
  });
});
