import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';
import type { PartyListItemResponse, PartyResponse } from '../../../shared/api/generated/model';

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

function guest(id: string, name: string | null) {
  return {
    id,
    name,
    ageGroup: null,
    dietaryRestriction: null,
    phone: null,
    email: null,
    phoneMasked: null,
    emailMasked: null,
    rsvpStatus: 'pending' as const,
    tags: [],
    isPlusOne: name === null,
  };
}

const moreira: PartyResponse = {
  id: 'p1',
  name: 'Família Moreira',
  contactGuestId: null,
  internalNote: null,
  tags: [],
  deliveryStatus: 'not_sent',
  plusOneSlots: 0,
  history: [],
  link: { url: null, regeneratedAt: null },
  guests: [guest('g1', 'Luiz Moreira'), guest('g2', 'Célia Moreira'), guest('g3', 'Pedro Moreira')],
};

function item(id: string, name: string, people = 1): PartyListItemResponse {
  return {
    id,
    name,
    contact: null,
    firstGuestName: name,
    people,
    counts: { confirmed: 0, declined: 0, pending: people, pendingPlusOnes: 0 },
    deliveryStatus: 'not_sent',
    respondedAt: null,
    respondedBy: null,
    tags: [],
  };
}

type Call = { method: string; path: string; body: unknown };

