import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';
import type { PartyResponse } from '../../../shared/api/generated/model';

afterEach(() => {
  vi.unstubAllGlobals();
});

const me = {
  user: {
    id: 'u1',
    name: 'Ana Beatriz Moreira',
    email: 'ana.moreira@gmail.com',
    platformRole: 'none',
  },
  activeProfile: 'couple',
  authenticatedAt: '2026-11-05T12:00:00Z',
  memberships: [
    {
      weddingId: 'w1',
      role: 'owner',
      weddingName: 'Ana & Marcos',
      eventDate: '2026-11-14',
      city: 'Campinas',
      state: 'SP',
    },
  ],
  profiles: ['couple'],
  lastProfileOnDevice: 'couple',
  planner: null,
  referrer: null,
};

const URL_ANTIGA = 'http://localhost:5173/ana-e-marcos/grupo/antigo';

function moreira(overrides: Partial<PartyResponse> = {}): PartyResponse {
  return {
    id: 'p1',
    name: 'Família Moreira',
    contactGuestId: 'g2',
    internalNote: 'Pedro tem 7 anos e vai de pajem.',
    tags: [{ id: 't1', name: 'Família da Ana', color: 'wine' }],
    deliveryStatus: 'not_sent',
    plusOneSlots: 1,
    history: [],
    link: { url: URL_ANTIGA, regeneratedAt: null },
    guests: [
      {
        id: 'g1',
        name: 'Luiz Moreira',
        ageGroup: 'adult',
        dietaryRestriction: null,
        phone: null,
        email: null,
        rsvpStatus: 'pending',
        tags: [],
        isPlusOne: false,
      },
      {
        id: 'g2',
        name: 'Célia Moreira',
        ageGroup: 'adult',
        dietaryRestriction: 'sem glúten',
        phone: '+5519998763310',
        email: 'celia.moreira@gmail.com',
        rsvpStatus: 'confirmed',
        tags: [],
        isPlusOne: false,
      },
      {
        id: 'g3',
        name: 'Pedro Moreira',
        ageGroup: 'child',
        dietaryRestriction: null,
        phone: null,
        email: null,
        rsvpStatus: 'declined',
        tags: [],
        isPlusOne: false,
      },
      {
        id: 'g4',
        name: null,
        ageGroup: null,
        dietaryRestriction: null,
        phone: null,
        email: null,
        rsvpStatus: 'pending',
        tags: [],
        isPlusOne: true,
      },
    ],
    ...overrides,
  };
}

