import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';
import { reloadPage } from '../../../shared/browser/redirect';

vi.mock('../../../shared/browser/redirect', () => ({ redirectTo: vi.fn(), reloadPage: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.localStorage.clear();
});

const meBody = {
  user: { id: 'u1', name: null, email: 'ana@exemplo.com', platformRole: 'none' },
  activeProfile: null,
  authenticatedAt: '2026-11-05T12:00:00Z',
};

type Answer = (request: { method: string; path: string; body: unknown }) => Response | undefined;

/** /me com sessão; disponibilidade e criação pelo `answer` de cada teste. */
function api(answer: Answer) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  mockApi((request) => {
    calls.push(request);
    // O /me demora como na rede: assim aparece se a tela perde o estado ao reler a sessão.
    return (
      answer(request) ??
      new Promise<Response>((resolve) => setTimeout(() => resolve(Response.json(meBody)), 30))
    );
  });
  return calls;
}

const available = ({ path }: { path: string }) =>
  path.startsWith('/v1/weddings/slug-availability')
    ? Response.json({
        slug: new URLSearchParams(path.split('?')[1]).get('slug'),
        available: true,
        reason: null,
        suggestion: null,
      })
    : undefined;

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole('textbox', { name: 'Seu nome' }), 'Ana Beatriz');
  await user.click(screen.getByRole('radio', { name: 'Noiva' }));
  await user.type(
    screen.getByRole('textbox', { name: 'Com quem você vai casar?' }),
    'Marcos Rocha',
  );
  await user.type(screen.getByRole('textbox', { name: 'Cidade' }), 'Campinas');
  await user.selectOptions(screen.getByRole('combobox', { name: 'UF' }), 'SP');
}