function mockAll({
  party = moreira,
  write,
}: { party?: PartyResponse; write?: (call: Call) => Response | undefined } = {}) {
  const calls: Call[] = [];
  let current = party;
  mockApi((call) => {
    const { method, path } = call;
    if (path === '/v1/me') return Response.json(me);
    if (path === '/v1/weddings/w1/tags') return Response.json({ limit: 10, data: [] });
    if (method === 'GET' && path === '/v1/weddings/w1/parties/p1') return Response.json(current);
    if (method === 'GET' && path.startsWith('/v1/weddings/w1/parties')) {
      return Response.json({
        summary: { guests: 5, namedGuests: 5, parties: 3, confirmed: 0, declined: 0, pending: 5 },
        total: 3,
        data: [item('p1', 'Família Moreira', 3), item('p2', 'Tio Jorge'), item('p3', 'Vó Helena')],
        nextCursor: null,
      });
    }
    calls.push(call);
    const custom = write?.(call);
    if (custom) return custom;
    if (method === 'DELETE' && path === '/v1/weddings/w1/guests/g3') {
      current = { ...current, guests: current.guests.filter((g) => g.id !== 'g3') };
      return new Response(null, { status: 204 });
    }
    if (method === 'DELETE' && path === '/v1/weddings/w1/parties/p1')
      return new Response(null, { status: 204 });
    if (method === 'POST' && path === '/v1/weddings/w1/parties/trash') {
      return Response.json({
        trashed: (call.body as { partyIds: string[] }).partyIds.length,
        skipped: [],
      });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

describe('Mover para a lixeira (Lixeira RN02 a RN07)', () => {
  it('o grupo, pelo Painel: confirma com o texto da RN02, apaga e volta à lista com o Toast', async () => {
    const user = userEvent.setup();
    const calls = mockAll();
    const { router } = renderRoute({ url: '/app/convidados/grupos/p1' });
    await user.click(await screen.findByRole('button', { name: 'Mover para a lixeira' }));
    const dialog = screen.getByRole('alertdialog', {
      name: 'Mover o grupo Família Moreira para a lixeira?',
    });
    expect(dialog).toHaveAccessibleDescription(
      'O grupo e os 3 convidados ficam 30 dias na lixeira e saem das contagens. Depois, são apagados de vez.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Mover para a lixeira' }));
    expect(await screen.findByText('Família Moreira foi para a lixeira.')).toBeInTheDocument();
    expect(calls).toEqual([
      { method: 'DELETE', path: '/v1/weddings/w1/parties/p1', body: undefined },
    ]);
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/convidados'));
  });

  it('grupo de um convidado: "O grupo e o convidado dele…"', async () => {
    const user = userEvent.setup();
    mockAll({ party: { ...moreira, guests: [guest('g1', 'Luiz Moreira'), guest('v1', null)] } });
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await user.click(await screen.findByRole('button', { name: 'Mover para a lixeira' }));
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(
      'O grupo e o convidado dele ficam 30 dias na lixeira e saem das contagens. Depois, são apagados de vez.',
    );
  });

  it('Cancelar não apaga', async () => {
    const user = userEvent.setup();
    const calls = mockAll();
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await user.click(await screen.findByRole('button', { name: 'Mover para a lixeira' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(calls).toHaveLength(0);
  });

  it('o convidado, pelo ⋮: confirma, apaga e o Painel fica sem ele (RN04)', async () => {
    const user = userEvent.setup();
    const calls = mockAll();
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await user.click(await screen.findByRole('button', { name: 'Ações de Pedro Moreira' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mover para a lixeira' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Mover Pedro Moreira para a lixeira?' });
    expect(dialog).toHaveAccessibleDescription(
      'O convidado fica 30 dias na lixeira e sai das contagens. Depois, é apagado de vez.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Mover para a lixeira' }));
    expect(await screen.findByText('Pedro Moreira foi para a lixeira.')).toBeInTheDocument();
    expect(calls).toEqual([
      { method: 'DELETE', path: '/v1/weddings/w1/guests/g3', body: undefined },
    ]);
    await waitFor(() => expect(screen.queryByText('Pedro Moreira')).toBeNull());
  });

  it('o último convidado com nome não vai: o aviso da RN08, sem Dialog nem API', async () => {
    const user = userEvent.setup();
    const calls = mockAll({ party: { ...moreira, guests: [guest('g1', 'Luiz Moreira')] } });
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await user.click(await screen.findByRole('button', { name: 'Ações de Luiz Moreira' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mover para a lixeira' }));
    expect(
      await screen.findByText(
        'O grupo precisa de pelo menos um convidado. Para tirar todos, movam o grupo para a lixeira.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('quem já respondeu: o 403 ALREADY_RESPONDED vira o texto da RN07', async () => {
    const user = userEvent.setup();
    mockAll({ write: () => apiError({ status: 403, body: { error: 'ALREADY_RESPONDED' } }) });
    renderRoute({ url: '/app/convidados/grupos/p1' });
    await user.click(await screen.findByRole('button', { name: 'Ações de Pedro Moreira' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mover para a lixeira' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Mover para a lixeira' }),
    );
    expect(
      await screen.findByText('Só o casal pode excluir quem já respondeu.'),
    ).toBeInTheDocument();
  });

  it('a seleção com vários grupos: "Mover 2 grupos para a lixeira?" e o Toast (RN06)', async () => {
    const user = userEvent.setup();
    const calls = mockAll();
    renderRoute({ url: '/app/convidados' });
    await screen.findByRole('table');
    await user.click(screen.getByRole('checkbox', { name: 'Selecionar Tio Jorge' }));
    await user.click(screen.getByRole('checkbox', { name: 'Selecionar Vó Helena' }));
    await user.click(screen.getByRole('button', { name: 'Mover para a lixeira' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Mover 2 grupos para a lixeira?' });
    expect(dialog).toHaveAccessibleDescription(
      'Os grupos e os convidados deles ficam 30 dias na lixeira e saem das contagens. Depois, são apagados de vez.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Mover para a lixeira' }));
    expect(await screen.findByText('2 grupos foram para a lixeira.')).toBeInTheDocument();
    expect(calls).toEqual([
      { method: 'POST', path: '/v1/weddings/w1/parties/trash', body: { partyIds: ['p2', 'p3'] } },
    ]);
    await waitFor(() => expect(screen.queryByText(/selecionad/)).toBeNull());
  });

  it('a seleção com 1 grupo usa o Dialog do grupo, com o nome', async () => {
    const user = userEvent.setup();
    mockAll();
    renderRoute({ url: '/app/convidados' });
    await screen.findByRole('table');
    await user.click(screen.getByRole('checkbox', { name: 'Selecionar Família Moreira' }));
    await user.click(screen.getByRole('button', { name: 'Mover para a lixeira' }));
    const dialog = screen.getByRole('alertdialog', {
      name: 'Mover o grupo Família Moreira para a lixeira?',
    });
    expect(dialog).toHaveAccessibleDescription(
      'O grupo e os 3 convidados ficam 30 dias na lixeira e saem das contagens. Depois, são apagados de vez.',
    );
  });

  it('os que já responderam ficam, e o Toast avisa na mesma frase (RN07)', async () => {
    const user = userEvent.setup();
    mockAll({
      write: ({ path }) =>
        path.endsWith('/parties/trash')
          ? Response.json({
              trashed: 1,
              skipped: [{ id: 'p3', name: 'Vó Helena', reason: 'ALREADY_RESPONDED' }],
            })
          : undefined,
    });
    renderRoute({ url: '/app/convidados' });
    await screen.findByRole('table');
    await user.click(screen.getByRole('checkbox', { name: 'Selecionar Tio Jorge' }));
    await user.click(screen.getByRole('checkbox', { name: 'Selecionar Vó Helena' }));
    await user.click(screen.getByRole('button', { name: 'Mover para a lixeira' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Mover para a lixeira' }),
    );
    expect(
      await screen.findByText(
        '1 grupo foi para a lixeira. 1 grupo que já respondeu ficou: só o casal pode excluí-lo.',
      ),
    ).toBeInTheDocument();
  });
});