/** Responde o /me, o GET do grupo e o regenerate; devolve as chamadas ao regenerate. */
function mockPanel({
  party = moreira(),
  regenerate,
}: { party?: PartyResponse | null; regenerate?: () => Response } = {}) {
  const calls: string[] = [];
  let current = party;
  mockApi(({ method, path }) => {
    if (path === '/v1/me') return Response.json(me);
    if (method === 'GET' && path === '/v1/weddings/w1/parties/p1') {
      return current
        ? Response.json(current)
        : apiError({ status: 404, body: { error: 'PARTY_NOT_FOUND' } });
    }
    if (method === 'POST' && path === '/v1/weddings/w1/parties/p1/regenerate-link') {
      calls.push(path);
      const response =
        regenerate?.() ??
        Response.json({
          url: 'http://localhost:5173/ana-e-marcos/grupo/novo',
          regeneratedAt: '2026-11-11T12:00:00Z',
        });
      if (response.ok && current)
        current = {
          ...current,
          link: {
            url: 'http://localhost:5173/ana-e-marcos/grupo/novo',
            regeneratedAt: '2026-11-11T12:00:00Z',
          },
        };
      return response;
    }
    if (path.startsWith('/v1/weddings/w1/parties')) {
      return Response.json({
        summary: { guests: 0, namedGuests: 0, parties: 0, confirmed: 0, declined: 0, pending: 0 },
        total: 0,
        data: [],
        nextCursor: null,
      });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

describe('Painel do grupo (RN14)', () => {
  it('mostra o grupo, o contato mascarado, os convidados com a resposta e o link', async () => {
    mockPanel();
    renderRoute({ url: '/app/convidados/grupos/p1' });
    expect(
      await screen.findByRole('heading', { name: 'Família Moreira', level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('3 convidados · Contato: Célia Moreira · Família da Ana'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '‹ Voltar para Convidados' })).toHaveAttribute(
      'href',
      '/app/convidados',
    );

    const group = screen.getByRole('heading', { name: 'Grupo' }).closest('section') as HTMLElement;
    expect(within(group).getByText('(19) 9****-3310')).toBeInTheDocument();
    expect(within(group).getByText('celia.moreira@gmail.com')).toBeInTheDocument();
    expect(within(group).getByText('1')).toBeInTheDocument();
    expect(
      within(group).getByText('Observação interna: Pedro tem 7 anos e vai de pajem.'),
    ).toBeInTheDocument();
    // O telefone inteiro não aparece (LGPD; o formulário de edição é que o usa).
    expect(screen.queryByText(/998763310/)).toBeNull();

    const guests = screen
      .getByRole('heading', { name: 'Convidados', level: 2 })
      .closest('section') as HTMLElement;
    const items = within(guests).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Luiz MoreiraAdultoPendente',
      'Célia MoreiraAdulto · sem glútenConfirmado',
      'Pedro MoreiraCriançaRecusado',
      'AcompanhantePendente',
    ]);
    expect(screen.getByText(URL_ANTIGA)).toBeInTheDocument();
    expect(
      screen.getByText('Quem abre este link responde pelo grupo Família Moreira.'),
    ).toBeInTheDocument();
    // Histórico vazio até a F4: o cartão não aparece.
    expect(screen.queryByRole('heading', { name: 'Histórico' })).toBeNull();
  });

  it('sem contato, sem tags e sem vagas: os traços e o "nenhuma"', async () => {
    mockPanel({
      party: moreira({ contactGuestId: null, tags: [], plusOneSlots: 0, internalNote: null }),
    });
    renderRoute({ url: '/app/convidados/grupos/p1' });
    expect(await screen.findByText('3 convidados')).toBeInTheDocument();
    const group = screen.getByRole('heading', { name: 'Grupo' }).closest('section') as HTMLElement;
    expect(within(group).getAllByText('—')).toHaveLength(4);
    expect(within(group).getByText('nenhuma')).toBeInTheDocument();
    expect(within(group).queryByText(/Observação interna/)).toBeNull();
  });

  it('Copiar link copia e mostra "Link copiado." (RN11)', async () => {
    const user = userEvent.setup();
    mockPanel();
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await user.click(await screen.findByRole('button', { name: 'Copiar link' }));
    await expect(navigator.clipboard.readText()).resolves.toBe(URL_ANTIGA);
    expect(await screen.findByText('Link copiado.')).toBeInTheDocument();
  });

  it('sem endereço do casamento, o link é "—" e o Copiar link fica desabilitado', async () => {
    mockPanel({ party: moreira({ link: { url: null, regeneratedAt: null } }) });
    renderRoute({ url: '/app/convidados/grupos/p1' });
    expect(await screen.findByRole('button', { name: 'Copiar link' })).toBeDisabled();
  });

  it('Regenerar link pede confirmação com o texto do casal e mostra o link novo (RN12)', async () => {
    const user = userEvent.setup();
    const calls = mockPanel();
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await user.click(await screen.findByRole('button', { name: 'Regenerar link' }));
    const dialog = screen.getByRole('alertdialog', {
      name: 'Regenerar o link do grupo Família Moreira?',
    });
    expect(dialog).toHaveAccessibleDescription(
      'O link antigo para de funcionar na hora. Vocês vão precisar enviar o link novo ao grupo.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Regenerar link' }));
    expect(
      await screen.findByText('http://localhost:5173/ana-e-marcos/grupo/novo'),
    ).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('Cancelar não regenera (RN12)', async () => {
    const user = userEvent.setup();
    const calls = mockPanel();
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await user.click(await screen.findByRole('button', { name: 'Regenerar link' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(calls).toHaveLength(0);
    expect(screen.getByText(URL_ANTIGA)).toBeInTheDocument();
  });

  it('se o regenerar falha, o Toast de erro, e o link continua', async () => {
    const user = userEvent.setup();
    mockPanel({ regenerate: () => apiError({ status: 500, body: {} }) });
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await user.click(await screen.findByRole('button', { name: 'Regenerar link' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Regenerar link' }),
    );
    expect(
      await screen.findByText('Não foi possível continuar. Confira sua conexão e tente de novo.'),
    ).toBeInTheDocument();
    expect(screen.getByText(URL_ANTIGA)).toBeInTheDocument();
  });

  it('grupo que não existe volta para a lista', async () => {
    mockPanel({ party: null });
    const { router } = renderRoute({ url: '/app/convidados/grupos/p1' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/convidados'));
  });

  it('é acessível', async () => {
    mockPanel();
    const { container } = renderRoute({ url: '/app/convidados/grupos/p1' });
    await screen.findByRole('heading', { name: 'Família Moreira', level: 1 });
    await expectNoA11yViolations({ container });
  });
});

/** O mock do Painel com a lista de grupos (para a escolha) e o POST do move. */
function mockMove({
  party = moreira(),
  move,
}: { party?: PartyResponse; move?: (body: unknown) => Response } = {}) {
  const calls: { path: string; body: unknown }[] = [];
  let current = party;
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(me);
    if (method === 'GET' && path === '/v1/weddings/w1/parties/p1') return Response.json(current);
    if (method === 'GET' && path.startsWith('/v1/weddings/w1/parties?')) {
      calls.push({ path, body: undefined });
      const all = [
        { id: 'p1', name: 'Família Moreira' },
        { id: 'p2', name: 'Padrinhos' },
        { id: 'p3', name: 'Vó Helena' },
      ].filter(({ name }) => !path.includes('q=') || name.toLowerCase().includes('padr'));
      return Response.json({
        summary: { guests: 0, namedGuests: 0, parties: 3, confirmed: 0, declined: 0, pending: 0 },
        total: all.length,
        data: all.map(({ id, name }) => ({
          id,
          name,
          contact: null,
          firstGuestName: null,
          people: 1,
          counts: { confirmed: 0, declined: 0, pending: 1, pendingPlusOnes: 0 },
          deliveryStatus: 'not_sent',
          respondedAt: null,
          respondedBy: null,
          tags: [],
        })),
        nextCursor: null,
      });
    }
    if (method === 'POST' && path.endsWith('/move')) {
      calls.push({ path, body });
      const response =
        move?.(body) ?? Response.json({ guestId: 'g3', fromPartyId: 'p1', toPartyId: 'p2' });
      if (response.ok)
        current = { ...current, guests: current.guests.filter((guest) => guest.id !== 'g3') };
      return response;
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

async function openMove(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: `Ações de ${name}` }));
  await user.click(screen.getByRole('menuitem', { name: 'Mover de grupo' }));
}

describe('Mover de grupo (RN10; decisão 201)', () => {
  it('só os convidados com nome têm o ⋮ (a vaga vazia não se move)', async () => {
    mockMove();
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await screen.findByRole('button', { name: 'Ações de Luiz Moreira' });
    expect(screen.getAllByRole('button', { name: /^Ações de / })).toHaveLength(3);
  });

  it('escolhe o grupo (sem o atual), move e mostra o Toast', async () => {
    const user = userEvent.setup();
    const calls = mockMove();
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await openMove(user, 'Pedro Moreira');
    const dialog = screen.getByRole('dialog', { name: 'Mover Pedro Moreira para outro grupo' });
    const select = within(dialog).getByRole('combobox', { name: 'Grupo' });
    await waitFor(() =>
      expect(
        within(select)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Padrinhos', 'Vó Helena']),
    );
    // O placeholder "Grupo" é a opção escondida do Select da lib; o grupo atual não aparece.
    expect(select).toHaveDisplayValue('Grupo');
    const mover = within(dialog).getByRole('button', { name: 'Mover' });
    expect(mover).toBeDisabled();
    await user.selectOptions(select, 'p2');
    await user.click(mover);
    expect(await screen.findByText('Pedro Moreira foi para Padrinhos.')).toBeInTheDocument();
    expect(calls.find((call) => call.path.endsWith('/move'))).toEqual({
      path: '/v1/weddings/w1/guests/g3/move',
      body: { partyId: 'p2' },
    });
    await waitFor(() => expect(screen.queryByText('Pedro Moreira')).toBeNull());
  });

  it('a busca do diálogo procura o grupo pelo nome', async () => {
    const user = userEvent.setup();
    const calls = mockMove();
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await openMove(user, 'Pedro Moreira');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar por nome' }), 'padr');
    await waitFor(() =>
      expect(calls.at(-1)?.path).toBe('/v1/weddings/w1/parties?q=padr&limit=100'),
    );
  });

  it('Cancelar não move e devolve o foco ao ⋮', async () => {
    const user = userEvent.setup();
    const calls = mockMove();
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await openMove(user, 'Pedro Moreira');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((call) => call.path.endsWith('/move'))).toBe(false);
    expect(screen.getByRole('button', { name: 'Ações de Pedro Moreira' })).toHaveFocus();
  });

  it('o último convidado com nome não sai: o aviso do casal, sem diálogo nem API (RN08)', async () => {
    const user = userEvent.setup();
    const party = moreira();
    const calls = mockMove({
      party: {
        ...party,
        guests: party.guests.filter((guest) => guest.id === 'g1' || guest.isPlusOne),
      },
    });
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await openMove(user, 'Luiz Moreira');
    expect(
      await screen.findByText(
        'O grupo precisa de pelo menos um convidado. Para tirar todos, movam o grupo para a lixeira.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls.some((call) => call.path.endsWith('/move'))).toBe(false);
  });

  it('se a API recusa com LAST_GUEST, o mesmo aviso (RN08)', async () => {
    const user = userEvent.setup();
    mockMove({ move: () => apiError({ status: 409, body: { error: 'LAST_GUEST' } }) });
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await openMove(user, 'Pedro Moreira');
    const dialog = screen.getByRole('dialog');
    const select = within(dialog).getByRole('combobox', { name: 'Grupo' });
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2));
    await user.selectOptions(select, 'p2');
    await user.click(within(dialog).getByRole('button', { name: 'Mover' }));
    expect(
      await screen.findByText(
        'O grupo precisa de pelo menos um convidado. Para tirar todos, movam o grupo para a lixeira.',
      ),
    ).toBeInTheDocument();
  });

  it('é acessível com o diálogo aberto', async () => {
    const user = userEvent.setup();
    mockMove();
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await openMove(user, 'Pedro Moreira');
    await screen.findByRole('dialog');
    await expectNoA11yViolations({ container: document.body, disabledRules: ['region'] });
  });
});
