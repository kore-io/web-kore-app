import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../tests/render-route';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const lifecycle = (status: string) => ({
  status,
  endDate: null,
  graceUntil: null,
  expiredAt: null,
  deletionScheduledFor: null,
  blocked: false,
});

const membership = (
  weddingId: string,
  role: string,
  weddingName: string,
  eventDate: string | null,
  status = 'published',
) => ({
  weddingId,
  role,
  weddingName,
  eventDate,
  city: 'Campinas',
  state: 'SP',
  lifecycle: lifecycle(status),
});

const me = (overrides: Record<string, unknown> = {}) => ({
  user: {
    id: 'u1',
    name: 'Juliana Prado',
    email: 'juliana@pradoassessoria.com.br',
    platformRole: 'none',
  },
  activeProfile: 'planner',
  authenticatedAt: '2026-11-14T12:00:00Z',
  memberships: [
    membership('w1', 'owner', 'Juliana & Pedro', '2027-02-10'),
    membership('w2', 'collaborator', 'Ana & Marcos', '2026-11-14'),
    membership('w3', 'collaborator', 'Fernanda & João', '2027-01-30', 'awaiting_couple'),
  ],
  profiles: ['couple', 'planner'],
  lastProfileOnDevice: 'planner',
  planner: { organization: 'Prado Assessoria', weddingsCount: 2 },
  referrer: null,
  plannerSignupEnabled: true,
  identities: [{ provider: 'email' }],
  ...overrides,
});

const detail = (invitations: object[]) => ({
  partnerNames: ['Fernanda', 'João'],
  eventDate: '2027-01-30',
  status: 'awaiting_couple',
  rsvpPercent: 0,
  origin: 'created_by_me',
  slug: 'fernanda-e-joao',
  stats: { guestsTotal: 0, confirmed: 0, declined: 0, pending: 0 },
  coupleInvitations: invitations,
  hasOwner: false,
  canEditIdentity: true,
  weddingId: 'w3',
  city: 'Vinhedo',
  state: 'SP',
  guestsTotal: 0,
  createdByMe: true,
  awaitingPayment: false,
  myMembershipId: 'm3',
  // Manaus, para o "Enviado em" no fuso do casamento (decisão 263(2)).
  timezone: 'America/Manaus',
});

