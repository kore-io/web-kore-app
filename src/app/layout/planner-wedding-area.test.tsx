import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { apiError, mockApi, renderRoute } from '../../../tests/render-route';

/** Dona de w1 e colaboradora de w2: a área da colaboradora abre o w2, pela rota. */
const me = {
  user: { id: 'u1', name: 'Juliana Prado', email: 'juliana@exemplo.com', platformRole: 'none' },
  activeProfile: 'couple',
  authenticatedAt: '2026-11-05T12:00:00Z',
  memberships: [
    {
      weddingId: 'w1',
      role: 'owner',
      weddingName: 'Juliana & Pedro',
      eventDate: '2027-02-10',
      city: 'Campinas',
      state: 'SP',
    },
    {
      weddingId: 'w2',
      role: 'collaborator',
      weddingName: 'Ana & Marcos',
      eventDate: '2026-11-14',
      city: 'Campinas',
      state: 'SP',
    },
  ],
  profiles: ['couple', 'planner'],
  lastProfileOnDevice: 'couple',
  planner: null,
  referrer: null,
};

const partyItem = {
  id: 'p1',
  name: 'Família Moreira',
  contact: { guestId: 'g1', name: 'Célia Moreira', phoneMasked: '(19) 9****-3310' },
  firstGuestName: 'Célia Moreira',
  people: 3,
  counts: { confirmed: 0, declined: 0, pending: 3, pendingPlusOnes: 0 },
  deliveryStatus: 'not_sent',
  respondedAt: null,
  respondedBy: null,
  lastResponse: null,
  tags: [],
};

function mockWeddings({ parties = [partyItem] }: { parties?: object[] } = {}) {
  const asked: string[] = [];
  mockApi(({ path }) => {
    if (path === '/v1/me') return Response.json(me);
    asked.push(path);
    if (/^\/v1\/weddings\/w[12]\/tags$/.test(path)) return Response.json({ limit: 10, data: [] });
    if (/^\/v1\/weddings\/w[12]\/parties/.test(path)) {
      return Response.json({
        summary: { guests: 3, namedGuests: 3, parties: 1, confirmed: 0, declined: 0, pending: 3 },
        total: parties.length,
        data: parties,
        nextCursor: null,
      });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return asked;
}

describe('a área da colaboradora (Colaboradora RN01, RN09)', () => {
  it('a tela abre o casamento da rota, não o de dono, e os links ficam na área dela', async () => {
    const asked = mockWeddings();
    renderRoute({ url: '/cerimonialista/casamentos/w2/convidados' });
    const link = await screen.findByRole('link', { name: 'Família Moreira' });
    expect(link).toHaveAttribute('href', '/cerimonialista/casamentos/w2/convidados/grupos/p1');
    expect(asked.some((path) => path.startsWith('/v1/weddings/w2/parties'))).toBe(true);
    expect(asked.some((path) => path.startsWith('/v1/weddings/w1/'))).toBe(false);
  });

  it('a área do casal continua no casamento de dono, com os links em /app', async () => {
    const asked = mockWeddings();
    renderRoute({ url: '/app/convidados' });
    const link = await screen.findByRole('link', { name: 'Família Moreira' });
    expect(link).toHaveAttribute('href', '/app/convidados/grupos/p1');
    await waitFor(() =>
      expect(asked.some((path) => path.startsWith('/v1/weddings/w1/parties'))).toBe(true),
    );
    expect(asked.some((path) => path.startsWith('/v1/weddings/w2/'))).toBe(false);
  });

  it('na área da colaboradora, os textos ficam na versão dela, mesmo com o perfil de casal ativo', async () => {
    mockWeddings({ parties: [] });
    renderRoute({ url: '/cerimonialista/casamentos/w2/convidados' });
    expect(await screen.findByText('Este casamento ainda não tem convidados.')).toBeInTheDocument();
    expect(screen.queryByText('Vocês ainda não cadastraram convidados.')).toBeNull();
  });
});
