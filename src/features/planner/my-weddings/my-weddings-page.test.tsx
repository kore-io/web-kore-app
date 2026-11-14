import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

afterEach(() => {
  vi.unstubAllGlobals();
});

const URL = '/cerimonialista';

const me = {
  user: {
    id: 'u1',
    name: 'Juliana Prado',
    email: 'juliana@pradoassessoria.com.br',
    platformRole: 'none',
  },
  activeProfile: 'planner',
  authenticatedAt: '2026-11-14T12:00:00Z',
  memberships: [],
  profiles: ['planner'],
  lastProfileOnDevice: 'planner',
  planner: { organization: 'Prado Assessoria', weddingsCount: 3 },
  referrer: null,
  plannerSignupEnabled: true,
  identities: [{ provider: 'email' }],
};

const item = (overrides: Record<string, unknown>) => ({
  partnerNames: ['Ana', 'Marcos'],
  eventDate: '2026-11-14',
  status: 'published',
  rsvpPercent: 80,
  origin: 'referral_link',
  weddingId: 'w1',
  city: 'Campinas',
  state: 'SP',
  guestsTotal: 120,
  createdByMe: false,
  awaitingPayment: false,
  ...overrides,
});

const weddings = [
  item({
    weddingId: 'w2',
    partnerNames: ['Natália', 'Vinícius'],
    eventDate: '2026-03-15',
    status: 'expired',
    origin: 'created_by_me',
    guestsTotal: 0,
    rsvpPercent: 0,
  }),
  // A API devolve o % com duas casas (DECIMAL(5,2)); a tela mostra o inteiro (RN02).
  item({ weddingId: 'w1', rsvpPercent: 66.67 }),
  item({
    weddingId: 'w3',
    partnerNames: ['Fernanda', 'João'],
    eventDate: null,
    status: 'awaiting_couple',
    origin: 'created_by_me',
    guestsTotal: 0,
    rsvpPercent: 0,
  }),
];

const pendingAlert = (index: number) => ({
  partnerNames: [`Noiva${index}`, `Noivo${index}`],
  rsvpDeadline: `2026-11-${String(15 + index).padStart(2, '0')}`,
  weddingId: `a${index}`,
});

