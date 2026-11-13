import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderAreaScreen, renderRoute } from '../../../../tests/render-route';
import type { DashboardResponse } from '../../../shared/api/generated/model';

afterEach(() => vi.unstubAllGlobals());

const me = {
  user: { id: 'u1', name: 'Ana Beatriz Moreira', email: 'ana@exemplo.com', platformRole: 'none' },
  activeProfile: 'couple',
  authenticatedAt: '2026-11-05T12:00:00Z',
  memberships: [
    {
      weddingId: 'w1',
      role: 'owner',
      weddingName: 'Ana & Marcos',
      eventDate: '2027-11-14',
      city: 'Campinas',
      state: 'SP',
    },
  ],
  profiles: ['couple'],
  lastProfileOnDevice: 'couple',
  planner: null,
  referrer: null,
};

const today = (hour: number, minute: number) => {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

function dashboard(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    role: 'owner',
    stats: {
      guestsTotal: 142,
      confirmed: 96,
      declined: 18,
      pending: 28,
      adultsConfirmed: 82,
      childrenConfirmed: 11,
      babiesConfirmed: 3,
      partiesPending: 10,
      rsvpPercent: 80,
      partiesTotal: 58,
    },
    delivery: { notSent: 6, sent: 5, viewed: 4, responded: 43 },
    reminderQueue: { parties: 15, guests: 28, notReminded: 15 },
    site: {
      slug: 'ana-e-marcos',
      publishedAt: '2026-09-01T12:00:00Z',
      endDate: '2028-02-14',
      status: 'published',
    },
    rsvpDeadline: null,
    eventDate: null,
    daysUntilEvent: null,
    checklist: [
      { key: 'guests', done: true, progress: null },
      { key: 'appearance', done: true, progress: null },
      { key: 'publish', done: true, progress: null },
      { key: 'invites', done: false, progress: { done: 52, total: 58 } },
      { key: 'reminders', done: false, progress: { done: 0, total: 15 } },
    ],
    recentActivity: [
      {
        id: 'n1',
        source: 'notification',
        count: 1,
        readAt: null,
        at: today(20, 14),
        groups: [
          {
            at: today(20, 14),
            partyId: 'p1',
            name: 'Família Moreira',
            confirmed: 3,
            declined: 1,
          },
        ],
      },
    ],
    ...overrides,
  };
}

type Call = { method: string; path: string };

