import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

afterEach(() => {
  vi.unstubAllGlobals();
});

const me = {
  user: {
    id: 'u1',
    name: 'Juliana Prado',
    email: 'juliana@pradoassessoria.com.br',
    platformRole: 'none',
  },
  activeProfile: 'planner',
  authenticatedAt: '2026-11-14T12:00:00Z',
  // O vínculo de w1: o Editar o site abre a moldura da colaboradora (D5a).
  memberships: [
    {
      weddingId: 'w1',
      role: 'collaborator',
      weddingName: 'Ana & Marcos',
      eventDate: '2026-11-14',
      city: 'Campinas',
      state: 'SP',
      lifecycle: {
        status: 'published',
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

const published = {
  partnerNames: ['Ana', 'Marcos'],
  eventDate: '2026-11-14',
  status: 'published',
  rsvpPercent: 80,
  origin: 'referral_link',
  slug: 'ana-e-marcos',
  stats: { guestsTotal: 120, confirmed: 80, declined: 16, pending: 24 },
  coupleInvitations: [],
  hasOwner: true,
  canEditIdentity: false,
  weddingId: 'w1',
  city: 'Campinas',
  state: 'SP',
  guestsTotal: 120,
  createdByMe: false,
  awaitingPayment: false,
  myMembershipId: 'm1',
  timezone: 'America/Sao_Paulo',
};

const awaiting = (invitations: object[], overrides: Record<string, unknown> = {}) => ({
  ...published,
  partnerNames: ['Fernanda', 'João'],
  eventDate: '2027-01-30',
  status: 'awaiting_couple',
  origin: 'created_by_me',
  slug: 'fernanda-e-joao',
  stats: { guestsTotal: 0, confirmed: 0, declined: 0, pending: 0 },
  rsvpPercent: 0,
  guestsTotal: 0,
  city: 'Vinhedo',
  hasOwner: false,
  createdByMe: true,
  canEditIdentity: true,
  coupleInvitations: invitations,
  myMembershipId: 'm1',
  ...overrides,
});

const emailInvitation = {
  id: 'i1',
  type: 'email',
  email: 'fernanda.alves@gmail.com',
  sentAt: '2026-09-20T15:00:00Z',
  expiresAt: '2026-10-20T15:00:00Z',
};
const linkInvitation = (state: 'active' | 'expired' = 'active') => ({
  id: 'i2',
  type: 'link',
  state,
  url: state === 'active' ? 'https://kore.com.br/convite/8f3a' : null,
  expiresAt: '2026-12-20T15:00:00Z',
});

type Request = { method: string; path: string; body: unknown };

function api({
  detail = published as object,
  write = () => new Response(null, { status: 204 }),
}: {
  detail?: object | (() => Response);
  write?: (request: Request) => Response;
} = {}) {
  const writes: Request[] = [];
  mockApi((request) => {
    const { method, path } = request;
    if (path === '/v1/me') return Response.json(me);
    if (path === '/v1/me/weddings') {
      return Response.json({
        summary: { active: 1, awaitingCouple: 0, awaitingPayment: 0, commissionAvailableCents: 0 },
        alerts: { pendingResponses: [], invitationsNotSent: [] },
        weddings: [],
      });
    }
    if (path === '/v1/me/weddings/w1') {
      return typeof detail === 'function' ? detail() : Response.json(detail);
    }
    if (path === '/v1/me/planner') return apiError({ status: 404, body: { error: 'X' } });
    if (method !== 'GET') {
      writes.push(request);
      return write(request);
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return writes;
}

const URL = '/cerimonialista?casamento=w1';
const panel = () => screen.getByRole('dialog', { name: /e/ });

describe('Detalhe do casamento (Meus casamentos RN08 a RN11; decisão 260)', () => {
  it.each([
    {
      stats: { guestsTotal: 150, confirmed: 1, declined: 0, pending: 149 },
      rsvpPercent: 0.67,
      first: '150 convidados · 1% respondeu',
      second: '1 confirmado · 0 recusados · 149 pendentes',
    },
    {
      stats: { guestsTotal: 1, confirmed: 0, declined: 1, pending: 0 },
      rsvpPercent: 100,
      first: '1 convidado · 100% responderam',
      second: '0 confirmados · 1 recusado · 0 pendentes',
    },
    {
      stats: { guestsTotal: 2, confirmed: 0, declined: 0, pending: 2 },
      rsvpPercent: 0,
      first: '2 convidados · 0% responderam',
      second: '0 confirmados · 0 recusados · 2 pendentes',
    },
  ])('Convidados e RSVP no singular e com zero: $first (decisão 264(A))', async (row) => {
    api({ detail: { ...published, stats: row.stats, rsvpPercent: row.rsvpPercent } });
    renderRoute({ url: URL });
    const dialog = await screen.findByRole('dialog', { name: 'Ana e Marcos' });
    expect(within(dialog).getByText(row.first)).toBeInTheDocument();
    expect(within(dialog).getByText(row.second)).toBeInTheDocument();
  });

  it('com dono: os fatos, Convidados e RSVP, Editar o site e Sair deste casamento', async () => {
    api();
    const { container, router } = renderRoute({ url: URL });
    const dialog = await screen.findByRole('dialog', { name: 'Ana e Marcos' });
    expect(within(dialog).getByText('Publicado')).toBeInTheDocument();
    expect(within(dialog).getByText('Pelo seu link')).toBeInTheDocument();
    expect(
      within(dialog).getByText('sáb., 14 de novembro de 2026 · Campinas (SP)'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('kore.com.br/ana-e-marcos · publicado')).toBeInTheDocument();
    expect(within(dialog).getByText('120 convidados · 80% responderam')).toBeInTheDocument();
    expect(
      within(dialog).getByText('80 confirmados · 16 recusados · 24 pendentes'),
    ).toBeInTheDocument();
    // Com dono: sem os convites, sem o Excluir, sem os dados básicos.
    expect(within(dialog).queryByRole('button', { name: 'Excluir este casamento' })).toBeNull();
    expect(within(dialog).queryByText('Dados básicos')).toBeNull();
    await expectNoA11yViolations({ container });
    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Editar o site' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/cerimonialista/casamentos/w1/site/dados-basicos',
      ),
    );
  });

  it('Fechar volta à lista cheia', async () => {
    const user = userEvent.setup();
    api();
    const { router } = renderRoute({ url: URL });
    const dialog = await screen.findByRole('dialog', { name: 'Ana e Marcos' });
    await user.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Sair deste casamento: a confirmação, o DELETE do próprio vínculo e o Toast (RN10; decisão 261)', async () => {
    const user = userEvent.setup();
    const writes = api();
    const { router } = renderRoute({ url: URL });
    const dialog = await screen.findByRole('dialog', { name: 'Ana e Marcos' });
    await user.click(within(dialog).getByRole('button', { name: 'Sair deste casamento' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Sair de Ana e Marcos?' });
    expect(
      within(confirm).getByText(
        'Você perde o acesso a este casamento. O casal vai receber um aviso. Sua comissão continua.',
      ),
    ).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Sair do casamento' }));
    expect(await screen.findByText('Você saiu do casamento de Ana e Marcos.')).toBeInTheDocument();
    expect(writes.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'DELETE /v1/weddings/w1/memberships/m1',
    ]);
    expect(router.state.location.search).toBe('');
  });

  it('aguardando, por e-mail: o convite, o aviso, Reenviar com o Toast e os dados básicos (RN08, RN09)', async () => {
    const user = userEvent.setup();
    // 03h30 UTC de 20/09: ainda 19/09 em Manaus, o fuso do casamento (decisão 263(2)).
    const writes = api({
      detail: awaiting([{ ...emailInvitation, sentAt: '2026-09-20T03:30:00Z' }], {
        timezone: 'America/Manaus',
      }),
    });
    renderRoute({ url: URL });
    const dialog = await screen.findByRole('dialog', { name: 'Fernanda e João' });
    expect(
      within(dialog).getByText('Convite enviado em 19/09 para fernanda.alves@gmail.com.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('O casal ainda não aceitou o convite.')).toBeInTheDocument();
    expect(within(dialog).getByText('kore.com.br/fernanda-e-joao · rascunho')).toBeInTheDocument();
    expect(within(dialog).getByText('Ainda não há convidados.')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Você pode mudar a data, a UF e o endereço até o casal aceitar o convite.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Editar dados básicos' })).toHaveAttribute(
      'href',
      '/cerimonialista/casamentos/w1/site/dados-basicos',
    );
    expect(within(dialog).queryByRole('button', { name: 'Montar o site' })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Reenviar convite' }));
    const toast = await screen.findByText('Convite reenviado para fernanda.alves@gmail.com.');
    // O painel é modal e o Toast fica fora do aria-hidden que ele põe no resto (decisão 263(1)).
    const page = document.querySelector('main');
    expect(page).not.toBeNull();
    expect(page?.closest('[aria-hidden="true"]')).toBeInstanceOf(HTMLElement);
    expect(toast.closest('[aria-hidden="true"]')).toBeNull();
    expect(writes).toEqual([
      expect.objectContaining({
        method: 'POST',
        path: '/v1/weddings/w1/access-invitations',
        body: { kind: 'couple', emails: ['fernanda.alves@gmail.com'] },
      }),
    ]);
  });

  it('o reenvio que falha mostra o erro da Voz', async () => {
    const user = userEvent.setup();
    api({
      detail: awaiting([emailInvitation]),
      write: () => apiError({ status: 503, body: { error: 'UNAVAILABLE' } }),
    });
    renderRoute({ url: URL });
    const dialog = await screen.findByRole('dialog', { name: 'Fernanda e João' });
    await user.click(within(dialog).getByRole('button', { name: 'Reenviar convite' }));
    expect(
      await screen.findByText(
        'Não foi possível reenviar agora. Verifique sua conexão e tente de novo.',
      ),
    ).toBeInTheDocument();
  });

  it('Convidar outro e-mail: o e-mail inválido no campo e o envio com o Toast', async () => {
    const user = userEvent.setup();
    const writes = api({ detail: awaiting([emailInvitation]) });
    renderRoute({ url: URL });
    const dialog = await screen.findByRole('dialog', { name: 'Fernanda e João' });
    await user.click(within(dialog).getByRole('button', { name: 'Convidar outro e-⁠mail' }));
    const invite = await screen.findByRole('dialog', { name: /^Convidar outro e/ });
    expect(
      within(invite).getByText(
        'O convite enviado para fernanda.alves@gmail.com deixa de funcionar.',
      ),
    ).toBeInTheDocument();
    const field = within(invite).getByRole('textbox', { name: 'E-⁠mail do casal' });
    await user.type(field, 'fernanda');
    await user.click(within(invite).getByRole('button', { name: 'Enviar convite' }));
    expect(within(invite).getByText('Informe um e-⁠mail válido.')).toBeInTheDocument();
    expect(writes).toEqual([]);
    await user.clear(field);
    await user.type(field, 'fe.alves@gmail.com');
    await user.click(within(invite).getByRole('button', { name: 'Enviar convite' }));
    expect(await screen.findByText('Convite enviado para fe.alves@gmail.com.')).toBeInTheDocument();
    expect(writes[0]).toMatchObject({ body: { kind: 'couple', emails: ['fe.alves@gmail.com'] } });
  });

  it('Excluir com convite por e-mail: o texto do caso, o DELETE e o Toast (RN11)', async () => {
    const user = userEvent.setup();
    const writes = api({ detail: awaiting([emailInvitation]) });
    renderRoute({ url: URL });
    const dialog = await screen.findByRole('dialog', { name: 'Fernanda e João' });
    await user.click(within(dialog).getByRole('button', { name: 'Excluir este casamento' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Excluir o casamento de Fernanda e João?',
    });
    expect(
      within(confirm).getByText(
        'O convite que você enviou ao casal deixa de funcionar e tudo o que você preparou é apagado. Não dá para desfazer.',
      ),
    ).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Excluir casamento' }));
    expect(await screen.findByText('Casamento de Fernanda e João excluído.')).toBeInTheDocument();
    expect(writes.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'DELETE /v1/weddings/w1',
    ]);
  });

  it('Excluir quando o casal acabou de aceitar: o aviso da RN11 e o detalhe relido', async () => {
    const user = userEvent.setup();
    api({
      detail: awaiting([emailInvitation]),
      write: () => apiError({ status: 409, body: { error: 'WEDDING_HAS_OWNER' } }),
    });
    renderRoute({ url: URL });
    const dialog = await screen.findByRole('dialog', { name: 'Fernanda e João' });
    await user.click(within(dialog).getByRole('button', { name: 'Excluir este casamento' }));
    await user.click(await screen.findByRole('button', { name: 'Excluir casamento' }));
    expect(
      await screen.findByText(
        'O casal acabou de aceitar o convite, então o casamento não pode mais ser excluído. Se quiser, saia deste casamento.',
      ),
    ).toBeInTheDocument();
  });

  it('o link do casal: Copiar, Gerar novo link e Cancelar link com a confirmação (RN09)', async () => {
    const user = userEvent.setup();
    const writes = api({ detail: awaiting([linkInvitation()]) });
    renderRoute({ url: URL });
    const dialog = await screen.findByRole('dialog', { name: 'Fernanda e João' });
    expect(within(dialog).getByRole('textbox', { name: 'Link para o casal' })).toHaveValue(
      'kore.com.br/convite/8f3a',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Copiar link' }));
    expect(await screen.findByText('Link copiado.')).toBeInTheDocument();
    await expect(navigator.clipboard.readText()).resolves.toBe('https://kore.com.br/convite/8f3a');
    await user.click(within(dialog).getByRole('button', { name: 'Gerar novo link' }));
    expect(
      await screen.findByText('Novo link gerado. O anterior deixou de funcionar.'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar link' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Cancelar o link do casal?' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar link' }));
    expect(await screen.findByText('Link cancelado.')).toBeInTheDocument();
    expect(writes.map(({ method, path, body }) => [method, path, body])).toEqual([
      ['POST', '/v1/weddings/w1/access-invitations', { kind: 'couple' }],
      ['DELETE', '/v1/weddings/w1/access-invitations/i2', undefined],
    ]);
  });

  it('o link vencido: "Este link venceu." e só o Gerar novo link; o Excluir com o texto do link', async () => {
    const user = userEvent.setup();
    api({ detail: awaiting([linkInvitation('expired')]) });
    renderRoute({ url: URL });
    const dialog = await screen.findByRole('dialog', { name: 'Fernanda e João' });
    expect(within(dialog).getByText('Este link venceu.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Copiar link' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Gerar novo link' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Excluir este casamento' }));
    expect(
      await screen.findByText(
        'O link que você mandou ao casal deixa de funcionar e tudo o que você preparou é apagado. Não dá para desfazer.',
      ),
    ).toBeInTheDocument();
  });

  it('Rascunho sem convite: o aviso, Montar o site, Convidar o casal e o Excluir do rascunho (A7)', async () => {
    const user = userEvent.setup();
    api({ detail: awaiting([], { status: 'draft', canEditIdentity: true }) });
    const { router } = renderRoute({ url: URL });
    const dialog = await screen.findByRole('dialog', { name: 'Fernanda e João' });
    expect(within(dialog).getByText('Você ainda não convidou o casal.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Montar o site' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Excluir este casamento' }));
    expect(
      await screen.findByText('Tudo o que você preparou é apagado. Não dá para desfazer.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(within(panel()).getByRole('button', { name: 'Convidar o casal' }));
    await waitFor(() =>
      expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(
        '/cerimonialista/casamentos/novo?casamento=w1',
      ),
    );
  });

  it('sem vínculo (404): fecha com "Este casamento não está mais disponível." (RN07 da Colaboradora)', async () => {
    api({ detail: () => apiError({ status: 404, body: { error: 'WEDDING_NOT_FOUND' } }) });
    const { router } = renderRoute({ url: URL });
    expect(await screen.findByText('Este casamento não está mais disponível.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  describe('o casamento bloqueado (Bloqueado RN04; decisão 344)', () => {
    const LOCKED = 'Indisponível enquanto o site está bloqueado.';

    it('pelo e-mail: Reenviar, Convidar outro e-mail e Excluir desabilitados com o motivo', async () => {
      api({ detail: awaiting([emailInvitation], { blocked: true }) });
      renderRoute({ url: URL });
      const dialog = await screen.findByRole('dialog', { name: 'Fernanda e João' });
      for (const name of ['Reenviar convite', /^Convidar outro e/, 'Excluir este casamento']) {
        const button = within(dialog).getByRole('button', { name });
        expect(button).toBeDisabled();
        expect(button).toHaveAccessibleDescription(LOCKED);
      }
    });

    it('pelo link: Gerar novo link e Cancelar link desabilitados; o Copiar link continua', async () => {
      api({ detail: awaiting([linkInvitation()], { blocked: true }) });
      renderRoute({ url: URL });
      const dialog = await screen.findByRole('dialog', { name: 'Fernanda e João' });
      for (const name of ['Gerar novo link', 'Cancelar link']) {
        const button = within(dialog).getByRole('button', { name });
        expect(button).toBeDisabled();
        expect(button).toHaveAccessibleDescription(LOCKED);
      }
      expect(within(dialog).getByRole('button', { name: 'Copiar link' })).toBeEnabled();
    });

    it('no rascunho sem convite, Convidar o casal desabilitado; Montar o site continua (sugestão do Crivo)', async () => {
      api({ detail: awaiting([], { status: 'draft', canEditIdentity: true, blocked: true }) });
      renderRoute({ url: URL });
      const dialog = await screen.findByRole('dialog', { name: 'Fernanda e João' });
      const invite = within(dialog).getByRole('button', { name: 'Convidar o casal' });
      expect(invite).toBeDisabled();
      expect(invite).toHaveAccessibleDescription(LOCKED);
      expect(within(dialog).getByRole('button', { name: 'Montar o site' })).toBeEnabled();
    });

    it('com dono, o Sair deste casamento continua (RN03)', async () => {
      api({ detail: { ...published, blocked: true } });
      renderRoute({ url: URL });
      const dialog = await screen.findByRole('dialog', { name: 'Ana e Marcos' });
      expect(within(dialog).getByRole('button', { name: 'Sair deste casamento' })).toBeEnabled();
    });

    it('o 403 WEDDING_BLOCKED em corrida no reenvio: o motivo no Toast, no lugar do erro do reenvio', async () => {
      const user = userEvent.setup();
      api({
        detail: awaiting([emailInvitation]),
        write: () => apiError({ status: 403, body: { error: 'WEDDING_BLOCKED' } }),
      });
      renderRoute({ url: URL });
      const dialog = await screen.findByRole('dialog', { name: 'Fernanda e João' });
      await user.click(within(dialog).getByRole('button', { name: 'Reenviar convite' }));
      expect(await screen.findByText(LOCKED)).toBeInTheDocument();
      expect(screen.queryByText(/^Não foi possível reenviar agora/)).toBeNull();
    });
  });
});
