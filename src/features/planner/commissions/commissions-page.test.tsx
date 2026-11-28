import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

/*
 * Comissões da cerimonialista (Comissões do indicador RN02 e RN07; Penpot 07; textos-f3 B6;
 * decisões 266(2), 284(3), 315 e 346).
 */

const URL = '/cerimonialista/comissoes';

const me = {
  user: { id: 'u1', name: 'Juliana Prado', email: 'juliana@prado.com.br', platformRole: 'none' },
  activeProfile: 'planner',
  authenticatedAt: '2026-11-14T12:00:00Z',
  memberships: [],
  profiles: ['planner'],
  lastProfileOnDevice: 'planner',
  planner: { organization: 'Prado Assessoria', weddingsCount: 2 },
  referrer: null,
  plannerSignupEnabled: true,
};

const balances = {
  availableCents: 5582,
  pendingCents: 0,
  receivedCents: 17906,
  inPayoutCents: 0,
  adjustmentsCents: 0,
  paidPayouts: 3,
  nextReleaseAt: null,
};

function commission(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'commission',
    commissionId: 'c1',
    weddingId: 'w1',
    coupleNames: 'Isabela e Rodrigo',
    weddingPurged: false,
    clickable: true,
    paymentKind: 'publication',
    baseAmountCents: 33710,
    amountCents: 6742,
    ratePercent: 20,
    status: 'available',
    blockReason: null,
    availableAt: '2026-10-10T03:00:00Z',
    paidAt: null,
    createdAt: '2026-11-12T15:00:00Z',
    ...overrides,
  };
}

const byPayment = [
  commission({ status: 'held' }),
  commission({
    commissionId: 'c2',
    coupleNames: 'Marina e Caio',
    paymentKind: 'extension',
    baseAmountCents: 8700,
    amountCents: 1740,
    status: 'blocked',
    blockReason: 'wedding_blocked',
    createdAt: '2026-11-10T15:00:00Z',
  }),
  {
    kind: 'adjustment',
    adjustmentId: 'a1',
    coupleNames: 'Aline e Gustavo',
    weddingPurged: false,
    amountCents: -5002,
    reason: 'refund',
    createdAt: '2026-11-09T15:00:00Z',
    payoutStatus: null,
  },
  commission({
    commissionId: 'c3',
    coupleNames: 'Bianca e Henrique',
    status: 'pending',
    availableAt: '2026-12-09T03:00:00Z',
    createdAt: '2026-11-09T15:00:00Z',
  }),
  commission({
    commissionId: 'c4',
    coupleNames: 'Ana e Marcos',
    status: 'paid',
    paidAt: '2026-09-28T15:00:00Z',
    createdAt: '2026-08-10T15:00:00Z',
  }),
  commission({
    commissionId: 'c5',
    weddingId: null,
    coupleNames: null,
    weddingPurged: true,
    clickable: false,
    status: 'reversed',
    createdAt: '2025-10-20T15:00:00Z',
  }),
];

const byWedding = [
  {
    weddingId: 'w3',
    referralSource: 'referral_link',
    paymentsCount: 2,
    receivedCents: 0,
    totalCents: 4422,
    coupleNames: 'Bianca e Henrique',
    weddingPurged: false,
    clickable: true,
    availableCents: 0,
    pendingCents: 4422,
    releaseDates: ['2026-12-02T03:00:00Z', '2026-12-10T03:00:00Z'],
  },
  {
    weddingId: 'w4',
    referralSource: 'admin_reassigned',
    paymentsCount: 1,
    receivedCents: 0,
    totalCents: 6742,
    coupleNames: 'Ana e Marcos',
    weddingPurged: false,
    clickable: true,
    availableCents: 6742,
    pendingCents: 0,
    releaseDates: [],
  },
  {
    weddingId: 'w5',
    referralSource: 'created_by_planner',
    paymentsCount: 1,
    receivedCents: 6162,
    totalCents: 6162,
    coupleNames: 'Paula e Diego',
    weddingPurged: false,
    clickable: false,
    availableCents: 0,
    pendingCents: 0,
    releaseDates: [],
  },
  {
    weddingId: 'w6',
    referralSource: 'invited_before_payment',
    paymentsCount: 1,
    receivedCents: 0,
    totalCents: 1740,
    coupleNames: 'Lívia e Bruno',
    weddingPurged: false,
    clickable: true,
    availableCents: 0,
    pendingCents: 1740,
    releaseDates: ['2026-12-15T03:00:00Z'],
  },
];

const payoutsBody = {
  nextRequestAt: null,
  pixKeyActiveFrom: null,
  minimumCents: 5000,
  items: [],
  payoutsEnabled: true,
};