function mockDashboard({ data = dashboard() }: { data?: DashboardResponse | null } = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path }) => {
    if (path === '/v1/me') return Response.json(meFor(me));
    if (path === '/v1/weddings/w1/dashboard') {
      return data ? Response.json(data) : apiError({ status: 500, body: { error: 'INTERNAL' } });
    }
    calls.push({ method, path });
    if (path.startsWith('/v1/me/notifications/') && method === 'POST') {
      return new Response(null, { status: 204 });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const card = (title: string) =>
  screen.getByRole('heading', { name: title, level: 2 }).closest('section') as HTMLElement;

describe('Dashboard do casal (RN01 a RN08)', () => {
  it('a saudação, os números do casamento e os cartões da F5, sem os das fases futuras', async () => {
    mockDashboard();
    renderRoute({ url: '/app' });
    expect(await screen.findByRole('heading', { name: 'Olá, Ana', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('142')).toBeInTheDocument();
    expect(
      screen.getByText('em 58 grupos · 96 confirmados, 18 recusados e 28 pendentes'),
    ).toBeInTheDocument();
    expect(screen.getByText('82 adultos, 11 crianças e 3 bebês confirmados')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('114 de 142 responderam · sem prazo')).toBeInTheDocument();
    expect(screen.queryByText(/Presentes|Recados|chave Pix/)).toBeNull();
    // Os cartões levam às telas deles.
    expect(screen.getByRole('link', { name: /^Convidados142/ })).toHaveAttribute(
      'href',
      '/app/convidados',
    );
    expect(screen.getByRole('link', { name: /^Buffet96/ })).toHaveAttribute(
      'href',
      '/app/convidados?resposta=confirmados',
    );
    expect(screen.getByRole('link', { name: /^Taxa de resposta80%/ })).toHaveAttribute(
      'href',
      '/app/envios/prazo',
    );
  });

  it('a contagem com prazo e data, e o Dashboard marcado na Sidebar', async () => {
    mockDashboard({
      data: dashboard({
        daysUntilEvent: 1,
        eventDate: '2027-11-14',
        rsvpDeadline: '2027-10-15',
      }),
    });
    renderRoute({ url: '/app' });
    expect(
      await screen.findByText('Falta 1 dia para o casamento · dom., 14 de nov. de 2027'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('114 de 142 responderam · prazo: 15 de out. de 2027'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('Envios: os 4 status, cada um abre Enviar convites com o filtro (RN02)', async () => {
    const user = userEvent.setup();
    mockDashboard();
    const { router } = renderRoute({ url: '/app' });
    await screen.findByText('142');
    const rows = within(card('Envios'))
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(rows).toEqual([
      'Não enviado6 grupos',
      'Enviado5 grupos',
      'Visualizado4 grupos',
      'Respondido43 grupos',
    ]);
    await user.click(within(card('Envios')).getByRole('link', { name: /^Visualizado/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/envios/convites'));
    expect(router.state.location.search).toBe('?envio=visualizado');
  });

  it('o Status do site publicado: o selo, o endereço, "No ar até" e Editar site', async () => {
    mockDashboard();
    renderRoute({ url: '/app' });
    await screen.findByText('142');
    const site = card('Status do site');
    expect(within(site).getByText('Publicado')).toBeInTheDocument();
    expect(within(site).getByText('kore.com.br/ana-e-marcos')).toBeInTheDocument();
    expect(within(site).getByText('No ar até seg., 14 de fev. de 2028.')).toBeInTheDocument();
    expect(within(site).getByRole('button', { name: 'Editar site' })).toBeInTheDocument();
  });

  it('o Checklist com o andamento dos envios e do lembrete (RN03)', async () => {
    mockDashboard();
    renderRoute({ url: '/app' });
    await screen.findByText('142');
    const items = within(card('Checklist')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Cadastrar os convidados feito',
      'Escolher a aparência feito',
      'Publicar o site feito',
      'Enviar os convites (52 de 58 grupos)',
      'Lembrar os pendentes (15 grupos)',
    ]);
    expect(items[0]).toHaveAttribute('data-state', 'done');
    // O "feito" é só para o leitor de tela (decisão 239(B2)).
    expect(within(items[0] as HTMLElement).getByRole('link')).toHaveAccessibleName(
      'Cadastrar os convidados feito',
    );
    expect(within(items[3] as HTMLElement).getByRole('link')).toHaveAccessibleName(
      'Enviar os convites (52 de 58 grupos)',
    );
    expect(items[3]).toHaveAttribute('data-state', 'next');
    expect(within(items[4] as HTMLElement).getByRole('link')).toHaveAttribute(
      'href',
      '/app/envios/lembrete',
    );
  });

  it('antes de publicar: Enviar convites desabilitado com o motivo, Envios com a frase e o Editor no lugar do Publicar (RN03, RN05; 243)', async () => {
    mockDashboard({
      data: dashboard({
        site: { slug: 'ana-e-marcos', publishedAt: null, endDate: null, status: 'draft' },
        stats: { ...dashboard().stats, confirmed: 0, declined: 0, rsvpPercent: 0 },
        checklist: [
          { key: 'guests', done: true, progress: null },
          { key: 'appearance', done: true, progress: null },
          { key: 'publish', done: false, progress: null },
          { key: 'invites', done: false, progress: { done: 0, total: 58 } },
        ],
      }),
    });
    renderRoute({ url: '/app' });
    await screen.findByText('142');
    const send = screen.getByRole('button', { name: 'Enviar convites' });
    expect(send).toBeDisabled();
    expect(send).toHaveAccessibleDescription('Publiquem o site para começar os envios.');
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('0 de 142 responderam · sem prazo')).toBeInTheDocument();
    expect(
      within(card('Envios')).getByText('Os envios começam depois de publicar o site.'),
    ).toBeInTheDocument();
    // Antes de publicar, os números ficam, sem levar aos envios.
    expect(within(card('Envios')).queryAllByRole('link')).toHaveLength(0);
    expect(within(card('Envios')).getByText('6 grupos')).toBeInTheDocument();
    expect(within(card('Status do site')).getByText('Rascunho')).toBeInTheDocument();
    // O Publicar volta com a tela paga do front da F3 (decisão 243): o Editor por enquanto.
    expect(within(card('Status do site')).queryByRole('button', { name: 'Publicar' })).toBeNull();
    expect(
      within(card('Status do site')).getByRole('button', { name: 'Editar site' }),
    ).toBeEnabled();
    expect(
      within(card('Checklist')).getByRole('link', { name: 'Publicar o site' }),
    ).toHaveAttribute('href', '/app/site');
    expect(within(card('Checklist')).queryByText(/Lembrar os pendentes/)).toBeNull();
    expect(within(card('Checklist')).getByText('Publicar o site').closest('li')).toHaveAttribute(
      'data-state',
      'next',
    );
  });

  it('a Atividade recente: o texto, a data e abrir leva ao grupo e marca como lida (RN04)', async () => {
    const user = userEvent.setup();
    const calls = mockDashboard();
    renderRoute({ url: '/app' });
    await screen.findByText('142');
    const activity = card('Atividade recente');
    const item = within(activity).getByRole('link', {
      name: /Família Moreira respondeu o convite/,
    });
    expect(item).toHaveTextContent('hoje às 20h14');
    expect(item).toHaveAttribute('href', '/app/convidados/grupos/p1');
    await user.click(item);
    await waitFor(() =>
      expect(calls).toContainEqual({ method: 'POST', path: '/v1/me/notifications/n1/read' }),
    );
  });

  it('a Atividade recente sem os avisos de cobrança (o payload deles vira o groups), que entram na F3', async () => {
    mockDashboard({
      data: dashboard({
        recentActivity: [
          {
            id: 'nb',
            source: 'notification',
            count: 1,
            readAt: null,
            at: today(21, 0),
            // Como a API manda: o payload do billing no lugar dos grupos.
            groups: [
              { kind: 'payment_confirmed', at: today(21, 0) },
            ] as unknown as DashboardResponse['recentActivity'][number]['groups'],
          },
          ...dashboard().recentActivity,
        ],
      }),
    });
    renderRoute({ url: '/app' });
    await screen.findByText('142');
    const links = within(card('Atividade recente')).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent('Família Moreira respondeu o convite');
    expect(screen.queryByText(/^ respondeu o convite/)).toBeNull();
    expect(
      within(card('Atividade recente'))
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).not.toContain('/app/convidados/grupos/undefined');
  });

  it('a Atividade agrupada leva à lista na ordem de Respondido em (RN04; decisão 246)', async () => {
    const group = (partyId: string, name: string) => ({
      at: today(20, 14),
      partyId,
      name,
      confirmed: 1,
      declined: 0,
    });
    mockDashboard({
      data: dashboard({
        recentActivity: [
          {
            id: 'n2',
            source: 'notification',
            count: 2,
            readAt: null,
            at: today(20, 14),
            groups: [group('p1', 'Família Moreira'), group('p2', 'Família Duarte')],
          },
        ],
      }),
    });
    renderRoute({ url: '/app' });
    await screen.findByText('142');
    expect(
      within(card('Atividade recente')).getByRole('link', { name: /2 grupos responderam/ }),
    ).toHaveAttribute('href', '/app/convidados?ordem=respondido');
  });

  it('a Atividade recente vazia', async () => {
    mockDashboard({ data: dashboard({ recentActivity: [] }) });
    renderRoute({ url: '/app' });
    expect(
      await screen.findByText(
        'Ainda não há respostas. Elas aparecem aqui conforme os grupos respondem.',
      ),
    ).toBeInTheDocument();
  });

  it('a colaboradora: a faixa e o motivo no singular (RN01, RN05)', async () => {
    profileUnderTest.current = 'planner';
    mockDashboard({
      data: dashboard({
        role: 'collaborator',
        site: { slug: 'ana-e-marcos', publishedAt: null, endDate: null, status: 'draft' },
      }),
    });
    renderAreaScreen({ url: '/app' });
    expect(await screen.findByText('Você colabora neste casamento.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar convites' })).toHaveAccessibleDescription(
      'Os envios começam depois que o casal publicar o site.',
    );
  });

  it('sem convidados: o vazio com Adicionar convidados; o Status e o Checklist continuam (RN06)', async () => {
    const user = userEvent.setup();
    mockDashboard({
      data: dashboard({
        stats: { ...dashboard().stats, guestsTotal: 0, partiesTotal: 0 },
        delivery: { notSent: 0, sent: 0, viewed: 0, responded: 0 },
      }),
    });
    const { router } = renderRoute({ url: '/app' });
    expect(
      await screen.findByRole('heading', { name: 'Vocês ainda não cadastraram convidados.' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Buffet')).toBeNull();
    expect(card('Status do site')).toBeInTheDocument();
    expect(card('Checklist')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Adicionar convidados' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/convidados/novo'));
  });

  it('sem grupos, "Enviar os convites" sem a contagem "(0 de 0 grupos)"', async () => {
    mockDashboard({
      data: dashboard({
        stats: { ...dashboard().stats, guestsTotal: 0, partiesTotal: 0 },
        checklist: [
          { key: 'guests', done: false, progress: null },
          { key: 'invites', done: false, progress: { done: 0, total: 0 } },
        ],
      }),
    });
    renderRoute({ url: '/app' });
    await screen.findByRole('heading', { name: 'Vocês ainda não cadastraram convidados.' });
    expect(
      within(card('Checklist'))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Cadastrar os convidados', 'Enviar os convites']);
  });

  it('sem convidados, a colaboradora lê o vazio dela (RN06)', async () => {
    profileUnderTest.current = 'planner';
    mockDashboard({
      data: dashboard({
        role: 'collaborator',
        stats: { ...dashboard().stats, guestsTotal: 0, partiesTotal: 0 },
        delivery: { notSent: 0, sent: 0, viewed: 0, responded: 0 },
      }),
    });
    renderAreaScreen({ url: '/app' });
    expect(
      await screen.findByRole('heading', { name: 'Este casamento ainda não tem convidados.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar convidados' })).toBeInTheDocument();
  });

  it('se o Dashboard não carrega, o aviso com o Tentar de novo', async () => {
    mockDashboard({ data: null });
    renderRoute({ url: '/app' });
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('é acessível', async () => {
    mockDashboard();
    const { container } = renderRoute({ url: '/app' });
    await screen.findByText('142');
    await expectNoA11yViolations({ container });
  });
});
