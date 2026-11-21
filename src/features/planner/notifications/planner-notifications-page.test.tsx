import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

afterEach(() => vi.unstubAllGlobals());

const PAGE = '/cerimonialista/notificacoes';

const me = {
  user: { id: 'u1', name: 'Juliana Prado', email: 'juliana@prado.com.br', platformRole: 'none' },
  activeProfile: 'planner',
  authenticatedAt: '2026-11-21T12:00:00Z',
  // Ela colabora em Ana e Marcos (w1); Bianca e Henrique (w2) vieram pelo link dela.
  memberships: [
    {
      weddingId: 'w1',
      role: 'collaborator',
      weddingName: 'Ana & Marcos',
      eventDate: '2027-05-15',
      city: 'Campinas',
      state: 'SP',
      lifecycle: {
        status: 'draft',
        endDate: null,
        graceUntil: null,
        expiredAt: null,
        deletionScheduledFor: null,
        blocked: false,
      },
    },
  ],
  profiles: ['planner'],
  lastProfileOnDevice: 'planner',
  planner: { organization: 'Prado Assessoria', weddingsCount: 1 },
  referrer: null,
  plannerSignupEnabled: true,
  identities: [{ provider: 'email' }],
};

const group = (name: string, partyId = `p-${name}`) => ({
  at: '2026-09-26T12:12:00Z',
  partyId,
  name,
  confirmed: 2,
  declined: 0,
});

const MANY = {
  id: 'n1',
  type: 'rsvp',
  weddingId: 'w1',
  partnerNames: ['Ana', 'Marcos'],
  count: 2,
  payload: [group('Família Moreira'), group('Tios do Marcos')],
  readAt: null,
  updatedAt: '2026-09-26T12:12:00Z',
};
const PUBLISHED_REFERRED = {
  id: 'n2',
  type: 'wedding_published',
  weddingId: 'w2',
  partnerNames: ['Bianca', 'Henrique'],
  count: 1,
  payload: [{ partnerNames: ['Bianca', 'Henrique'] }],
  readAt: null,
  updatedAt: '2026-09-15T17:22:00Z',
};
const REMOVED = {
  id: 'n3',
  type: 'membership_removed',
  weddingId: 'w3',
  partnerNames: ['Priscila', 'Davi'],
  count: 1,
  payload: [{ partnerNames: ['Priscila', 'Davi'] }],
  readAt: '2026-09-14T15:00:00Z',
  updatedAt: '2026-09-14T14:20:00Z',
};
const ONE = {
  ...MANY,
  id: 'n4',
  count: 1,
  payload: [group('Família Moreira')],
  readAt: '2026-09-13T10:00:00Z',
  updatedAt: '2026-09-12T23:14:00Z',
};
const ERASED = { ...ONE, id: 'n5', payload: [group('Grupo removido')] };
const PUBLISHED_COLLABORATING = {
  ...PUBLISHED_REFERRED,
  id: 'n6',
  weddingId: 'w1',
  partnerNames: ['Ana', 'Marcos'],
};
// O casal grava avisos de cobrança na central dele; aqui, a F3 ainda não desenha a Comissão.
const COMMISSION = { ...REMOVED, id: 'n7', type: 'commission' };

type Call = { method: string; path: string };

