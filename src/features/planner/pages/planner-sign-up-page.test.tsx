import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

type ApiRequest = { method: string; path: string; body: unknown };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const URL = '/cerimonialista/cadastro';

const me = (overrides: Record<string, unknown> = {}) => ({
  user: {
    id: 'u1',
    name: 'Juliana Prado',
    email: 'juliana@pradoassessoria.com.br',
    platformRole: 'none',
  },
  activeProfile: null,
  authenticatedAt: '2026-11-13T12:00:00Z',
  memberships: [],
  profiles: [],
  lastProfileOnDevice: null,
  planner: null,
  referrer: null,
  plannerSignupEnabled: true,
  ...overrides,
});

const noSession = () => apiError({ status: 401, body: { error: 'SESSION_EXPIRED' } });

/** A API do cadastro: o /me, o POST /v1/me/planner (pela resposta dada) e o GET do link. */
function api({
  meBody = me(),
  create = () => Response.json({ referralCode: 'juliana-prado', home: '/cerimonialista' }),
  discountPercent = 10 as number | null,
}: {
  meBody?: Record<string, unknown> | (() => Response);
  create?: (request: ApiRequest) => Response | Promise<Response>;
  discountPercent?: number | null;
} = {}) {
  const posted: unknown[] = [];
  let created = false;
  mockApi((request) => {
    if (request.path === '/v1/me') {
      if (typeof meBody === 'function') return meBody();
      return Response.json(
        created ? { ...meBody, profiles: ['planner'], activeProfile: 'planner' } : meBody,
      );
    }
    if (request.path === '/v1/me/planner' && request.method === 'POST') {
      posted.push(request.body);
      const response = create(request);
      if (response instanceof Response && response.ok) created = true;
      return response;
    }
    if (request.path === '/v1/me/referrer') {
      return Response.json({
        referralCode: 'juliana-prado',
        link: 'https://kore.com.br/i/juliana-prado',
        discountPercent,
        taxIdMasked: null,
        pixKeyMasked: null,
      });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return posted;
}

async function openDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Continuar' }));
  return screen.findByRole('heading', { level: 1, name: 'Como os casais vão ver você' });
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nome da assessoria'), 'Prado Assessoria');
  await user.type(screen.getByLabelText(/^Telefone/), '(19) 98812-7730');
  await user.click(screen.getByRole('checkbox', { name: 'O mesmo do telefone' }));
  await user.type(screen.getByLabelText('Cidade'), 'Campinas');
  await user.selectOptions(screen.getByLabelText('UF'), 'SP');
  await user.click(screen.getByRole('button', { name: 'Adicionar' }));
  await user.click(screen.getByRole('checkbox', { name: /Li e aceito/ }));
}

describe('Cadastro do cerimonialista: o Início (Cadastro e perfil RN01 a RN03)', () => {
  it('sem sessão: o título, os benefícios sem percentual, o login com a origem planner_signup', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    mockApi(({ path, body }) => {
      if (path === '/v1/auth/login-challenges') {
        bodies.push(body);
        return Response.json({ resendAvailableAt: new Date(Date.now() + 60_000).toISOString() });
      }
      return noSession();
    });
    const { container } = renderRoute({ url: URL });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Fazer parceria com o Kore' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Grátis para usar, sempre. Você ganha comissão pelos casais que trouxer.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Comissão na publicação e nas extensões')).toBeInTheDocument();
    expect(
      screen.getByText('Sem os juros do cartão. As regras estão no termo de parceria.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
    expect(screen.getByRole('link', { name: 'Criar meu site' })).toHaveAttribute(
      'href',
      '/cadastro',
    );
    await expectNoA11yViolations({ container });
    await user.type(screen.getByLabelText(/^E-/), 'juliana@pradoassessoria.com.br');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() =>
      expect(bodies).toEqual([
        { email: 'juliana@pradoassessoria.com.br', origin: 'planner_signup' },
      ]),
    );
  });

  it('com sessão (A5): a conta e o Continuar, sem os botões de login', async () => {
    api();
    renderRoute({ url: URL });
    expect(
      await screen.findByText('Você vai usar a conta juliana@pradoassessoria.com.br.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continuar com Google' })).toBeNull();
    expect(screen.queryByLabelText(/^E-/)).toBeNull();
  });

  it('com o cadastro fechado, a tela Cadastro fechado antes dos dados (RN02)', async () => {
    api({ meBody: me({ plannerSignupEnabled: false }) });
    renderRoute({ url: URL });
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'O cadastro de parceria ainda não está aberto.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Estamos começando com as primeiras assessorias. Se quiser participar, escreva para suporte@kore.com.br.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar ao Kore' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull();
  });

  it('quem já tem o perfil vai à Área do cerimonialista (RN03)', async () => {
    api({ meBody: me({ profiles: ['planner'] }) });
    const { router } = renderRoute({ url: URL });
    await waitFor(() => expect(router.state.location.pathname).toBe('/cerimonialista'));
  });

  it('o perfil de vendas não vira cerimonialista: o aviso no Continuar (RN03; decisão 175)', async () => {
    const user = userEvent.setup();
    api({ meBody: me({ profiles: ['seller'] }) });
    renderRoute({ url: URL });
    await user.click(await screen.findByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByText(
        'Esta conta tem o perfil Vendas · Kore e não pode ter o de cerimonialista. Se precisar, escreva para suporte@kore.com.br.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Como os casais vão ver você' })).toBeNull();
  });

  it('a falha do /me por rede: o aviso com o Tentar de novo (decisão 164)', async () => {
    api({ meBody: () => apiError({ status: 503, body: { error: 'UNAVAILABLE' } }) });
    renderRoute({ url: URL });
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });
});

