import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';
import type { PartyListItemResponse } from '../../../shared/api/generated/model';

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

const row: PartyListItemResponse = {
  id: 'p1',
  name: 'Família Moreira',
  contact: { guestId: 'g2', name: 'Célia Moreira', phoneMasked: '(19) 9****-3310' },
  firstGuestName: 'Luiz Moreira',
  people: 3,
  counts: { confirmed: 0, declined: 0, pending: 3, pendingPlusOnes: 1 },
  deliveryStatus: 'not_sent',
  respondedAt: null,
  respondedBy: null,
  lastResponse: null,
  tags: [],
};

const detail = {
  id: 'p1',
  name: 'Família Moreira',
  contactGuestId: 'g2',
  internalNote: null,
  plusOneSlots: 1,
  deliveryStatus: 'not_sent',
  tags: [],
  history: [],
  link: { url: 'http://localhost:5174/ana-e-marcos/grupo/abc', regeneratedAt: null },
  guests: [
    {
      id: 'g1',
      name: 'Luiz Moreira',
      ageGroup: 'adult',
      dietaryRestriction: null,
      phone: null,
      email: null,
      phoneMasked: null,
      emailMasked: null,
      rsvpStatus: 'pending',
      tags: [],
      isPlusOne: false,
    },
    {
      id: 'g2',
      name: 'Célia Moreira',
      ageGroup: 'adult',
      dietaryRestriction: null,
      phone: null,
      email: null,
      phoneMasked: null,
      emailMasked: null,
      rsvpStatus: 'pending',
      tags: [],
      isPlusOne: false,
    },
    {
      id: 'g3',
      name: null,
      ageGroup: null,
      dietaryRestriction: null,
      phone: null,
      email: null,
      phoneMasked: null,
      emailMasked: null,
      rsvpStatus: 'pending',
      tags: [],
      isPlusOne: true,
    },
  ],
};

function mockRow({
  trash = () => new Response(null, { status: 204 }),
}: { trash?: () => Response } = {}) {
  const calls: string[] = [];
  mockApi(({ method, path }) => {
    if (path === '/v1/me') return Response.json(me);
    if (path === '/v1/weddings/w1/tags') return Response.json({ limit: 10, data: [] });
    if (method === 'GET' && path === '/v1/weddings/w1/parties/p1') return Response.json(detail);
    if (method === 'GET' && path.startsWith('/v1/weddings/w1/parties')) {
      return Response.json({
        summary: { guests: 3, namedGuests: 2, parties: 1, confirmed: 0, declined: 0, pending: 3 },
        total: 1,
        data: [row],
        nextCursor: null,
      });
    }
    calls.push(`${method} ${path}`);
    if (method === 'DELETE' && path === '/v1/weddings/w1/parties/p1') return trash();
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Ações de Família Moreira' }));
  return screen.getByRole('menu');
}

describe('Convidados › ⋮ da linha (decisões 199(2) e 200(1))', () => {
  it('os itens: Abrir, Editar grupo, Copiar link e Mover para a lixeira', async () => {
    const user = userEvent.setup();
    mockRow();
    renderRoute({ url: '/app/convidados' });
    const menu = await openMenu(user);
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Abrir', 'Editar grupo', 'Copiar link', 'Mover para a lixeira']);
  });

  it('Abrir leva ao Painel e Editar grupo, ao formulário', async () => {
    const user = userEvent.setup();
    mockRow();
    const { router } = renderRoute({ url: '/app/convidados' });
    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Abrir' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/convidados/grupos/p1'));
    await router.navigate('/app/convidados');
    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Editar grupo' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/app/convidados/grupos/p1/editar'),
    );
  });

  it('Copiar link busca o link do grupo e copia, com "Link copiado."', async () => {
    const user = userEvent.setup();
    mockRow();
    renderRoute({ url: '/app/convidados' });
    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Copiar link' }));
    expect(await screen.findByText('Link copiado.')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(
      'http://localhost:5174/ana-e-marcos/grupo/abc',
    );
  });

  it('Mover para a lixeira abre o Dialog com os convidados com nome e move (Lixeira RN02)', async () => {
    const user = userEvent.setup();
    const calls = mockRow();
    renderRoute({ url: '/app/convidados' });
    await user.click(
      within(await openMenu(user)).getByRole('menuitem', { name: 'Mover para a lixeira' }),
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Mover o grupo Família Moreira para a lixeira?',
    });
    expect(dialog).toHaveTextContent(
      'O grupo e os 2 convidados ficam 30 dias na lixeira e saem das contagens. Depois, são apagados de vez.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Mover para a lixeira' }));
    await waitFor(() => expect(calls).toEqual(['DELETE /v1/weddings/w1/parties/p1']));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('Cancelar fecha o Dialog sem mover, e o foco volta ao ⋮', async () => {
    const user = userEvent.setup();
    const calls = mockRow();
    renderRoute({ url: '/app/convidados' });
    await user.click(
      within(await openMenu(user)).getByRole('menuitem', { name: 'Mover para a lixeira' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Ações de Família Moreira' })).toHaveFocus(),
    );
    expect(calls).toHaveLength(0);
  });

  it('é acessível com o menu aberto', async () => {
    const user = userEvent.setup();
    mockRow();
    renderRoute({ url: '/app/convidados' });
    await openMenu(user);
    // O Radix põe o menu num portal fora dos landmarks; a regra region vale para a página.
    await expectNoA11yViolations({ container: document.body, disabledRules: ['region'] });
  });
});
