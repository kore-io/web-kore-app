import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

afterEach(() => {
  vi.unstubAllGlobals();
});

const URL = '/cerimonialista/perfil';

const me = {
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
};

const profile = (overrides: Record<string, unknown> = {}) => ({
  name: 'Juliana Prado',
  creditName: 'Prado Assessoria',
  phone: '19988127730',
  whatsapp: '19988127730',
  cities: ['Campinas (SP)', 'Valinhos (SP)'],
  email: 'juliana@pradoassessoria.com.br',
  profileComplete: true,
  termsAccepted: true,
  creditHidden: false,
  ...overrides,
});

type Request = { method: string; path: string; body: unknown };

/** O /me, o GET e o PATCH do /v1/me/planner (pela resposta dada). */
function api({
  profileBody = profile(),
  patch = ({ body }: Request) => Response.json({ ...profileBody, ...(body as object) }),
}: {
  profileBody?: Record<string, unknown>;
  patch?: (request: Request) => Response;
} = {}) {
  const patched: unknown[] = [];
  mockApi((request) => {
    if (request.path === '/v1/me') return Response.json(me);
    if (request.path === '/v1/me/planner' && request.method === 'GET') {
      return Response.json(profileBody);
    }
    if (request.path === '/v1/me/planner' && request.method === 'PATCH') {
      patched.push(request.body);
      return patch(request);
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return patched;
}

async function findForm() {
  return screen.findByRole('textbox', { name: 'Nome da assessoria' });
}

describe('Meu perfil (Cadastro e perfil RN09 e RN10; Penpot 15)', () => {
  it('o título, o e-mail como texto, os dados salvos e a ajuda do nome com "O casal pode ocultar."', async () => {
    api();
    const { container } = renderRoute({ url: URL });
    expect(await findForm()).toHaveValue('Prado Assessoria');
    expect(screen.getByRole('heading', { level: 1, name: 'Meu perfil' })).toBeInTheDocument();
    expect(
      screen.getByText('Como você aparece para os casais e no rodapé dos sites.'),
    ).toBeInTheDocument();
    expect(screen.getByText('E-\u2060mail da conta')).toBeInTheDocument();
    expect(
      screen.getByText('juliana@pradoassessoria.com.br', { selector: 'p' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Para mudar o e-\u2060mail, escreva para suporte@kore.com.br.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Aparece no rodapé dos sites que você monta. O casal pode ocultar. Se você atende sem empresa, use o seu nome.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Telefone/ })).toHaveValue('(19) 98812-7730');
    expect(screen.getByRole('checkbox', { name: 'O mesmo do telefone' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Remover Valinhos (SP)' })).toBeInTheDocument();
    // Sem o Seu nome (a conta tem nome) e sem os Termos (já aceitos).
    expect(screen.queryByRole('textbox', { name: 'Seu nome' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /Li e aceito/ })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    await expectNoA11yViolations({ container });
  });

  it('Salvar alterações: o PATCH com os dados, o Toast e o /me relido (RN09)', async () => {
    const user = userEvent.setup();
    const patched = api();
    renderRoute({ url: URL });
    const name = await findForm();
    await user.clear(name);
    await user.type(name, 'Prado Eventos');
    await user.click(screen.getByRole('button', { name: 'Remover Valinhos (SP)' }));
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
    expect(patched).toEqual([
      {
        creditName: 'Prado Eventos',
        phone: '19988127730',
        whatsapp: '19988127730',
        cities: ['Campinas (SP)'],
      },
    ]);
    expect(screen.getByRole('textbox', { name: 'Nome da assessoria' })).toHaveValue(
      'Prado Eventos',
    );
  });

  it('os erros da RN04 no campo, sem chamar a API', async () => {
    const user = userEvent.setup();
    const patched = api();
    renderRoute({ url: URL });
    await user.clear(await findForm());
    await user.click(screen.getByRole('button', { name: 'Remover Campinas (SP)' }));
    await user.click(screen.getByRole('button', { name: 'Remover Valinhos (SP)' }));
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(screen.getByText('Informe o nome da assessoria.')).toBeInTheDocument();
    expect(screen.getByText('Adicione pelo menos uma cidade.')).toBeInTheDocument();
    expect(patched).toEqual([]);
  });

  it('o nome com contato: o erro do servidor no campo (CREDIT_NAME_INVALID)', async () => {
    const user = userEvent.setup();
    api({
      patch: () =>
        apiError({
          status: 400,
          body: {
            error: 'VALIDATION',
            errors: [{ path: 'creditName', code: 'CREDIT_NAME_INVALID' }],
          },
        }),
    });
    renderRoute({ url: URL });
    await user.type(await findForm(), ' www.prado.com');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(
      await screen.findByText('Use só o nome da assessoria, sem link, telefone ou e-\u2060mail.'),
    ).toBeInTheDocument();
  });

  it('Cancelar volta aos dados salvos', async () => {
    const user = userEvent.setup();
    api();
    renderRoute({ url: URL });
    const name = await findForm();
    await user.clear(name);
    await user.type(name, 'Outro nome');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('textbox', { name: 'Nome da assessoria' })).toHaveValue(
      'Prado Assessoria',
    );
  });

  it('o perfil mínimo sem os Termos: a caixa aparece, e sem ela "Aceite os termos para salvar." (RN10)', async () => {
    const user = userEvent.setup();
    const patched = api({
      profileBody: profile({ cities: [], termsAccepted: false, profileComplete: false }),
    });
    renderRoute({ url: URL });
    await findForm();
    await user.type(screen.getByLabelText('Cidade'), 'Vinhedo');
    await user.selectOptions(screen.getByLabelText('UF'), 'SP');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(screen.getByText('Aceite os termos para salvar.')).toBeInTheDocument();
    expect(patched).toEqual([]);
    await user.click(screen.getByRole('checkbox', { name: /Li e aceito/ }));
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() =>
      expect(patched).toEqual([
        expect.objectContaining({ cities: ['Vinhedo (SP)'], termsVersion: expect.any(String) }),
      ]),
    );
  });

  it('a assinatura ocultada pelo Kore: o aviso abaixo do nome (decisão 254(4))', async () => {
    api({ profileBody: profile({ creditHidden: true }) });
    renderRoute({ url: URL });
    await findForm();
    expect(
      screen.getByText(
        'O Kore ocultou a sua assinatura. Para saber mais, escreva para suporte@kore.com.br.',
      ),
    ).toBeInTheDocument();
  });

  it('a falha do PATCH por rede: o aviso genérico no Toast, e o formulário fica', async () => {
    const user = userEvent.setup();
    api({ patch: () => apiError({ status: 503, body: { error: 'UNAVAILABLE' } }) });
    renderRoute({ url: URL });
    await findForm();
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    const region = screen.getByRole('region', { name: /^Avisos/ });
    expect(await within(region).findByText(/^Não foi possível continuar/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nome da assessoria' })).toBeInTheDocument();
  });

  it('a falha da leitura do perfil: o aviso com o Tentar de novo', async () => {
    mockApi(({ path }) =>
      path === '/v1/me'
        ? Response.json(me)
        : apiError({ status: 503, body: { error: 'UNAVAILABLE' } }),
    );
    renderRoute({ url: URL });
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });
});