describe('Cadastro do cerimonialista: os Dados profissionais (RN04, RN05)', () => {
  it('os campos, a ajuda e o "Seu nome" só sem nome na conta', async () => {
    const user = userEvent.setup();
    api();
    const { container } = renderRoute({ url: URL });
    await openDetails(user);
    expect(
      screen.getByText(
        'Aparece no rodapé dos sites que você monta. Se você atende sem empresa, use o seu nome.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Telefone/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^WhatsApp/)).toBeInTheDocument();
    expect(screen.getAllByText('(opcional)')).toHaveLength(2);
    expect(
      screen.getByText(
        'Adicione as cidades onde você atende. Assim sabemos onde o Kore está chegando.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Seu nome')).toBeNull();
    // Sem o Alert do CPF e do Pix na F6 (decisão 249(2)).
    expect(screen.queryByText(/chave Pix/)).toBeNull();
    await expectNoA11yViolations({ container });
  });

  it('a conta sem nome pede Seu nome', async () => {
    const user = userEvent.setup();
    api({ meBody: me({ user: { ...me().user, name: null } }) });
    renderRoute({ url: URL });
    await openDetails(user);
    expect(screen.getByLabelText('Seu nome')).toBeInTheDocument();
  });

  it('o envio vazio mostra os erros de cada campo, sem chamar a API', async () => {
    const user = userEvent.setup();
    const posted = api({ meBody: me({ user: { ...me().user, name: null } }) });
    renderRoute({ url: URL });
    await openDetails(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Informe o nome da assessoria.')).toBeInTheDocument();
    expect(screen.getByText('Informe seu nome.')).toBeInTheDocument();
    expect(screen.getByText('Adicione pelo menos uma cidade.')).toBeInTheDocument();
    expect(screen.getByText('Aceite os termos para continuar.')).toBeInTheDocument();
    expect(posted).toEqual([]);
  });

  it('as cidades: adiciona "Campinas (SP)", recusa a repetida e remove pelo x (decisão 249)', async () => {
    const user = userEvent.setup();
    api();
    renderRoute({ url: URL });
    await openDetails(user);
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(screen.getByText('Informe a cidade.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Cidade'), 'Campinas');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(screen.getByText('Escolha a UF.')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('UF'), 'SP');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(screen.getByRole('listitem')).toHaveTextContent('Campinas (SP)');
    expect(screen.getByLabelText('Cidade')).toHaveValue('');
    // Enter na Cidade também adiciona.
    await user.type(screen.getByLabelText('Cidade'), 'campinas{Enter}');
    expect(screen.getByText('Essa cidade já está na lista.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remover Campinas (SP)' }));
    expect(screen.queryByText('Campinas (SP)')).toBeNull();
  });

  it('cria o perfil: o corpo do POST, o Link pronto com o desconto, Copiar, WhatsApp, Como funciona e a Área', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const posted = api();
    const { router } = renderRoute({ url: URL });
    await openDetails(user);
    await fillValid(user);
    expect(screen.getByLabelText(/^WhatsApp/)).toHaveValue('(19) 98812-7730');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Seu link de indicação está pronto' }),
    ).toBeInTheDocument();
    expect(posted).toEqual([
      {
        creditName: 'Prado Assessoria',
        phone: '19988127730',
        whatsapp: '19988127730',
        cities: ['Campinas (SP)'],
        termsVersion: '2026-09',
      },
    ]);
    expect(
      screen.getByText(
        'Mande para os seus clientes. Quem se cadastrar por ele ganha 10% de desconto na ativação.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('kore.com.br/i/juliana-prado')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copiar link' }));
    expect(await screen.findByText('Link copiado.')).toBeInTheDocument();
    await expect(navigator.clipboard.readText()).resolves.toBe(
      'https://kore.com.br/i/juliana-prado',
    );
    await user.click(screen.getByRole('button', { name: 'Compartilhar no WhatsApp' }));
    const message =
      'Oi! Uso o Kore para organizar os casamentos dos meus clientes. Se vocês se cadastrarem por este link, ganham 10% de desconto na ativação do site: https://kore.com.br/i/juliana-prado';
    expect(open).toHaveBeenCalledWith(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener',
    );
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Como funciona' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Trazer o casal')).toBeInTheDocument();
    expect(screen.getByText('Receber a comissão')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ir para Meus casamentos' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cerimonialista'));
  });

  it('com o desconto desligado: o Link pronto e o WhatsApp sem o desconto (decisão 250(b))', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    api({ discountPercent: null });
    renderRoute({ url: URL });
    await openDetails(user);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Mande para os seus clientes.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Compartilhar no WhatsApp' }));
    expect(open.mock.calls[0]?.[0]).toBe(
      `https://wa.me/?text=${encodeURIComponent(
        'Oi! Uso o Kore para organizar os casamentos dos meus clientes. Vocês podem se cadastrar por este link: https://kore.com.br/i/juliana-prado',
      )}`,
    );
  });

  it('o nome da assessoria com contato: o erro do servidor no campo (CREDIT_NAME_INVALID)', async () => {
    const user = userEvent.setup();
    api({
      create: () =>
        apiError({
          status: 400,
          body: {
            error: 'VALIDATION_ERROR',
            errors: [{ path: 'creditName', code: 'CREDIT_NAME_INVALID', params: {} }],
          },
        }),
    });
    renderRoute({ url: URL });
    await openDetails(user);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByText(/Use só o nome da assessoria, sem link, telefone ou e-/),
    ).toBeInTheDocument();
  });

  it.each([
    ['PLANNER_SIGNUP_DISABLED', 'o Cadastro fechado'],
    ['PLANNER_PROFILE_EXISTS', 'a Área (a outra aba)'],
  ])('o 409 %s leva a %s', async (code) => {
    const user = userEvent.setup();
    api({ create: () => apiError({ status: 409, body: { error: code } }) });
    const { router } = renderRoute({ url: URL });
    await openDetails(user);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    if (code === 'PLANNER_SIGNUP_DISABLED') {
      expect(
        await screen.findByText('O cadastro de parceria ainda não está aberto.'),
      ).toBeInTheDocument();
    } else {
      await waitFor(() => expect(router.state.location.pathname).toBe('/cerimonialista'));
    }
  });

  it('o 409 SELLER_CANNOT_BE_PLANNER mostra o aviso do perfil de vendas', async () => {
    const user = userEvent.setup();
    api({ create: () => apiError({ status: 409, body: { error: 'SELLER_CANNOT_BE_PLANNER' } }) });
    renderRoute({ url: URL });
    await openDetails(user);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText(/Esta conta tem o perfil Vendas · Kore/)).toBeInTheDocument();
  });

  it('o 409 TERMS_VERSION_OUTDATED: o texto nos Termos e a caixa desmarcada (RN04)', async () => {
    const user = userEvent.setup();
    api({ create: () => apiError({ status: 409, body: { error: 'TERMS_VERSION_OUTDATED' } }) });
    renderRoute({ url: URL });
    await openDetails(user);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByText('Os termos mudaram. Leia e aceite a versão nova para continuar.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Li e aceito/ })).not.toBeChecked();
  });

  it('o Continuar fica desabilitado enquanto o POST não responde, e manda um só', async () => {
    const user = userEvent.setup();
    const posted = api({ create: () => new Promise<Response>(() => undefined) });
    renderRoute({ url: URL });
    await openDetails(user);
    await fillValid(user);
    const submit = screen.getByRole('button', { name: 'Continuar' });
    await user.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    expect(submit).toHaveAttribute('aria-busy', 'true');
    await user.click(submit);
    expect(posted).toHaveLength(1);
  });
});
