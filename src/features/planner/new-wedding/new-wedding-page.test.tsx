import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

afterEach(() => {
  vi.unstubAllGlobals();
});

const me = {
  user: { id: 'u1', name: 'Juliana Prado', email: 'juliana@exemplo.com', platformRole: 'none' },
  activeProfile: 'planner',
  authenticatedAt: '2026-11-14T12:00:00Z',
  memberships: [],
  profiles: ['planner'],
  lastProfileOnDevice: 'planner',
  planner: { organization: 'Prado Assessoria', weddingsCount: 2 },
  referrer: null,
  plannerSignupEnabled: true,
  identities: [{ provider: 'email' }],
};

type Call = { method: string; path: string; body?: unknown };

function api({
  available = true,
  create = () =>
    Response.json(
      { status: 'draft', weddingId: 'w9', slug: 'isabela-e-andre', timezone: 'America/Sao_Paulo' },
      { status: 201 },
    ),
}: { available?: boolean; create?: () => Response } = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(me);
    if (path.startsWith('/v1/weddings/slug-availability')) {
      const slug = new URL(`http://x${path}`).searchParams.get('slug') ?? '';
      return Response.json(
        available
          ? { slug, available: true }
          : { slug, available: false, suggestion: `${slug}-2027` },
      );
    }
    if (method === 'POST' && path === '/v1/me/weddings') {
      calls.push({ method, path, body });
      return create();
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const ROUTE = '/cerimonialista/casamentos/novo';

async function fillData(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole('textbox', { name: 'Nomes do casal, 1' }), 'Isabela');
  await user.type(screen.getByRole('textbox', { name: 'Nomes do casal, 2' }), 'André');
  await user.type(screen.getByRole('textbox', { name: 'Cidade' }), 'Americana');
  await user.selectOptions(screen.getByRole('combobox', { name: 'UF' }), 'SP');
}

describe('Novo casamento › passos 1 e 2 (Novo casamento RN01 a RN04; D6a)', () => {
  it('o passo 1: o stepper, o subtítulo e os erros abaixo de cada campo (RN02)', async () => {
    const user = userEvent.setup();
    api();
    const { container } = renderRoute({ url: ROUTE });
    expect(await screen.findByRole('heading', { name: 'Novo casamento', level: 1 })).toBeVisible();
    expect(
      screen.getByText(
        'Passo 1 de 4 · O casamento nasce como rascunho. Você monta o site e convida o casal quando quiser.',
      ),
    ).toBeInTheDocument();
    const steps = screen.getByRole('list', { name: 'Novo casamento' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(4);
    expect(within(steps).getByText('Dados do casamento').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expectNoA11yViolations({ container });
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('textbox', { name: 'Nomes do casal, 1' })).toHaveAccessibleDescription(
      'Informe o nome.',
    );
    expect(screen.getByRole('textbox', { name: 'Nomes do casal, 2' })).toHaveAccessibleDescription(
      'Informe o nome.',
    );
    expect(screen.getByRole('textbox', { name: 'Cidade' })).toHaveAccessibleDescription(
      'Informe a cidade.',
    );
    expect(screen.getByRole('combobox', { name: 'UF' })).toHaveAccessibleDescription(
      'Escolha a UF.',
    );
    expect(screen.getByText('Passo 1 de 4', { exact: false })).toBeInTheDocument();
  });

  it('o endereço sugerido pelos nomes, a disponibilidade e o ocupado com a sugestão', async () => {
    const user = userEvent.setup();
    api({ available: false });
    renderRoute({ url: ROUTE });
    await fillData(user);
    const slug = screen.getByRole('textbox', { name: 'Endereço do site' });
    expect(slug).toHaveValue('isabela-e-andre');
    expect(
      await screen.findByText('Esse endereço já está em uso. Tente isabela-e-andre-2027.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    // Ocupado: não avança.
    expect(screen.getByText('Passo 1 de 4', { exact: false })).toBeInTheDocument();
  });

  it('passo 1 → passo 2 → o POST com a aparência padrão, o Toast e o detalhe (RN04)', async () => {
    const user = userEvent.setup();
    const calls = api();
    const { router } = renderRoute({ url: ROUTE });
    await fillData(user);
    await user.click(screen.getByRole('checkbox', { name: 'O casal ainda não sabe a data' }));
    expect(
      await screen.findByText('Endereço disponível. O casal pode mudar até publicar.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByText(
        'Passo 2 de 4 · Escolha um ponto de partida. O casal pode mudar tudo depois.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Dados do casamento, concluído')).toBeInTheDocument();
    expect(
      within(screen.getByRole('complementary', { name: 'Prévia do site' })).getByText(
        'Isabela & André',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(router.state.location.search).toBe('?casamento=w9'));
    expect(router.state.location.pathname).toBe('/cerimonialista');
    expect(await screen.findByText('Casamento criado.')).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/v1/me/weddings',
        body: {
          partner1Name: 'Isabela',
          partner2Name: 'André',
          city: 'Americana',
          state: 'SP',
          slug: 'isabela-e-andre',
          appearance: {
            fontPairKey: 'romantico',
            starterPaletteKey: 'terracota',
            primaryColor: '#A94F37',
            accentColor: '#7A8B69',
            backgroundMode: 'cream',
          },
        },
      },
    ]);
  });

  it('o endereço ocupado na criação (409 SLUG_UNAVAILABLE) volta ao passo 1 com a sugestão', async () => {
    const user = userEvent.setup();
    api({
      create: () =>
        apiError({
          status: 409,
          body: { error: 'SLUG_UNAVAILABLE', suggestion: 'isabela-e-andre-2' },
        }),
    });
    renderRoute({ url: ROUTE });
    await fillData(user);
    await screen.findByText('Endereço disponível. O casal pode mudar até publicar.');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByText('Passo 2 de 4', { exact: false });
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByText('Esse endereço já está em uso. Tente isabela-e-andre-2.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Passo 1 de 4', { exact: false })).toBeInTheDocument();
  });

  it('o contraste recusado pelo servidor (422 CONTRAST_TOO_LOW) fica no passo 2 com o aviso', async () => {
    const user = userEvent.setup();
    api({
      create: () =>
        apiError({ status: 422, body: { error: 'CONTRAST_TOO_LOW', check: 'primary_foreground' } }),
    });
    renderRoute({ url: ROUTE });
    await fillData(user);
    await screen.findByText('Endereço disponível. O casal pode mudar até publicar.');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByText('Passo 2 de 4', { exact: false });
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Passo 2 de 4', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('Cancelar volta a Meus casamentos sem criar nada', async () => {
    const user = userEvent.setup();
    const calls = api();
    const { router } = renderRoute({ url: ROUTE });
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cerimonialista'));
    expect(calls).toEqual([]);
  });

  it('os nomes e a cidade com mais de 80 caracteres (RN02)', async () => {
    const user = userEvent.setup();
    api();
    renderRoute({ url: ROUTE });
    const name = await screen.findByRole('textbox', { name: 'Nomes do casal, 1' });
    await user.click(name);
    await user.paste('a'.repeat(81));
    const city = screen.getByRole('textbox', { name: 'Cidade' });
    await user.click(city);
    await user.paste('b'.repeat(81));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(name).toHaveAccessibleDescription('O nome passa de 80 caracteres.');
    expect(city).toHaveAccessibleDescription('A cidade passa de 80 caracteres.');
  });

  it('o Continuar do passo 1 espera a resposta da disponibilidade do endereço', async () => {
    const user = userEvent.setup();
    api();
    renderRoute({ url: ROUTE });
    await fillData(user);
    // Antes da resposta (o debounce de 400 ms), não avança.
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText('Passo 1 de 4', { exact: false })).toBeInTheDocument();
    await screen.findByText('Endereço disponível. O casal pode mudar até publicar.');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Passo 2 de 4', { exact: false })).toBeInTheDocument();
  });

  it('a falha na criação mostra o aviso genérico e fica no passo 2', async () => {
    const user = userEvent.setup();
    api({ create: () => apiError({ status: 503, body: { error: 'UNAVAILABLE' } }) });
    renderRoute({ url: ROUTE });
    await fillData(user);
    await screen.findByText('Endereço disponível. O casal pode mudar até publicar.');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByText('Passo 2 de 4', { exact: false });
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByText('Não foi possível continuar. Confira sua conexão e tente de novo.', {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Passo 2 de 4', { exact: false })).toBeInTheDocument();
  });
});