function api({
  list = {
    summary: { active: 2, awaitingCouple: 1, awaitingPayment: 0, commissionAvailableCents: 0 },
    alerts: { pendingResponses: [], invitationsNotSent: [] },
    weddings,
  },
  profileComplete = true,
}: { list?: object; profileComplete?: boolean } = {}) {
  mockApi(({ path }) => {
    if (path === '/v1/me') return Response.json(me);
    if (path === '/v1/me/weddings') return Response.json(list);
    if (path === '/v1/me/planner') {
      return Response.json({
        name: 'Juliana Prado',
        creditName: 'Prado Assessoria',
        phone: null,
        whatsapp: null,
        cities: profileComplete ? ['Campinas (SP)'] : [],
        email: me.user.email,
        profileComplete,
        termsAccepted: profileComplete,
        creditHidden: false,
      });
    }
    if (path === '/v1/me/referrer') {
      return Response.json({
        referralCode: 'juliana-prado',
        link: 'https://kore.com.br/i/juliana-prado',
        discountPercent: 10,
      });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
}

const table = () => screen.getByRole('table');
const rowNames = () =>
  within(table())
    .getAllByRole('rowheader')
    .map((cell) => cell.textContent);

describe('Meus casamentos (RN01 a RN07, RN12, RN13; Penpot 03, sem a F3)', () => {
  it('o subtítulo, o Resumo, a lista na ordem da API, o "—" e o "Data a definir"', async () => {
    api();
    const { container } = renderRoute({ url: URL });
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Meus casamentos' })).toBeInTheDocument();
    expect(screen.getByText('3 casamentos da Prado Assessoria · 2 ativos')).toBeInTheDocument();
    expect(screen.getByText('de 3 casamentos')).toBeInTheDocument();
    expect(screen.getByText('convite enviado, sem resposta')).toBeInTheDocument();
    // Sem a F3: nem Aguardando pagamento nem Comissão disponível.
    expect(screen.queryByText('Aguardando pagamento')).toBeNull();
    expect(screen.queryByText('Comissão disponível')).toBeNull();
    expect(rowNames()).toEqual(['Natália e Vinícius', 'Ana e Marcos', 'Fernanda e João']);
    const rows = within(table()).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('15/03/2026Expirado—Criado por você');
    expect(rows[2]).toHaveTextContent('14/11/2026Publicado67%Pelo seu link');
    expect(rows[3]).toHaveTextContent('Data a definirAguardando o casal—Criado por você');
    expect(within(table()).getByRole('link', { name: 'Ana e Marcos' })).toHaveAttribute(
      'href',
      '/cerimonialista/casamentos/w1',
    );
    await expectNoA11yViolations({ container });
  });

  it('a linha inteira leva ao casamento (até o D4b, o Dashboard dela)', async () => {
    const user = userEvent.setup();
    api();
    const { router } = renderRoute({ url: URL });
    await screen.findByRole('table');
    await user.click(within(table()).getByText('14/11/2026'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/cerimonialista/casamentos/w1'),
    );
  });

  it('os cartões do celular: a data, a cidade, o status, as Respostas e a origem', async () => {
    api();
    renderRoute({ url: URL });
    await screen.findByRole('table');
    // Os cartões são a lista do celular (no jsdom, sem as larguras, os dois aparecem).
    const cards = document.querySelector('.kore-my-weddings__cards') as HTMLElement;
    const ana = within(cards).getByRole('link', { name: /^Ana e Marcos/ });
    expect(ana).toHaveTextContent('14/11/2026 · Campinas (SP)');
    expect(ana).toHaveTextContent('Respostas 67%');
    expect(ana).toHaveTextContent('Pelo seu link');
  });

  it('a busca sem acento e o subtítulo "{m} de {n} casamentos" (decisão 257(1))', async () => {
    const user = userEvent.setup();
    api();
    renderRoute({ url: URL });
    await screen.findByRole('table');
    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar pelo nome do casal' }),
      'natalia',
    );
    expect(rowNames()).toEqual(['Natália e Vinícius']);
    expect(screen.getByText('1 de 3 casamentos')).toBeInTheDocument();
  });

  it('o filtro de status tem as 6 opções, sem Aguardando pagamento (RN02)', async () => {
    const user = userEvent.setup();
    api();
    renderRoute({ url: URL });
    await screen.findByRole('table');
    const status = screen.getByRole('combobox', { name: 'Status' });
    expect(
      within(status)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'Todos os status',
      'Aguardando o casal',
      'Rascunho',
      'Publicado',
      'Pós-evento',
      'Em carência',
      'Expirado',
    ]);
    await user.selectOptions(status, 'awaiting_couple');
    expect(rowNames()).toEqual(['Fernanda e João']);
  });

  it('Escolher período mostra De e Até, e filtra pela data (decisão 257(2))', async () => {
    const user = userEvent.setup();
    api();
    renderRoute({ url: URL });
    await screen.findByRole('table');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Data' }), 'period');
    await user.type(screen.getByLabelText('De'), '2026-04-01');
    expect(rowNames()).toEqual(['Ana e Marcos']);
  });

  it('sem resultado: o vazio do filtro e o Limpar filtros, que volta a lista (decisão 257(3))', async () => {
    const user = userEvent.setup();
    api();
    renderRoute({ url: URL });
    await screen.findByRole('table');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar pelo nome do casal' }), 'zzz');
    expect(screen.getByText('Nenhum casamento com esses filtros.')).toBeInTheDocument();
    const clear = screen.getAllByRole('button', { name: 'Limpar filtros' });
    expect(clear).toHaveLength(2);
    await user.click(clear[1] as HTMLElement);
    expect(rowNames()).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull();
  });

  it('os alertas: o texto pelo número, Ver casamentos com até 5 nomes e "e mais 1" (RN05 a RN07)', async () => {
    const user = userEvent.setup();
    api({
      list: {
        summary: { active: 2, awaitingCouple: 1, awaitingPayment: 0, commissionAvailableCents: 0 },
        alerts: {
          pendingResponses: [6, 5, 4, 3, 2, 1].map(pendingAlert),
          invitationsNotSent: [
            { partnerNames: ['Fernanda', 'João'], eventDate: '2027-01-30', weddingId: 'w3' },
          ],
        },
        weddings,
      },
    });
    renderRoute({ url: URL });
    expect(
      await screen.findByText('6 casamentos com muitas respostas pendentes e prazo em até 7 dias.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('1 casamento com convites ainda não enviados, a menos de 90 dias da data.'),
    ).toBeInTheDocument();
    const [first] = screen.getAllByRole('button', { name: 'Ver casamentos' });
    expect(first).toHaveAttribute('aria-expanded', 'false');
    await user.click(first as HTMLElement);
    const opened = screen.getByRole('button', { name: 'Ocultar casamentos' });
    expect(opened).toHaveAttribute('aria-expanded', 'true');
    const list = document.getElementById(opened.getAttribute('aria-controls') ?? '');
    // O prazo mais próximo primeiro, até 5, e "e mais 1".
    expect(
      within(list as HTMLElement)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      'Noiva1 e Noivo1',
      'Noiva2 e Noivo2',
      'Noiva3 e Noivo3',
      'Noiva4 e Noivo4',
      'Noiva5 e Noivo5',
      'e mais 1',
    ]);
    expect(
      within(list as HTMLElement).getByRole('link', { name: 'Noiva1 e Noivo1' }),
    ).toHaveAttribute('href', '/cerimonialista/casamentos/a1');
    await user.click(opened);
    expect(screen.getAllByRole('button', { name: 'Ver casamentos' })).toHaveLength(2);
  });

  it('o perfil mínimo: o Alert com Abrir Meu perfil (RN13)', async () => {
    api({ profileComplete: false });
    renderRoute({ url: URL });
    expect(await screen.findByText('Completar os dados profissionais')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir Meu perfil' })).toHaveAttribute(
      'href',
      '/cerimonialista/perfil',
    );
  });

  it('o perfil completo não mostra o Alert', async () => {
    api();
    renderRoute({ url: URL });
    await screen.findByRole('table');
    expect(screen.queryByText('Completar os dados profissionais')).toBeNull();
  });

  it('o vazio: Criar casamento e Copiar link de indicação com o Toast (RN12; decisão 257(4))', async () => {
    const user = userEvent.setup();
    api({
      list: {
        summary: { active: 0, awaitingCouple: 0, awaitingPayment: 0, commissionAvailableCents: 0 },
        alerts: { pendingResponses: [], invitationsNotSent: [] },
        weddings: [],
      },
    });
    const { router, container } = renderRoute({ url: URL });
    expect(await screen.findByText('Você ainda não tem casamentos.')).toBeInTheDocument();
    expect(
      screen.getByText('Os casamentos que você criar ou em que colaborar aparecem aqui.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    await expectNoA11yViolations({ container });
    await user.click(screen.getByRole('button', { name: 'Copiar link de indicação' }));
    expect(await screen.findByText('Link copiado.')).toBeInTheDocument();
    await expect(navigator.clipboard.readText()).resolves.toBe(
      'https://kore.com.br/i/juliana-prado',
    );
    await user.click(screen.getByRole('button', { name: 'Criar casamento' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/cerimonialista/casamentos/novo'),
    );
  });

  it('a falha da lista: o aviso com o Tentar de novo', async () => {
    mockApi(({ path }) =>
      path === '/v1/me'
        ? Response.json(me)
        : apiError({ status: 503, body: { error: 'UNAVAILABLE' } }),
    );
    renderRoute({ url: URL });
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });
});
