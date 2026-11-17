import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

// O relógio fixo em 2026: o "Desde 05/08" leva o ano quando ele não é o corrente (decisão 274).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-16T15:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const lifecycle = {
  status: 'published',
  endDate: null,
  graceUntil: null,
  expiredAt: null,
  deletionScheduledFor: null,
  blocked: false,
};

const membership = (weddingId: string, role: string, weddingName: string) => ({
  weddingId,
  role,
  weddingName,
  eventDate: '2027-01-30',
  city: 'Campinas',
  state: 'SP',
  lifecycle,
});

const coupleMe = {
  user: { id: 'u1', name: 'Ana Beatriz Moreira', email: 'ana@exemplo.com', platformRole: 'none' },
  activeProfile: 'couple',
  authenticatedAt: '2026-11-14T12:00:00Z',
  memberships: [membership('w1', 'owner', 'Ana & Marcos')],
  profiles: ['couple'],
  lastProfileOnDevice: 'couple',
  planner: null,
  referrer: null,
  plannerSignupEnabled: true,
  identities: [{ provider: 'email' }],
};

const plannerMe = {
  ...coupleMe,
  user: { id: 'u3', name: 'Juliana Prado', email: 'juliana@exemplo.com', platformRole: 'none' },
  activeProfile: 'planner',
  memberships: [membership('w1', 'collaborator', 'Ana & Marcos')],
  profiles: ['planner'],
  lastProfileOnDevice: 'planner',
  planner: { organization: 'Prado Assessoria', weddingsCount: 1 },
};

const members = ({
  meId,
  withPlanner = true,
  pendingInvitations = [],
}: {
  meId: string;
  withPlanner?: boolean;
  pendingInvitations?: object[];
}) => ({
  members: [
    { id: 'm1', name: 'Ana Beatriz Moreira', role: 'owner', since: '2026-08-01T12:00:00Z' },
    { id: 'm2', name: 'Marcos Vinícius Rocha', role: 'owner', since: '2026-08-11T12:00:00Z' },
    {
      id: 'm3',
      name: 'Juliana Prado',
      role: 'collaborator',
      kind: 'planner',
      since: '2026-08-05T12:00:00Z',
    },
    {
      id: 'm4',
      name: 'Lucas Dias',
      role: 'collaborator',
      kind: 'seller',
      since: '2026-07-01T12:00:00Z',
    },
  ]
    .filter((member) => withPlanner || member.id !== 'm3')
    .map((member) => ({ ...member, isMe: member.id === meId })),
  pendingInvitations,
});

type Call = { method: string; path: string; body?: unknown };