/** O /me e o resto com 404 comum (as telas mostram os avisos delas). */
function api({
  meBody = me(),
  handler,
}: {
  meBody?: object;
  handler?: (request: { method: string; path: string }) => Response | undefined;
} = {}) {
  mockApi((request) => {
    if (request.path === '/v1/me') return Response.json(meBody);
    const custom = handler?.(request);
    if (custom) return custom;
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
}

describe('a moldura da colaboradora dentro do casamento (Colaboradora RN01 a RN07; Penpot 17)', () => {
  it('a faixa, o Voltar a Meus casamentos, a Sidebar do casal e o menu dela', async () => {
    api();
    const { container } = renderRoute({ url: '/cerimonialista/casamentos/w2' });
    expect(await screen.findByText('Você colabora neste casamento.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Você monta o site e cuida da lista. Publicar, pagar e a chave Pix são do casal.',
      ),
    ).toBeInTheDocument();
    const back = screen.getAllByRole('link', { name: 'Voltar a Meus casamentos' });
    expect(back.length).toBeGreaterThanOrEqual(2);
    back.forEach((link) => expect(link).toHaveAttribute('href', '/cerimonialista'));
    const nav = screen.getAllByRole('navigation', { name: 'Menu principal' })[0] as HTMLElement;
    expect(within(nav).getByRole('link', { name: 'Convidados' })).toHaveAttribute(
      'href',
      '/cerimonialista/casamentos/w2/convidados',
    );
    expect(within(nav).queryByRole('link', { name: 'Configurações' })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Menu do usuário' }));
    expect(await screen.findByText('Cerimonialista · Prado Assessoria')).toBeInTheDocument();
    await expectNoA11yViolations({ container });
  });

  it('o Dashboard dentro do casamento: a frase da colaboradora só na faixa, sem repetir', async () => {
    api({
      handler: ({ path }) =>
        path === '/v1/weddings/w2/dashboard'
          ? Response.json({
              role: 'collaborator',
              stats: {
                guestsTotal: 0,
                confirmed: 0,
                declined: 0,
                pending: 0,
                adultsConfirmed: 0,
                childrenConfirmed: 0,
                babiesConfirmed: 0,
                partiesPending: 0,
                rsvpPercent: 0,
                partiesTotal: 0,
              },
              delivery: { notSent: 0, sent: 0, viewed: 0, responded: 0 },
              reminderQueue: { parties: 0, guests: 0, notReminded: 0 },
              site: { slug: 'ana-e-marcos', publishedAt: null, endDate: null, status: 'draft' },
              rsvpDeadline: null,
              eventDate: null,
              daysUntilEvent: null,
              checklist: [],
              activity: [],
            })
          : undefined,
    });
    renderRoute({ url: '/cerimonialista/casamentos/w2' });
    expect(await screen.findByText('Este casamento ainda não tem convidados.')).toBeInTheDocument();
    expect(screen.getAllByText('Você colabora neste casamento.')).toHaveLength(1);
  });

  it('o seletor: só os casamentos em que colabora, o "Atual", a busca e a troca (RN02, RN06)', async () => {
    const user = userEvent.setup();
    api();
    const { router } = renderRoute({ url: '/cerimonialista/casamentos/w2/convidados' });
    const button = await screen.findByRole('button', { name: /Trocar de casamento/ });
    expect(button).toHaveTextContent('Ana & Marcos');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const items = screen.getAllByRole('link', { name: /· \d{2}\/\d{2}\/\d{4}/ });
    expect(items.map((item) => item.textContent)).toEqual([
      'Ana e Marcos · 14/11/2026Atual',
      'Fernanda e João · 30/01/2027',
    ]);
    expect(items[0]).toHaveAttribute('aria-current', 'page');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar casal' }), 'Bianca');
    expect(screen.getByText('Nenhum casamento com esse nome.')).toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox', { name: 'Buscar casal' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar casal' }), 'joao');
    await user.click(screen.getByRole('link', { name: /^Fernanda e João/ }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/cerimonialista/casamentos/w3'),
    );
  });

  it('o nome do botão tem o casal e o "Trocar de casamento" (A11)', async () => {
    api();
    renderRoute({ url: '/cerimonialista/casamentos/w2' });
    expect(
      await screen.findByRole('button', { name: 'Ana & Marcos Trocar de casamento' }),
    ).toBeInTheDocument();
  });

  it.each([390, 360])(
    'o painel do seletor cabe na tela de %i px, com 16 px de margem (DoD responsivo)',
    async (viewportWidth) => {
      const user = userEvent.setup();
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(viewportWidth);
      api();
      renderRoute({ url: '/cerimonialista/casamentos/w2' });
      const button = await screen.findByRole('button', { name: /Trocar de casamento/ });
      // O botão começa em x=68 no celular (depois do menu), como na sonda do Crivo.
      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(
        DOMRect.fromRect({ x: 68, y: 12, width: 160, height: 44 }),
      );
      await user.click(button);
      const panel = screen
        .getByRole('searchbox', { name: 'Buscar casal' })
        .closest('.kore-wedding-switcher__panel') as HTMLElement;
      const left = parseFloat(panel.style.left);
      const width = parseFloat(panel.style.width);
      expect(left).toBeGreaterThanOrEqual(16);
      expect(left + width).toBeLessThanOrEqual(viewportWidth - 16);
      expect(width).toBe(Math.min(360, viewportWidth - 32));
    },
  );

  it('sair do painel com o Tab fecha o seletor', async () => {
    const user = userEvent.setup();
    api();
    renderRoute({ url: '/cerimonialista/casamentos/w2' });
    const button = await screen.findByRole('button', { name: /Trocar de casamento/ });
    await user.click(button);
    expect(screen.getByRole('searchbox', { name: 'Buscar casal' })).toHaveFocus();
    // A busca, os dois casamentos e, depois, para fora do painel (o foco sai da página).
    await user.tab();
    await user.tab();
    await user.tab();
    await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'false'));
  });

  it('o Esc fecha o seletor e devolve o foco ao botão', async () => {
    const user = userEvent.setup();
    api();
    renderRoute({ url: '/cerimonialista/casamentos/w2' });
    const button = await screen.findByRole('button', { name: /Trocar de casamento/ });
    await user.click(button);
    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('o casamento de que ela é dona: o perfil ativo vira casal e abre /app, sem a Seleção (RN01; decisão 268)', async () => {
    const switches: unknown[] = [];
    let active = 'planner';
    mockApi(({ method, path, body }) => {
      if (path === '/v1/me') return Response.json(me({ activeProfile: active }));
      if (method === 'POST' && path === '/v1/me/active-profile') {
        switches.push(body);
        active = 'couple';
        return Response.json({ home: '/app' });
      }
      return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
    });
    const { router } = renderRoute({ url: '/cerimonialista/casamentos/w1' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(switches).toEqual([{ profile: 'couple' }]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(router.state.location.pathname).toBe('/app');
  });

  it('a dona com o perfil de casal já ativo abre /app sem trocar de perfil (RN01)', async () => {
    const posts: string[] = [];
    mockApi(({ method, path }) => {
      if (method === 'POST') posts.push(path);
      if (path === '/v1/me') return Response.json(me({ activeProfile: 'couple' }));
      return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
    });
    const { router } = renderRoute({ url: '/cerimonialista/casamentos/w1' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(posts).toEqual([]);
  });

  it('sem vínculo: volta a Meus casamentos com o aviso (RN07)', async () => {
    api();
    const { router } = renderRoute({ url: '/cerimonialista/casamentos/w9' });
    expect(await screen.findByText('Este casamento não está mais disponível.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/cerimonialista'));
  });

  it('o 404 WEDDING_NOT_FOUND de uma tela (removida pelo casal) volta a Meus casamentos (RN07)', async () => {
    api({
      handler: ({ path }) =>
        path.startsWith('/v1/weddings/w2/')
          ? apiError({ status: 404, body: { error: 'WEDDING_NOT_FOUND' } })
          : undefined,
    });
    const { router } = renderRoute({ url: '/cerimonialista/casamentos/w2/convidados' });
    expect(await screen.findByText('Este casamento não está mais disponível.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/cerimonialista'));
  });

  it('sem o perfil de cerimonialista, vai ao casamento dela em /app (RN01)', async () => {
    api({ meBody: me({ profiles: ['couple'], planner: null, activeProfile: 'couple' }) });
    const { router } = renderRoute({ url: '/cerimonialista/casamentos/w2' });
    await waitFor(() => expect(router.state.location.pathname).not.toMatch(/^\/cerimonialista/));
  });

  it('Aguardando o casal pelo e-mail: a faixa com o envio, Reenviar e Convidar outro e-mail (RN04)', async () => {
    const user = userEvent.setup();
    api({
      handler: ({ method, path }) => {
        if (path === '/v1/me/weddings/w3') {
          return Response.json(
            detail([
              {
                id: 'i1',
                type: 'email',
                email: 'fernanda.alves@gmail.com',
                sentAt: '2026-09-20T03:30:00Z',
                expiresAt: '2026-10-20T15:00:00Z',
              },
            ]),
          );
        }
        if (method === 'POST') return Response.json({ invitations: [] });
        return undefined;
      },
    });
    renderRoute({ url: '/cerimonialista/casamentos/w3' });
    expect(await screen.findByText('Aguardando o casal aceitar o convite.')).toBeInTheDocument();
    expect(
      screen.getByText('Enviamos o convite para fernanda.alves@gmail.com em 19/09.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reenviar convite' }));
    expect(
      await screen.findByText('Convite reenviado para fernanda.alves@gmail.com.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Convidar outro e/ })).toBeInTheDocument();
  });

  it('Aguardando o casal pelo link: "vale até" e Ver o link para o casal, que abre o detalhe (RN04)', async () => {
    api({
      handler: ({ path }) =>
        path === '/v1/me/weddings/w3'
          ? Response.json(
              detail([
                {
                  id: 'i2',
                  type: 'link',
                  state: 'active',
                  url: 'https://kore.com.br/convite/8f3a',
                  expiresAt: '2026-12-20T15:00:00Z',
                },
              ]),
            )
          : undefined,
    });
    renderRoute({ url: '/cerimonialista/casamentos/w3' });
    expect(await screen.findByText('O convite foi por link e vale até 20/12.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver o link para o casal' })).toHaveAttribute(
      'href',
      '/cerimonialista?casamento=w3',
    );
  });
});