function api({
  items = [
    MANY,
    PUBLISHED_REFERRED,
    REMOVED,
    ONE,
    ERASED,
    PUBLISHED_COLLABORATING,
    COMMISSION,
  ] as object[],
  nextCursor = null as string | null,
  unread = 2,
}: { items?: object[]; nextCursor?: string | null; unread?: number } = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path }) => {
    if (path === '/v1/me') return Response.json(me);
    if (path.startsWith('/v1/me/notifications/unread-count')) {
      calls.push({ method, path });
      return Response.json({ unreadCount: unread });
    }
    if (method === 'GET' && path.startsWith('/v1/me/notifications?')) {
      calls.push({ method, path });
      const query = new URLSearchParams(path.split('?')[1]);
      const type = query.get('type');
      const page = query.get('cursor')
        ? [{ ...REMOVED, id: 'n9', partnerNames: ['Paula', 'Diego'] }]
        : items.filter((item) => !type || (item as { type: string }).type === type);
      return Response.json({ items: page, nextCursor: query.get('cursor') ? null : nextCursor });
    }
    if (method === 'POST' && path.startsWith('/v1/me/notifications')) {
      calls.push({ method, path });
      return new Response(null, { status: 204 });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const reads = (calls: Call[]) => calls.filter((call) => call.method === 'POST');

describe('Notificações da cerimonialista (RN05; decisão 300; Penpot 13)', () => {
  it('a central de todos os casamentos: os títulos por tipo, o ícone, a linha do tipo e a data, sem a Comissão', async () => {
    const calls = api();
    const { container } = renderRoute({ url: PAGE });
    expect(
      await screen.findByRole('button', {
        name: /^2 grupos responderam em Ana e Marcos, não lida/,
      }),
    ).toBeInTheDocument();
    expect(calls.find((call) => call.path.startsWith('/v1/me/notifications?'))?.path).toBe(
      '/v1/me/notifications?scope=planner',
    );
    expect(screen.getByText('O que aconteceu nos seus casamentos.')).toBeInTheDocument();
    const list = container.querySelector<HTMLElement>('.kore-notifications__list');
    if (!list) throw new Error('sem a lista');
    const titles = within(list)
      .getAllByRole('button')
      .map((item) => item.querySelector('.kore-notifications__title')?.textContent);
    expect(titles).toEqual([
      '2 grupos responderam em Ana e Marcos, não lida',
      'Site de Bianca e Henrique foi publicado, não lida',
      'Sua colaboração em Priscila e Davi foi encerrada',
      'Família Moreira respondeu em Ana e Marcos',
      'Um grupo removido respondeu em Ana e Marcos',
      'Site de Ana e Marcos foi publicado, não lida',
    ]);
    expect(within(list).getAllByText(/^Novas respostas · 26\/09 às \d+h12$/)).toHaveLength(1);
    expect(within(list).getAllByText(/^Casamento publicado · 15\/09 às/)).toHaveLength(2);
    expect(within(list).getByText(/^Colaboração encerrada · 14\/09 às/)).toBeInTheDocument();
    expect(screen.queryByText(/Comissão/)).not.toBeInTheDocument();
    // O filtro sem Comissão (RN01).
    const filter = screen.getByRole('combobox', { name: 'Tipo' });
    expect(
      within(filter)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Todas', 'Novas respostas', 'Casamento publicado', 'Colaboração encerrada']);
    await expectNoA11yViolations({ container });
  });

  it('o filtro pede o tipo à API; sem resultado, "Nenhuma notificação deste tipo."', async () => {
    const user = userEvent.setup();
    const calls = api({ items: [MANY] });
    renderRoute({ url: PAGE });
    await screen.findByRole('button', { name: /2 grupos responderam/ });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'membership_removed');
    expect(await screen.findByText('Nenhuma notificação deste tipo.')).toBeInTheDocument();
    expect(calls.map((call) => call.path)).toContain(
      '/v1/me/notifications?scope=planner&type=membership_removed',
    );
    // O filtro e o Marcar todas ficam: a vazia é a do tipo.
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toBeInTheDocument();
  });

  it('vazia: o texto da Pena, sem o filtro nem o Marcar todas (Penpot 13)', async () => {
    api({ items: [] });
    renderRoute({ url: PAGE });
    expect(await screen.findByText('Você ainda não tem notificações.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Elas aparecem aqui quando os convidados responderem ou um casal publicar o site.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Tipo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar todas como lidas' })).toBeNull();
  });

  it('Marcar todas como lidas só no escopo dela, com o Toast; Carregar mais traz a página seguinte', async () => {
    const user = userEvent.setup();
    const calls = api({ items: [MANY], nextCursor: 'c2' });
    renderRoute({ url: PAGE });
    await screen.findByRole('button', { name: /2 grupos responderam/ });
    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));
    expect(
      await screen.findByRole('button', {
        name: /^Sua colaboração em Paula e Diego foi encerrada/,
      }),
    ).toBeInTheDocument();
    expect(calls.map((call) => call.path)).toContain(
      '/v1/me/notifications?scope=planner&cursor=c2',
    );
    await user.click(screen.getByRole('button', { name: 'Marcar todas como lidas' }));
    expect(
      await screen.findByText('Todas as notificações foram marcadas como lidas.'),
    ).toBeInTheDocument();
    expect(reads(calls).map((call) => call.path)).toEqual([
      '/v1/me/notifications/read-all?scope=planner',
    ]);
  });

  it.each([
    ['2 grupos responderam em Ana e Marcos', '/cerimonialista', '?casamento=w1', ['n1']],
    ['Site de Ana e Marcos foi publicado', '/cerimonialista', '?casamento=w1', ['n6']],
    ['Site de Bianca e Henrique foi publicado', '/cerimonialista/link-de-indicacao', '', ['n2']],
    ['Sua colaboração em Priscila e Davi foi encerrada', '/cerimonialista', '', []],
  ])(
    'abrir "%s" leva ao destino e marca a não lida (decisão 300(5))',
    async (title, pathname, search, read) => {
      const user = userEvent.setup();
      const calls = api();
      const { router } = renderRoute({ url: PAGE });
      // O destino é a 1ª navegação (o detalhe depois relê o casamento e pode mudar a URL).
      const visited: string[] = [];
      router.subscribe((state) => visited.push(state.location.pathname + state.location.search));
      await user.click(await screen.findByRole('button', { name: new RegExp(`^${title}`) }));
      await waitFor(() => expect(visited[0]).toBe(`${pathname}${search}`));
      await waitFor(() =>
        expect(reads(calls).map((call) => call.path)).toEqual(
          read.map((id) => `/v1/me/notifications/${id}/read`),
        ),
      );
    },
  );

  it('enquanto carrega, sem o filtro nem o Marcar todas (não piscam na vazia; sugestão do Crivo)', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockApi(async ({ path }) => {
      if (path === '/v1/me') return Response.json(me);
      if (path.startsWith('/v1/me/notifications/unread-count')) {
        return Response.json({ unreadCount: 0 });
      }
      if (path.startsWith('/v1/me/notifications?')) {
        await gate;
        return Response.json({ items: [], nextCursor: null });
      }
      return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
    });
    renderRoute({ url: PAGE });
    expect(await screen.findByText('Carregando as notificações')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Tipo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Marcar todas como lidas' })).toBeNull();
    release();
    expect(await screen.findByText('Você ainda não tem notificações.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Tipo' })).toBeNull();
  });

  it('o publicado relê o /me ao abrir: se ela saiu do casamento, vai ao Link de indicação (sugestão do Crivo)', async () => {
    const user = userEvent.setup();
    let reads = 0;
    mockApi(({ method, path }) => {
      if (path === '/v1/me') {
        reads += 1;
        // A 1ª leitura ainda tem o vínculo de w1; a do toque, não.
        return Response.json(reads === 1 ? me : { ...me, memberships: [] });
      }
      if (path.startsWith('/v1/me/notifications/unread-count')) {
        return Response.json({ unreadCount: 1 });
      }
      if (path.startsWith('/v1/me/notifications?')) {
        return Response.json({ items: [PUBLISHED_COLLABORATING], nextCursor: null });
      }
      if (method === 'POST') return new Response(null, { status: 204 });
      return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
    });
    const { router } = renderRoute({ url: PAGE });
    await user.click(await screen.findByRole('button', { name: /^Site de Ana e Marcos/ }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/cerimonialista/link-de-indicacao'),
    );
    expect(reads).toBeGreaterThan(1);
  });

  it('o sino da Área mostra as não lidas do escopo dela e abre a central (RN05)', async () => {
    const user = userEvent.setup();
    const calls = api({ unread: 3 });
    const { router } = renderRoute({ url: '/cerimonialista/modelos' });
    const bell = await screen.findByRole('button', { name: 'Notificações, 3 não lidas' });
    expect(calls.map((call) => call.path)).toContain(
      '/v1/me/notifications/unread-count?scope=planner',
    );
    await user.click(bell);
    await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
  });

  it('dentro do casamento, as Notificações levam à central dela (RN08)', async () => {
    api();
    const { router } = renderRoute({ url: '/cerimonialista/casamentos/w1/notificacoes' });
    await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
    expect(
      screen.queryByText('Por enquanto, os avisos deste casamento vão só para o casal.'),
    ).not.toBeInTheDocument();
  });
});
