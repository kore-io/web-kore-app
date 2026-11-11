import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderAreaScreen, renderRoute } from '../../../../tests/render-route';
import { trashDates } from './trash-page';

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

const items = [
  {
    type: 'party',
    id: 'p9',
    name: 'Amigos do vôlei',
    guests: 4,
    deletedAt: '2026-09-21T15:00:00Z',
    purgeAt: '2026-10-21',
  },
  {
    type: 'guest',
    id: 'g9',
    name: 'Bruno Lima',
    partyName: 'Família Rocha',
    deletedAt: '2026-09-18T15:00:00Z',
    purgeAt: '2026-10-18',
  },
  {
    type: 'tag',
    id: 't9',
    name: 'Vizinhos',
    guests: 1,
    deletedAt: '2026-09-15T15:00:00Z',
    purgeAt: '2026-10-15',
  },
];

type Call = { method: string; path: string; body: unknown };

function mockTrash({
  restore,
  start = items,
}: { restore?: (call: Call) => Response; start?: typeof items } = {}) {
  const calls: Call[] = [];
  let current = [...start];
  mockApi((call) => {
    const { method, path, body } = call;
    if (path === '/v1/me') return Response.json(meFor(me));
    if (path === '/v1/weddings/w1/tags') return Response.json({ limit: 10, data: [] });
    if (path === '/v1/weddings/w1/parties?limit=1') {
      return Response.json({
        summary: { guests: 0, namedGuests: 0, parties: 0, confirmed: 0, declined: 0, pending: 0 },
        total: 0,
        data: [],
        nextCursor: null,
      });
    }
    if (method === 'GET' && path === '/v1/weddings/w1/trash')
      return Response.json({ data: current });
    if (method === 'POST' && path === '/v1/weddings/w1/trash/restore') {
      calls.push(call);
      if (restore) return restore(call);
      const { id } = body as { id: string };
      const found = current.find((item) => item.id === id);
      current = current.filter((item) => item.id !== id);
      return Response.json({ type: found?.type, id, name: found?.name });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

describe('Convidados › Lixeira (Lixeira de convidados, RN08 e RN09)', () => {
  it('as datas: "apagado depois de" é o purgeAt; "removido em", 30 dias antes', () => {
    expect(trashDates({ purgeAt: '2026-10-21' })).toEqual({ purge: '21/10', removed: '21/09' });
    expect(trashDates({ purgeAt: '2026-03-02' })).toEqual({ purge: '02/03', removed: '31/01' });
  });

  it('mostra o aviso e os itens com os textos da RN03 a RN05, e a aba ativa', async () => {
    mockTrash();
    renderRoute({ url: '/app/convidados/lixeira' });
    expect(await screen.findByText('Grupo · Amigos do vôlei')).toBeInTheDocument();
    expect(
      screen.getByText('Itens na lixeira são apagados de vez depois de 30 dias.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Restaurar devolve o item com as respostas e as tags que ele tinha.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('4 convidados · removido em 21/09 · apagado depois de 21/10'),
    ).toBeInTheDocument();
    expect(screen.getByText('Convidado · Bruno Lima')).toBeInTheDocument();
    expect(
      screen.getByText('do grupo Família Rocha · removido em 18/09 · apagado depois de 18/10'),
    ).toBeInTheDocument();
    expect(screen.getByText('Tag · Vizinhos')).toBeInTheDocument();
    expect(
      screen.getByText('1 convidado · removida em 15/09 · apagada depois de 15/10'),
    ).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Convidados' });
    expect(within(tabs).getByRole('link', { current: 'page' })).toHaveTextContent('Lixeira');
    const restores = screen.getAllByRole('button', { name: 'Restaurar' });
    expect(restores).toHaveLength(3);
    expect(restores[1]).toHaveAccessibleDescription('Convidado · Bruno Lima');
    // Sem "Esvaziar lixeira": o expurgo é só o automático (decisão 208).
    expect(screen.queryByRole('button', { name: /Esvaziar/ })).toBeNull();
    expect(screen.queryByText(/Esvaziar/)).toBeNull();
  });

  it('restaurar o grupo: o Toast "{nome} voltou para a lista." e o item sai (RN09)', async () => {
    const user = userEvent.setup();
    const calls = mockTrash();
    renderRoute({ url: '/app/convidados/lixeira' });
    const item = (await screen.findByText('Grupo · Amigos do vôlei')).closest('li') as HTMLElement;
    await user.click(within(item).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByText('Amigos do vôlei voltou para a lista.')).toBeInTheDocument();
    expect(calls.map((call) => call.body)).toEqual([{ type: 'party', id: 'p9' }]);
    await waitFor(() => expect(screen.queryByText('Grupo · Amigos do vôlei')).toBeNull());
  });

  it('restaurar a tag: "A tag Vizinhos voltou."', async () => {
    const user = userEvent.setup();
    mockTrash();
    renderRoute({ url: '/app/convidados/lixeira' });
    const item = (await screen.findByText('Tag · Vizinhos')).closest('li') as HTMLElement;
    await user.click(within(item).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByText('A tag Vizinhos voltou.')).toBeInTheDocument();
  });

  it('tag com 10 ativas: o aviso do casal (409 TAG_LIMIT_REACHED)', async () => {
    const user = userEvent.setup();
    mockTrash({ restore: () => apiError({ status: 409, body: { error: 'TAG_LIMIT_REACHED' } }) });
    renderRoute({ url: '/app/convidados/lixeira' });
    const item = (await screen.findByText('Tag · Vizinhos')).closest('li') as HTMLElement;
    await user.click(within(item).getByRole('button', { name: 'Restaurar' }));
    expect(
      await screen.findByText('Vocês já têm 10 tags. Excluam uma para restaurar esta.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Tag · Vizinhos')).toBeInTheDocument();
  });

  it('tag com o nome de uma ativa: o aviso com o nome da ativa (409 TAG_NAME_TAKEN)', async () => {
    const user = userEvent.setup();
    mockTrash({
      restore: () =>
        apiError({ status: 409, body: { error: 'TAG_NAME_TAKEN', conflictName: 'VIZINHOS' } }),
    });
    renderRoute({ url: '/app/convidados/lixeira' });
    const item = (await screen.findByText('Tag · Vizinhos')).closest('li') as HTMLElement;
    await user.click(within(item).getByRole('button', { name: 'Restaurar' }));
    expect(
      await screen.findByText('Já existe uma tag VIZINHOS. Mudem o nome dela para restaurar esta.'),
    ).toBeInTheDocument();
  });

  it('vazia: "A lixeira está vazia.", sem botão (decisão 208)', async () => {
    mockTrash({ start: [] });
    renderRoute({ url: '/app/convidados/lixeira' });
    expect(await screen.findByText('A lixeira está vazia.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restaurar' })).toBeNull();
    expect(
      screen.getByText('Itens na lixeira são apagados de vez depois de 30 dias.'),
    ).toBeInTheDocument();
  });

  it('item que outra pessoa já restaurou (404): o aviso e a lista recarrega sem ele', async () => {
    const user = userEvent.setup();
    let gone = false;
    mockTrash({
      restore: () => {
        gone = true;
        return apiError({ status: 404, body: { error: 'TRASH_ITEM_NOT_FOUND' } });
      },
    });
    const original = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await original(input, init);
      if (gone && String(input).endsWith('/trash') && (init?.method ?? 'GET') === 'GET') {
        return Response.json({ data: items.filter((item) => item.id !== 'p9') });
      }
      return response;
    });
    renderRoute({ url: '/app/convidados/lixeira' });
    const item = (await screen.findByText('Grupo · Amigos do vôlei')).closest('li') as HTMLElement;
    await user.click(within(item).getByRole('button', { name: 'Restaurar' }));
    expect(
      await screen.findByText('Não foi possível continuar. Confira sua conexão e tente de novo.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Grupo · Amigos do vôlei')).toBeNull());
  });

  it('é acessível', async () => {
    mockTrash();
    const { container } = renderRoute({ url: '/app/convidados/lixeira' });
    await screen.findByText('Grupo · Amigos do vôlei');
    await expectNoA11yViolations({ container });
  });
  it('cerimonialista: os avisos de tag no singular (TAG_LIMIT_REACHED e TAG_NAME_TAKEN; 198(2))', async () => {
    profileUnderTest.current = 'planner';
    const user = userEvent.setup();
    let answer = apiError({ status: 409, body: { error: 'TAG_LIMIT_REACHED' } });
    mockTrash({ restore: () => answer });
    renderAreaScreen({ url: '/app/convidados/lixeira' });
    const item = (await screen.findByText('Tag · Vizinhos')).closest('li') as HTMLElement;
    await user.click(within(item).getByRole('button', { name: 'Restaurar' }));
    expect(
      await screen.findByText('Este casamento já tem 10 tags. Exclua uma para restaurar esta.'),
    ).toBeInTheDocument();
    answer = apiError({ status: 409, body: { error: 'TAG_NAME_TAKEN', conflictName: 'VIZINHOS' } });
    await user.click(within(item).getByRole('button', { name: 'Restaurar' }));
    expect(
      await screen.findByText('Já existe uma tag VIZINHOS. Mude o nome dela para restaurar esta.'),
    ).toBeInTheDocument();
  });
});