function api({
  me,
  meId,
  remove,
  send,
  withPlanner,
  pendingInvitations,
  site,
}: {
  me: object;
  meId: string;
  remove?: () => Response;
  send?: () => Response;
  withPlanner?: boolean;
  pendingInvitations?: object[];
  site?: { status: string; plannerCredit: object | null };
}) {
  const calls: Call[] = [];
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(me);
    if (path === '/v1/weddings/w1/memberships') {
      return Response.json(
        members({
          meId,
          ...(withPlanner !== undefined && { withPlanner }),
          ...(pendingInvitations && { pendingInvitations }),
        }),
      );
    }
    if (site && path === '/v1/weddings/w1/site') return Response.json(site);
    if (method === 'POST' && path === '/v1/weddings/w1/access-invitations') {
      calls.push({ method, path, body });
      return send?.() ?? Response.json({ invitations: [] }, { status: 201 });
    }
    if (path === '/v1/me/weddings/w1') {
      return Response.json({ partnerNames: ['Ana Beatriz', 'Marcos'], status: 'published' });
    }
    if (method === 'DELETE') {
      calls.push({ method, path });
      return remove?.() ?? new Response(null, { status: 204 });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

describe('Colaboradores › versão do casal (Papéis RN02, RN06a; decisões 270 e 271; Penpot 23)', () => {
  it('o Casal e a Cerimonialista com o "Desde", os rodapés e sem o vendedor', async () => {
    api({ me: coupleMe, meId: 'm1' });
    const { container } = renderRoute({ url: '/app/colaboradores' });
    expect(await screen.findByRole('heading', { name: 'Colaboradores', level: 1 })).toBeVisible();
    expect(screen.getByText('Quem tem acesso a este casamento.')).toBeInTheDocument();
    const couple = await screen.findByRole('region', { name: 'Casal' });
    expect(within(couple).getByText('Ana Beatriz Moreira')).toBeInTheDocument();
    expect(within(couple).getByText('Marcos Vinícius Rocha')).toBeInTheDocument();
    expect(
      within(couple).getByText(
        'Vocês têm as mesmas permissões: publicar, pagar e trocar a chave Pix.',
      ),
    ).toBeInTheDocument();
    const planner = screen.getByRole('region', { name: 'Cerimonialista' });
    expect(within(planner).getByText('Juliana Prado')).toBeInTheDocument();
    expect(within(planner).getByText('Desde 05/08')).toBeInTheDocument();
    expect(
      within(planner).getByText(
        'Quem faz o cerimonial monta o site e cuida da lista. Publicar, pagar e a chave Pix são do casal.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Lucas Dias')).toBeNull();
    expect(
      within(
        screen.getAllByRole('navigation', { name: 'Menu principal' })[0] as HTMLElement,
      ).getByRole('link', { name: 'Colaboradores' }),
    ).toHaveAttribute('aria-current', 'page');
    await expectNoA11yViolations({ container });
  });

  it('Remover: a confirmação, o DELETE e o Toast (decisão 271(3))', async () => {
    const user = userEvent.setup();
    const calls = api({ me: coupleMe, meId: 'm1' });
    renderRoute({ url: '/app/colaboradores' });
    await user.click(await screen.findByRole('button', { name: 'Remover Juliana Prado' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Remover Juliana Prado?' });
    expect(
      within(dialog).getByText(
        'Juliana Prado perde o acesso a este casamento. O site e a lista continuam como estão.',
      ),
    ).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Remover' }));
    expect(
      await screen.findByText('Juliana Prado não tem mais acesso ao casamento.'),
    ).toBeInTheDocument();
    expect(calls).toEqual([{ method: 'DELETE', path: '/v1/weddings/w1/memberships/m3' }]);
  });

  it('o 409 RECENT_ACCESS_CHANGE: o texto da RN06a com a data em que libera', async () => {
    const user = userEvent.setup();
    api({
      me: coupleMe,
      meId: 'm1',
      remove: () =>
        apiError({
          status: 409,
          body: { error: 'RECENT_ACCESS_CHANGE', availableAt: '2026-11-16T17:00:00Z' },
        }),
    });
    renderRoute({ url: '/app/colaboradores' });
    await user.click(await screen.findByRole('button', { name: 'Remover Juliana Prado' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remover' }),
    );
    expect(
      await screen.findByText(
        'Não dá para remover ninguém do casamento agora. Por segurança, isso só pode ser feito 48 horas depois da troca do e-\u2060mail de acesso. Disponível a partir de 16 de nov. às 14h.',
      ),
    ).toBeInTheDocument();
  });
});

describe('Colaboradores › Convidar cerimonialista do casal (Convites de acesso RN02; decisões 276 e 277)', () => {
  const emailBox = (dialog: HTMLElement) =>
    within(dialog).getByRole('textbox', { name: /^E-⁠?mail$/ });

  it('sem cerimonialista: o vazio, o Dialog, as validações do app, o POST e o Toast', async () => {
    const user = userEvent.setup();
    const calls = api({ me: coupleMe, meId: 'm1', withPlanner: false });
    const { container } = renderRoute({ url: '/app/colaboradores' });
    const planners = await screen.findByRole('region', { name: 'Cerimonialista' });
    expect(
      within(planners).getByText('Este casamento ainda não tem cerimonialista.'),
    ).toBeInTheDocument();
    expect(within(planners).queryByText(/Quem faz o cerimonial/)).toBeNull();
    await expectNoA11yViolations({ container });
    await user.click(within(planners).getByRole('button', { name: 'Convidar cerimonialista' }));
    const dialog = screen.getByRole('dialog', { name: 'Convidar cerimonialista' });
    expect(dialog).toHaveAccessibleDescription(
      'Quem aceitar monta o site e cuida da lista com vocês. O convite vale por 30 dias.',
    );
    // Rascunho: sem o aviso da assinatura (decisão 277).
    expect(within(dialog).queryByText(/O site já está no ar/)).toBeNull();
    await user.type(emailBox(dialog), 'juliana');
    await user.click(within(dialog).getByRole('button', { name: 'Enviar convite' }));
    expect(emailBox(dialog)).toHaveAccessibleDescription('Informe um e-⁠mail válido.');
    // O próprio e-mail só no app (decisão 277).
    await user.clear(emailBox(dialog));
    await user.type(emailBox(dialog), 'ANA@exemplo.com');
    await user.click(within(dialog).getByRole('button', { name: 'Enviar convite' }));
    expect(emailBox(dialog)).toHaveAccessibleDescription(
      'Este é o e-⁠mail da sua conta. Use o e-⁠mail de quem faz o cerimonial.',
    );
    expect(calls).toEqual([]);
    await user.clear(emailBox(dialog));
    await user.type(emailBox(dialog), 'juliana@prado.com.br');
    await user.click(within(dialog).getByRole('button', { name: 'Enviar convite' }));
    expect(
      await screen.findByText('Convite enviado para juliana@prado.com.br.'),
    ).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/v1/weddings/w1/access-invitations',
        body: { kind: 'planner', emails: ['juliana@prado.com.br'] },
      },
    ]);
  });

  it.each([
    ['publicado, assinatura não ocultada', 'published', null, true],
    ['depois do evento (ainda no ar)', 'post_event', { showPlannerCredit: true }, true],
    ['na carência (ainda no ar)', 'grace', null, true],
    ['publicado, assinatura ocultada pelo casal', 'published', { showPlannerCredit: false }, false],
    ['rascunho', 'draft', null, false],
  ])(
    'o aviso da assinatura no Dialog: %s (C7-6; decisão 277)',
    async (_, status, credit, shown) => {
      const user = userEvent.setup();
      api({
        me: coupleMe,
        meId: 'm1',
        withPlanner: false,
        site: { status, plannerCredit: credit },
      });
      renderRoute({ url: '/app/colaboradores' });
      await user.click(await screen.findByRole('button', { name: 'Convidar cerimonialista' }));
      const dialog = screen.getByRole('dialog', { name: 'Convidar cerimonialista' });
      const notice =
        'O site já está no ar. Quando a cerimonialista aceitar, a assinatura da assessoria aparece no rodapé. Para ocultar, vão em Site › Editor › Dados básicos.';
      if (shown) expect(await within(dialog).findByText(notice)).toBeInTheDocument();
      else expect(within(dialog).queryByText(notice)).toBeNull();
    },
  );

  it('já tem cerimonialista (409 PLANNER_ALREADY): fecha, relê e avisa', async () => {
    const user = userEvent.setup();
    api({
      me: coupleMe,
      meId: 'm1',
      withPlanner: false,
      send: () => apiError({ status: 409, body: { error: 'PLANNER_ALREADY' } }),
    });
    renderRoute({ url: '/app/colaboradores' });
    await user.click(await screen.findByRole('button', { name: 'Convidar cerimonialista' }));
    const dialog = screen.getByRole('dialog', { name: 'Convidar cerimonialista' });
    await user.type(emailBox(dialog), 'bia@exemplo.com');
    await user.click(within(dialog).getByRole('button', { name: 'Enviar convite' }));
    expect(
      await screen.findByText(
        'Este casamento já tem cerimonialista. Atualize a tela para ver quem colabora.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Convidar cerimonialista' })).toBeNull();
  });

  it('o convite pendente: "vale até", Reenviar e Cancelar convite sem confirmação', async () => {
    const user = userEvent.setup();
    const calls = api({
      me: coupleMe,
      meId: 'm1',
      withPlanner: false,
      pendingInvitations: [
        {
          id: 'i9',
          kind: 'planner',
          email: 'juliana@prado.com.br',
          expiresAt: '2026-12-16T15:00:00Z',
        },
      ],
    });
    renderRoute({ url: '/app/colaboradores' });
    const planners = await screen.findByRole('region', { name: 'Cerimonialista' });
    expect(await within(planners).findByText('juliana@prado.com.br')).toBeInTheDocument();
    expect(within(planners).getByText('Convite enviado · vale até 16/12')).toBeInTheDocument();
    expect(within(planners).queryByRole('button', { name: 'Convidar cerimonialista' })).toBeNull();
    await user.click(within(planners).getByRole('button', { name: 'Reenviar convite' }));
    expect(
      await screen.findByText('Convite reenviado para juliana@prado.com.br.'),
    ).toBeInTheDocument();
    await user.click(within(planners).getByRole('button', { name: 'Cancelar convite' }));
    expect(await screen.findByText('Convite cancelado.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/v1/weddings/w1/access-invitations',
        body: { kind: 'planner', emails: ['juliana@prado.com.br'] },
      },
      { method: 'DELETE', path: '/v1/weddings/w1/access-invitations/i9' },
    ]);
  });

  it('o "vale até" com o ano quando não é o atual, e o vencido (decisão 277)', async () => {
    api({
      me: coupleMe,
      meId: 'm1',
      withPlanner: false,
      pendingInvitations: [
        {
          id: 'i9',
          kind: 'planner',
          email: 'juliana@prado.com.br',
          expiresAt: '2027-01-05T15:00:00Z',
        },
      ],
    });
    renderRoute({ url: '/app/colaboradores' });
    expect(await screen.findByText('Convite enviado · vale até 05/01/2027')).toBeInTheDocument();
  });

  it('o convite vencido mostra "O convite venceu."', async () => {
    api({
      me: coupleMe,
      meId: 'm1',
      withPlanner: false,
      pendingInvitations: [
        {
          id: 'i9',
          kind: 'planner',
          email: 'juliana@prado.com.br',
          expiresAt: '2026-11-10T15:00:00Z',
        },
      ],
    });
    renderRoute({ url: '/app/colaboradores' });
    expect(await screen.findByText('O convite venceu.')).toBeInTheDocument();
  });

  it('cancelar um convite que já não está pendente (409 NOT_PENDING) avisa e relê', async () => {
    const user = userEvent.setup();
    api({
      me: coupleMe,
      meId: 'm1',
      withPlanner: false,
      remove: () => apiError({ status: 409, body: { error: 'NOT_PENDING' } }),
      pendingInvitations: [
        {
          id: 'i9',
          kind: 'planner',
          email: 'juliana@prado.com.br',
          expiresAt: '2026-12-16T15:00:00Z',
        },
      ],
    });
    renderRoute({ url: '/app/colaboradores' });
    await user.click(await screen.findByRole('button', { name: 'Cancelar convite' }));
    expect(
      await screen.findByText(
        'Este convite já não está pendente. Atualize a tela para ver como ficou.',
      ),
    ).toBeInTheDocument();
  });
});

describe('Colaboradores › versão da colaboradora (Papéis RN03; Colaboradora RN05; Penpot 17)', () => {
  it('a lista em leitura, Convidar e Remover desabilitados com o motivo', async () => {
    api({ me: plannerMe, meId: 'm3' });
    const { container } = renderRoute({ url: '/cerimonialista/casamentos/w1/colaboradores' });
    expect(await screen.findByRole('heading', { name: 'Colaboradores', level: 1 })).toBeVisible();
    expect(screen.queryByText('Quem tem acesso a este casamento.')).toBeNull();
    const planner = screen.getByRole('region', { name: 'Cerimonialista' });
    expect(within(planner).getByText('Desde 05/08')).toBeInTheDocument();
    for (const name of ['Convidar cerimonialista', 'Remover']) {
      const button = within(planner).getByRole('button', { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(
        'Só o casal pode convidar ou remover quem colabora.',
      );
    }
    expect(screen.queryByText('Lucas Dias')).toBeNull();
    await expectNoA11yViolations({ container });
  });

  it('sem dono (o casal ainda não aceitou), o Sair não aparece (RN05; Meus casamentos RN10)', async () => {
    mockApi(({ path }) => {
      if (path === '/v1/me') return Response.json(plannerMe);
      if (path === '/v1/weddings/w1/memberships') {
        return Response.json({
          members: [
            {
              id: 'm3',
              name: 'Juliana Prado',
              role: 'collaborator',
              kind: 'planner',
              since: '2026-08-05T12:00:00Z',
              isMe: true,
            },
          ],
          pendingInvitations: [],
        });
      }
      return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
    });
    renderRoute({ url: '/cerimonialista/casamentos/w1/colaboradores' });
    const planners = await screen.findByRole('region', { name: 'Cerimonialista' });
    expect(within(planners).getByText('Juliana Prado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sair deste casamento' })).toBeNull();
  });

  it('Sair deste casamento: a confirmação, o próprio vínculo e Meus casamentos (RN05)', async () => {
    const user = userEvent.setup();
    const calls = api({ me: plannerMe, meId: 'm3' });
    const { router } = renderRoute({ url: '/cerimonialista/casamentos/w1/colaboradores' });
    await user.click(await screen.findByRole('button', { name: 'Sair deste casamento' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Sair de Ana Beatriz e Marcos?' });
    await user.click(within(dialog).getByRole('button', { name: 'Sair do casamento' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cerimonialista'));
    expect(
      await screen.findByText('Você saiu do casamento de Ana Beatriz e Marcos.'),
    ).toBeInTheDocument();
    expect(calls).toEqual([{ method: 'DELETE', path: '/v1/weddings/w1/memberships/m3' }]);
    expect(screen.queryByText('Este casamento não está mais disponível.')).toBeNull();
  });
});