describe('Dados do casamento ligados à API (decisões 155, 166 e 169)', () => {
  it('sugere o endereço dos nomes, checa a disponibilidade e só então habilita (RN04, RN05)', async () => {
    const user = userEvent.setup();
    const calls = api(available);
    renderRoute({ url: '/cadastro' });
    await fillForm(user);
    expect(screen.getByRole('textbox', { name: 'Endereço do site' })).toHaveValue('ana-e-marcos');
    expect(await screen.findByText('kore.com.br/ana-e-marcos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar nosso site' })).toBeEnabled();
    expect(
      calls.some((call) => call.path === '/v1/weddings/slug-availability?slug=ana-e-marcos'),
    ).toBe(true);
  });

  it('endereço em uso: a sugestão e o botão desabilitado; a pessoa pode trocar', async () => {
    const user = userEvent.setup();
    api(({ path }) =>
      path === '/v1/weddings/slug-availability?slug=ana-e-marcos'
        ? Response.json({
            slug: 'ana-e-marcos',
            available: false,
            reason: 'taken',
            suggestion: 'ana-e-marcos-2',
          })
        : available({ path }),
    );
    renderRoute({ url: '/cadastro' });
    await fillForm(user);
    const slug = screen.getByRole('textbox', { name: 'Endereço do site' });
    await waitFor(() =>
      expect(slug).toHaveAccessibleDescription(
        'kore.com.br/ana-e-marcos já está em uso. Que tal kore.com.br/ana-e-marcos-2?',
      ),
    );
    expect(screen.getByRole('button', { name: 'Criar nosso site' })).toBeDisabled();
    await user.clear(slug);
    await user.type(slug, 'ana-e-marcos-2');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Criar nosso site' })).toBeEnabled(),
    );
  });

  it('endereço fora do formato: o erro da 155, sem chamar a API', async () => {
    const user = userEvent.setup();
    const calls = api(available);
    renderRoute({ url: '/cadastro' });
    const slug = await screen.findByRole('textbox', { name: 'Endereço do site' });
    await user.type(slug, 'Ana_Marcos');
    expect(slug).toHaveAccessibleDescription('Use só letras minúsculas, números e hífen.');
    expect(calls.some((call) => call.path.includes('slug=Ana_Marcos'))).toBe(false);
  });

  it('cria o casamento com os termos, a indicação e a origem, e oferece convidar o parceiro (RN10)', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      'kore.referral',
      JSON.stringify({ code: 'juliana-prado', savedAt: new Date().toISOString() }),
    );
    let created: unknown;
    api((request) => {
      if (request.method === 'POST' && request.path === '/v1/weddings') {
        created = request.body;
        return Response.json(
          {
            weddingId: 'w1',
            slug: 'ana-e-marcos',
            status: 'draft',
            timezone: 'America/Sao_Paulo',
            referrer: null,
          },
          { status: 201 },
        );
      }
      return request.path.startsWith('/v1/referrals/')
        ? apiError({ status: 404, body: { error: 'REFERRAL_NOT_FOUND' } })
        : available(request);
    });
    const { router } = renderRoute({ url: '/cadastro' });
    await fillForm(user);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Criar nosso site' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Criar nosso site' }));
    // O primeiro nome; com a rota de convites, o envio aparece (RN10).
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Convide Marcos' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar convite' })).toBeInTheDocument();
    expect(created).toEqual({
      myName: 'Ana Beatriz',
      myTitle: 'bride',
      partnerName: 'Marcos Rocha',
      city: 'Campinas',
      state: 'SP',
      slug: 'ana-e-marcos',
      referralCode: 'juliana-prado',
      termsVersion: '2026-09',
      signupSource: 'direct',
    });
    await user.click(screen.getByRole('button', { name: 'Fazer isso depois' }));
    await waitFor(() => expect(router.state.location.pathname).not.toBe('/cadastro'));
  });

  it('campos obrigatórios em branco: os erros da 155, sem enviar', async () => {
    const user = userEvent.setup();
    const calls = api(available);
    renderRoute({ url: '/cadastro' });
    const slug = await screen.findByRole('textbox', { name: 'Endereço do site' });
    await user.type(slug, 'ana-e-marcos');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Criar nosso site' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Criar nosso site' }));
    expect(screen.getByRole('textbox', { name: 'Seu nome' })).toHaveAccessibleDescription(
      'Informe seu nome.',
    );
    expect(screen.getByText('Escolha noivo ou noiva.')).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'POST' && call.path === '/v1/weddings')).toBe(
      false,
    );
  });

  async function submitWith(answer: Response) {
    const user = userEvent.setup();
    api((request) =>
      request.method === 'POST' && request.path === '/v1/weddings' ? answer : available(request),
    );
    const view = renderRoute({ url: '/cadastro' });
    await fillForm(user);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Criar nosso site' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Criar nosso site' }));
    return { user, ...view };
  }

  it('409 SLUG_UNAVAILABLE no envio: Endereço em uso com a sugestão', async () => {
    await submitWith(
      apiError({
        status: 409,
        body: { error: 'SLUG_UNAVAILABLE', suggestion: 'ana-e-marcos-2026' },
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Endereço do site' })).toHaveAccessibleDescription(
        'kore.com.br/ana-e-marcos já está em uso. Que tal kore.com.br/ana-e-marcos-2026?',
      ),
    );
    expect(screen.getByRole('button', { name: 'Criar nosso site' })).toBeDisabled();
  });

  it('409 ALREADY_OWNER: Você já tem um casamento, e abrir vai à Seleção de perfil (RN06, 171(B))', async () => {
    const { user, router } = await submitWith(
      apiError({ status: 409, body: { error: 'ALREADY_OWNER', weddingId: 'w0' } }),
    );
    expect(await screen.findByText('Você já tem um casamento no Kore.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Abrir meu casamento' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/perfis'));
  });

  it('409 TERMS_VERSION_OUTDATED: recarrega para os termos novos (RN11, decisão 169(1))', async () => {
    await submitWith(apiError({ status: 409, body: { error: 'TERMS_VERSION_OUTDATED' } }));
    await waitFor(() => expect(reloadPage).toHaveBeenCalledTimes(1));
  });

  it('erro da API no envio: o aviso genérico e a tela fica', async () => {
    await submitWith(apiError({ status: 500, body: { error: 'Internal Server Error' } }));
    expect(await screen.findByText('Não foi possível continuar')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conte sobre o casamento' })).toBeInTheDocument();
  });

  async function createdWith(invite: (request: { body: unknown }) => Response) {
    const user = userEvent.setup();
    const sent: unknown[] = [];
    api((request) => {
      if (request.method === 'POST' && request.path === '/v1/weddings')
        return Response.json(
          {
            weddingId: 'w1',
            slug: 'ana-e-marcos',
            status: 'draft',
            timezone: 'America/Sao_Paulo',
            referrer: null,
          },
          { status: 201 },
        );
      if (request.path === '/v1/weddings/w1/access-invitations') {
        sent.push(request.body);
        return invite(request);
      }
      return available(request);
    });
    const view = renderRoute({ url: '/cadastro' });
    await fillForm(user);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Criar nosso site' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Criar nosso site' }));
    await screen.findByRole('heading', { name: 'Convide Marcos' });
    return { user, sent, ...view };
  }

  it('envia o convite do parceiro, avisa no Toast e segue (RN10, decisão 170)', async () => {
    const { user, sent, router } = await createdWith(() =>
      Response.json(
        {
          invitations: [
            {
              id: 'i1',
              email: 'marcos@exemplo.com',
              kind: 'partner',
              expiresAt: '2026-12-05T12:00:00Z',
              resent: false,
            },
          ],
        },
        { status: 201 },
      ),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'E-\u2060mail de Marcos' }),
      'marcos@exemplo.com',
    );
    await user.click(screen.getByRole('button', { name: 'Enviar convite' }));
    expect(await screen.findByText('Convite enviado para marcos@exemplo.com.')).toBeInTheDocument();
    expect(sent).toEqual([{ kind: 'partner', emails: ['marcos@exemplo.com'] }]);
    await waitFor(() => expect(router.state.location.pathname).not.toBe('/cadastro'));
  });

  it('e-mail inválido no convite: o erro da 155, sem enviar; o 400 da API também', async () => {
    const { user, sent } = await createdWith(() =>
      apiError({
        status: 400,
        body: { error: 'Bad Request', message: ['emails.0 must be an email'] },
      }),
    );
    const email = screen.getByRole('textbox', { name: 'E-\u2060mail de Marcos' });
    await user.type(email, 'marcos@');
    await user.click(screen.getByRole('button', { name: 'Enviar convite' }));
    expect(email).toHaveAccessibleDescription('Informe um e-\u2060mail válido.');
    expect(sent).toEqual([]);
    await user.clear(email);
    await user.type(email, 'marcos@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar convite' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    await waitFor(() =>
      expect(email).toHaveAccessibleDescription('Informe um e-\u2060mail válido.'),
    );
  });

  it('erro da API no convite: o aviso genérico e a tela fica', async () => {
    const { user } = await createdWith(() =>
      apiError({ status: 409, body: { error: 'OWNERS_FULL' } }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'E-\u2060mail de Marcos' }),
      'marcos@exemplo.com',
    );
    await user.click(screen.getByRole('button', { name: 'Enviar convite' }));
    expect(await screen.findByText('Não foi possível continuar')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Convide Marcos' })).toBeInTheDocument();
  });
});