function mockCommissions({
  balancesBody = balances,
  payment = byPayment,
  wedding = byWedding,
  total,
  payouts = payoutsBody,
}: {
  /** O GET dos repasses: o mínimo, o intervalo e os repasses ligados (Repasse RN04). */
  payouts?: object;
  balancesBody?: object;
  payment?: object[];
  wedding?: object[];
  total?: number;
} = {}) {
  const paths: string[] = [];
  mockApi(({ path }) => {
    if (path === '/v1/me') return Response.json(me);
    if (path === '/v1/me/referrer/payouts') return Response.json(payouts);
    if (path.startsWith('/v1/me/referrer/commissions')) {
      paths.push(path);
      const view = new URLSearchParams(path.split('?')[1]).get('view') ?? 'payment';
      const items = view === 'wedding' ? wedding : payment;
      return Response.json({
        balances: balancesBody,
        view,
        items,
        page: 1,
        pageSize: 50,
        total: total ?? items.length,
      });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return paths;
}

const row = (name: string) =>
  screen.getAllByRole('row').find((item) => within(item).queryByText(name)) as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-26T15:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Comissões (Comissões do indicador RN07)', () => {
  it('o Aguardando liberação dá a próxima liberação (349(1)), com o ano fora do corrente', async () => {
    mockCommissions({
      balancesBody: { ...balances, pendingCents: 1740, nextReleaseAt: '2026-12-21' },
    });
    const { unmount } = renderRoute({ url: URL });
    expect(await screen.findByText('Libera em 21/12')).toBeInTheDocument();
    expect(screen.queryByText('nada a liberar agora')).toBeNull();
    unmount();
    mockCommissions({
      balancesBody: { ...balances, pendingCents: 1740, nextReleaseAt: '2027-01-05' },
    });
    renderRoute({ url: URL });
    expect(await screen.findByText('Libera em 05/01/2027')).toBeInTheDocument();
  });

  it('os saldos e o Extrato Por pagamento, sem subtítulo e sem percentual', async () => {
    const paths = mockCommissions();
    const { container } = renderRoute({ url: URL });
    expect(await screen.findByRole('heading', { level: 1, name: 'Comissões' })).toBeInTheDocument();
    expect(await screen.findByText('R$ 55,82')).toBeInTheDocument();
    expect(screen.getByText('já pode pedir o repasse')).toBeInTheDocument();
    expect(screen.getByText('nada a liberar agora')).toBeInTheDocument();
    expect(screen.getByText('R$ 179,06')).toBeInTheDocument();
    expect(screen.getByText('em 3 repasses')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByText(/prazo de liberação/)).toBeNull();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Casamento',
      'Pagamento de origem',
      'Valor pago (sem juros)',
      'Comissão',
      'Status',
      'Data',
    ]);
    expect(paths[0]).toBe('/v1/me/referrer/commissions?view=payment&page=1');
    await expectNoA11yViolations({ container });
  });

  it('os selos e as legendas: Retida, Bloqueada (wedding_blocked), Aguardando com a data e Paga em', async () => {
    mockCommissions();
    renderRoute({ url: URL });
    const held = await screen.findByText('Retida');
    expect(held).toBeInTheDocument();
    expect(
      screen.getByText(
        'O pagamento foi contestado no banco do cartão. A comissão fica retida até a decisão.',
      ),
    ).toBeInTheDocument();
    expect(within(row('Marina e Caio')).getByText('Bloqueada')).toBeInTheDocument();
    expect(
      within(row('Marina e Caio')).getByText(
        'Comissão em análise pelo Kore. Para saber mais, escreva para suporte@kore.com.br.',
      ),
    ).toBeInTheDocument();
    expect(within(row('Marina e Caio')).getByText('Extensão')).toBeInTheDocument();
    expect(within(row('Bianca e Henrique')).getByText('Aguardando liberação')).toBeInTheDocument();
    expect(within(row('Bianca e Henrique')).getByText('Libera em 09/12')).toBeInTheDocument();
    expect(within(row('Ana e Marcos')).getByText('Paga em 28/09')).toBeInTheDocument();
    expect(within(row('Ana e Marcos')).getByText('10/08')).toBeInTheDocument();
  });

  it('o ajuste em vermelho, sem selo, e a lápide sem link (RN07; Retenção RN03)', async () => {
    mockCommissions();
    renderRoute({ url: URL });
    const adjustment = within(
      await screen
        .findByText('Ajuste (estorno)')
        .then((cell) => cell.closest('[role="row"]') as HTMLElement),
    );
    expect(adjustment.getByText('−R$ 50,02')).toHaveClass('kore-commissions__negative');
    expect(adjustment.getByText('Desconta no próximo repasse')).toBeInTheDocument();
    const purged = row('Casamento apagado');
    expect(within(purged).queryByRole('link')).toBeNull();
    expect(within(purged).getByText('20/10/2025')).toBeInTheDocument();
    // O casamento que ela ainda vê abre o detalhe em Meus casamentos.
    expect(
      within(row('Isabela e Rodrigo')).getByRole('link', { name: 'Isabela e Rodrigo' }),
    ).toHaveAttribute('href', '/cerimonialista?casamento=w1');
  });

  it('o casal na linha do ajuste (347(2)) e o ajuste junto do "já pode pedir o repasse" (350(9))', async () => {
    mockCommissions({ balancesBody: { ...balances, adjustmentsCents: -5002, paidPayouts: 1 } });
    renderRoute({ url: URL });
    const adjustment = (await screen.findByText('Ajuste (estorno)')).closest(
      '[role="row"]',
    ) as HTMLElement;
    expect(within(adjustment).getByText('Aline e Gustavo')).toBeInTheDocument();
    // O ajuste primeiro, a ação depois; o espaço sem quebra antes do "·" (351(2)).
    const legend = await screen.findByText(
      'já com o ajuste de −R$ 50,02 · já pode pedir o repasse',
    );
    expect(legend.textContent).toContain('50,02\u00a0· já');
    expect(screen.getByText('em 1 repasse')).toBeInTheDocument();
  });

  it('o ajuste sem o pedido possível fica sozinho, e o positivo leva o "+" (351(2))', async () => {
    mockCommissions({
      balancesBody: { ...balances, availableCents: 100, adjustmentsCents: 5002 },
    });
    renderRoute({ url: URL });
    expect(await screen.findByText('já com o ajuste de +R$ 50,02')).toBeInTheDocument();
    expect(screen.queryByText(/já pode pedir o repasse/)).toBeNull();
  });

  it('o ajuste positivo sem repasse: "Soma no próximo repasse" (351(6))', async () => {
    mockCommissions({
      payment: [
        {
          kind: 'adjustment',
          adjustmentId: 'a3',
          coupleNames: null,
          weddingPurged: false,
          amountCents: 1000,
          reason: 'manual',
          createdAt: '2026-11-09T15:00:00Z',
          payoutStatus: null,
        },
      ],
    });
    renderRoute({ url: URL });
    expect(await screen.findByText('Soma no próximo repasse')).toBeInTheDocument();
    expect(screen.queryByText('Desconta no próximo repasse')).toBeNull();
  });

  it('o ajuste manual é "Ajuste" (346(3))', async () => {
    mockCommissions({
      payment: [
        {
          kind: 'adjustment',
          adjustmentId: 'a2',
          coupleNames: null,
          weddingPurged: false,
          amountCents: 1000,
          reason: 'manual',
          createdAt: '2026-11-09T15:00:00Z',
          payoutStatus: 'paid',
        },
      ],
    });
    renderRoute({ url: URL });
    expect(await screen.findByText('Ajuste')).toBeInTheDocument();
    expect(screen.queryByText('Desconta no próximo repasse')).toBeNull();
  });

  it('com um repasse pedido: "R$ 0,00 (R$ 158,04 em repasse)" (RN07)', async () => {
    mockCommissions({ balancesBody: { ...balances, availableCents: 0, inPayoutCents: 15804 } });
    renderRoute({ url: URL });
    expect(await screen.findByText('R$ 0,00 (R$ 158,04 em repasse)')).toBeInTheDocument();
    expect(screen.queryByText('já pode pedir o repasse')).toBeNull();
  });

  it('Por casamento: as somas e as legendas (346(1))', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const paths = mockCommissions();
    renderRoute({ url: URL });
    await user.click(await screen.findByRole('button', { name: 'Por casamento' }));
    // A aba não some na troca: o foco fica no botão (sugestão do Crivo).
    expect(screen.getByRole('button', { name: 'Por casamento' })).toHaveFocus();
    expect(await screen.findByText('libera em 02/12 e em 10/12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Por casamento' })).toHaveFocus();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Casamento',
      'Origem',
      'Pagamentos',
      'Aguardando liberação',
      'Disponível',
      'Já recebido',
      'Total',
    ]);
    // A Origem (346(1)).
    expect(within(row('Bianca e Henrique')).getByText('Pelo seu link')).toBeInTheDocument();
    // O reatribuído pelo Admin: "Indicação alterada" (350(8); 351(1)).
    expect(within(row('Ana e Marcos')).getByText('Indicação alterada')).toBeInTheDocument();
    expect(within(row('Paula e Diego')).getByText('Criado por você')).toBeInTheDocument();
    expect(within(row('Lívia e Bruno')).getByText('Convite do casal')).toBeInTheDocument();
    expect(
      within(row('Paula e Diego'))
        .getAllByText('R$ 61,62')
        .map((cell) => cell.tagName),
    ).toContain('STRONG');
    expect(within(row('Bianca e Henrique')).getByText('2')).toBeInTheDocument();
    // No cartão, a frase da Voz no lugar do rótulo e do número (350(13)).
    expect(within(row('Bianca e Henrique')).getByText('2 pagamentos')).toBeInTheDocument();
    expect(within(row('Lívia e Bruno')).getByText('1 pagamento')).toBeInTheDocument();
    expect(within(row('Ana e Marcos')).getByText('já pode pedir o repasse')).toBeInTheDocument();
    expect(within(row('Paula e Diego')).getByText('nada a liberar agora')).toBeInTheDocument();
    expect(within(row('Lívia e Bruno')).getByText('Libera em 15/12')).toBeInTheDocument();
    expect(within(row('Bianca e Henrique')).getAllByText('R$ 44,22')).toHaveLength(2);
    expect(paths.at(-1)).toBe('/v1/me/referrer/commissions?view=wedding&page=1');
    // As 7 colunas viram cartões até 1280 px (bloqueante do Crivo no PR da 346).
    expect(screen.getByRole('table', { name: 'Por casamento' }).parentElement).toHaveClass(
      'kore-data-table--wide',
    );
  });

  it('Por casamento: o Disponível negativo em vermelho, sem legenda; o "—" só no zero (353(1))', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockCommissions({
      wedding: [
        {
          weddingId: 'w9',
          coupleNames: 'Aline e Gustavo',
          weddingPurged: false,
          clickable: false,
          referralSource: 'referral_link',
          paymentsCount: 1,
          pendingCents: 0,
          availableCents: -5002,
          receivedCents: 5002,
          totalCents: 0,
          releaseDates: [],
        },
      ],
    });
    renderRoute({ url: URL });
    await user.click(await screen.findByRole('button', { name: 'Por casamento' }));
    const aline = (await screen.findByText('Aline e Gustavo')).closest(
      '[role="row"]',
    ) as HTMLElement;
    expect(within(aline).getByText('−R$ 50,02')).toHaveClass('kore-commissions__negative');
    // O Aguardando liberação zerado segue com o "—".
    expect(within(aline).getByText('—')).toBeInTheDocument();
    expect(within(aline).getByText('R$ 0,00')).toBeInTheDocument();
  });

  it('o vazio (textos-f3 B6)', async () => {
    mockCommissions({
      payment: [],
      balancesBody: { ...balances, availableCents: 0, receivedCents: 0 },
    });
    renderRoute({ url: URL });
    expect(await screen.findByText('Você ainda não tem comissões.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Elas aparecem aqui quando um casal que você indicou pagar a publicação do site.',
      ),
    ).toBeInTheDocument();
  });

  it('mais de 50: a paginação com "Mostrando 1 a 50 de 60"', async () => {
    mockCommissions({ total: 60 });
    renderRoute({ url: URL });
    expect(await screen.findByText('Mostrando 1 a 50 de 60')).toBeInTheDocument();
  });

  describe('"já pode pedir o repasse" só quando o pedido é possível (Repasse RN04; 347)', () => {
    it.each([
      ['abaixo do mínimo', { balancesBody: { ...balances, availableCents: 1740 } }],
      [
        'antes do próximo pedido',
        { payouts: { ...payoutsBody, nextRequestAt: '2026-12-10T03:00:00Z' } },
      ],
      ['com os repasses desligados', { payouts: { ...payoutsBody, payoutsEnabled: false } }],
      ['com um repasse em aberto', { balancesBody: { ...balances, inPayoutCents: 2000 } }],
    ])('%s: o cartão sem a legenda', async (_name, setup) => {
      mockCommissions(setup);
      renderRoute({ url: URL });
      await screen.findByText('Retida');
      expect(screen.queryByText('já pode pedir o repasse')).toBeNull();
    });

    it('abaixo do mínimo, na aba Por casamento: a linha disponível só com o valor', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockCommissions({ balancesBody: { ...balances, availableCents: 1740 } });
      renderRoute({ url: URL });
      await user.click(await screen.findByRole('button', { name: 'Por casamento' }));
      const [ana] = await screen.findAllByText('R$ 67,42');
      expect(
        within(ana?.closest('[role="row"]') as HTMLElement).queryByText('já pode pedir o repasse'),
      ).toBeNull();
      expect(screen.queryByText('já pode pedir o repasse')).toBeNull();
    });
  });
});
