import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderAreaScreen } from '../../../../tests/render-route';
import { formatCents } from '../../../shared/money';

const lifecycle = {
  status: 'draft',
  endDate: null,
  graceUntil: null,
  expiredAt: null,
  paidThrough: null,
  deletionScheduledFor: null,
  blocked: false,
};

const me = (overrides: Partial<typeof lifecycle> = {}) => ({
  user: { id: 'u1', name: 'Ana Beatriz Moreira', email: 'ana@exemplo.com', platformRole: 'none' },
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
      timezone: 'America/Sao_Paulo',
      lifecycle: { ...lifecycle, ...overrides },
    },
  ],
  profiles: ['couple'],
  lastProfileOnDevice: 'couple',
  planner: null,
  referrer: null,
  plannerSignupEnabled: true,
});

const pricing = {
  priceVersion: '2026-11',
  activationCents: 14900,
  monthlyCents: 2900,
  capCents: 44900,
  pixDiscountPercent: 3,
  installments: {
    max: 12,
    interestFreeUpTo: 6,
    interestPercent: 3.99,
    interestBasisPoints: 399,
    interestFixedCents: 49,
    minInstallmentCents: 500,
  },
  endDateMaxMonthsAfterEvent: 12,
  referralDiscountPercent: 10,
};

const LIMITS = { endDateMin: '2026-11-15', endDateMax: '2027-11-14' };

/**
 * A cotação do servidor, pelos exemplos da RN09: 7 meses (até 14/02/2027) com o desconto
 * da assessoria, e 12 meses (até 14/11/2027, no limite) com o teto.
 */
function quoteFor(params: URLSearchParams) {
  const endDate = params.get('endDate');
  const empty = {
    priceVersion: '2026-11',
    monthsCovered: null,
    periodStart: '2026-11-15',
    periodEnd: null,
    activationListCents: null,
    monthlyListCents: null,
    listTotalCents: null,
    capDiscountCents: null,
    referralDiscountCents: null,
    referralLabel: null,
    pixDiscountCents: null,
    installmentInterestCents: null,
    totalCents: null,
    installments: null,
    installmentCents: null,
    firstInstallmentCents: null,
    maxInstallments: null,
    totalsByMethod: null,
    ...LIMITS,
    canExtend: true,
    cannotExtendReason: null,
  };
  if (endDate === null) return empty;
  const twelve = endDate === '2027-11-14';
  const months = twelve ? 12 : 7;
  const list = 14900 + months * 2900;
  const cap = twelve ? list - 44900 : 0;
  const card = list - cap - 1490;
  const pix = twelve ? 42108 : 32699;
  const interest = twelve ? 1781 : 1394;
  const method = params.get('method');
  const installments = Number(params.get('installments') ?? '1');
  const withInterest = method === 'card' && installments > 6;
  const total = method === 'pix' ? pix : withInterest ? card + interest : card;
  return {
    ...empty,
    monthsCovered: months,
    periodEnd: endDate,
    activationListCents: 14900,
    monthlyListCents: 2900,
    listTotalCents: list,
    capDiscountCents: cap,
    referralDiscountCents: 1490,
    referralLabel: 'assessoria',
    pixDiscountCents: method === 'pix' ? card - pix : 0,
    installmentInterestCents: withInterest ? interest : 0,
    totalCents: total,
    installments: method === 'card' ? installments : 1,
    installmentCents: Math.floor(total / installments),
    firstInstallmentCents: Math.floor(total / installments) + (total % installments),
    maxInstallments: 12,
    totalsByMethod: { pix, cardUpTo6: card, cardChosen: method === 'card' ? total : card },
  };
}

function mockPublish({
  lifecycleOverrides = {},
  site = { slug: 'ana-e-marcos', eventDate: '2026-11-14', state: 'SP' },
  payer = null,
  pay = () =>
    Response.json(
      {
        paymentId: 'p1',
        status: 'pending',
        method: 'card',
        amountCents: 33710,
        nextAction: { type: 'none' },
      },
      { status: 201 },
    ),
  paidAfterPay = true,
  blockedAfterPay = false,
  pendingPayment = () => null,
}: {
  lifecycleOverrides?: Partial<typeof lifecycle>;
  site?: { slug: string | null; eventDate: string | null; state: string | null };
  /** O pagador anterior do GET …/billing (316(3)). */
  payer?: { name: string; taxIdLast4: string; payerId: string | null } | null;
  /** A resposta do POST …/payments. */
  pay?: (body: unknown) => Response;
  /** Depois do POST, o GET …/billing já traz o pagamento confirmado. */
  paidAfterPay?: boolean;
  /** Depois do POST, o /me traz o casamento bloqueado (o bloqueio em corrida). */
  blockedAfterPay?: boolean;
  /** O pendente do GET …/billing, pelo número de POSTs feitos. */
  pendingPayment?: (posts: number) => Record<string, unknown> | null;
} = {}) {
  const quotes: URLSearchParams[] = [];
  const payments: unknown[] = [];
  const fetchMock = mockApi(({ method, path, body }) => {
    const url = new URL(path, 'http://api.test');
    if (url.pathname === '/v1/me') {
      const blocked = blockedAfterPay && payments.length > 0;
      return Response.json(meFor(me({ ...lifecycleOverrides, ...(blocked && { blocked }) })));
    }
    if (url.pathname === '/v1/pricing') return Response.json(pricing);
    if (url.pathname === '/v1/weddings/w1/site') {
      return Response.json({ ...site, timezone: 'America/Sao_Paulo' });
    }
    if (url.pathname === '/v1/weddings/w1/billing/quote') {
      quotes.push(url.searchParams);
      return Response.json(quoteFor(url.searchParams));
    }
    if (url.pathname === '/v1/weddings/w1/billing') {
      const paid = paidAfterPay && payments.length > 0;
      return Response.json({
        status: paid ? 'published' : 'draft',
        publishedAt: null,
        endDate: null,
        paidThrough: null,
        graceUntil: null,
        expiredAt: null,
        purgeAt: null,
        publicationSource: null,
        awaitingPayment: false,
        pendingPayment: pendingPayment(payments.length),
        payments: paid ? [{ id: 'p1', status: 'paid' }] : [],
        payer,
      });
    }
    if (method === 'POST' && url.pathname === '/v1/weddings/w1/payments') {
      payments.push(body);
      return pay(body);
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return Object.assign(quotes, { payments, fetchMock });
}

/** Preenche o cartão válido de teste e quem paga. */
async function fillCardAndPayer(
  user: ReturnType<typeof userEvent.setup>,
  { payer = true }: { payer?: boolean } = {},
) {
  await user.type(screen.getByLabelText('Número do cartão'), '4111111111111111');
  await user.type(screen.getByLabelText('Nome impresso no cartão'), 'ANA B MOREIRA');
  await user.type(screen.getByLabelText('Validade'), '0829');
  await user.type(screen.getByLabelText('CVV'), '123');
  if (payer) {
    await user.type(screen.getByLabelText('Nome completo'), 'Ana Beatriz Moreira');
    await user.type(screen.getByLabelText('CPF'), '52998224725');
  }
}

const URL_PUBLISH = '/app/cobranca/publicar';

// O relógio fixo (o ano corrente decide o "de 2027" das datas); só o Date, para o debounce
// e o userEvent seguirem com os timers reais.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-24T15:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});
const brl = (cents: number) => formatCents({ cents });
/** O Testing Library normaliza o espaço sem quebra do DOM, e não o do texto esperado. */
const spaced = (text: string) => text.replace(/\u00a0/g, ' ');
const payButton = () => screen.getByRole('button', { name: 'Pagar e publicar' });
const dateField = () => screen.getByLabelText('Data de saída do ar');

async function chooseDate(user: ReturnType<typeof userEvent.setup>, value: string) {
  const field = await screen.findByLabelText('Data de saída do ar');
  await user.clear(field);
  await user.type(field, value);
}

/** O texto de uma linha do Resumo ou do Comparar, pelo rótulo (o termo e a descrição). */
function rowValue(panel: HTMLElement, label: string) {
  const term = within(panel).getByText(label);
  return term.nextElementSibling?.textContent;
}

describe('Publicar o site, a versão do casal (Publicar RN01; Preço RN03, RN04 e RN09)', () => {
  it('sem a data: os vazios do Resumo, do Comparar e das parcelas e o motivo do botão (Pena 7)', async () => {
    mockPublish();
    renderAreaScreen({ url: URL_PUBLISH });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Publicar o site' }),
    ).toBeInTheDocument();
    // O casal vê o subtítulo (a colaboradora, não: acréscimo à 323).
    expect(
      screen.getByText('Escolham até quando o site fica no ar. O pagamento é um só, feito agora.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Depois do casamento e até 14 de nov. de 2027. O mês incompleto conta como mês inteiro.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Escolham a data de saída do ar para ver o resumo.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Escolham a data de saída do ar para comparar as formas de pagamento.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Escolham a data para ver as parcelas.')).toBeInTheDocument();
    expect(payButton()).toBeDisabled();
    expect(payButton()).toHaveAccessibleDescription(
      'Escolham a data de saída do ar para publicar.',
    );
    // Sem preço no contrato antes da data.
    expect(screen.queryByText(/^Preço:/)).toBeNull();
  });

  it('com a data, o Resumo, o Comparar e o contrato da cotação (cartão em 1x)', async () => {
    const user = userEvent.setup();
    mockPublish();
    renderAreaScreen({ url: URL_PUBLISH });
    await chooseDate(user, '2027-02-14');
    const summary = await screen.findByRole('region', { name: 'Resumo' });
    await waitFor(() => expect(rowValue(summary, 'Ativação')).toBe(brl(14900)));
    expect(rowValue(summary, '7 meses × R$ 29')).toBe(brl(20300));
    expect(rowValue(summary, 'Desconto da assessoria (10%)')).toBe(brl(-1490));
    expect(rowValue(summary, 'Total')).toBe(brl(33710));
    expect(within(summary).queryByText('Preço máximo do Kore')).toBeNull();
    const compare = screen.getByRole('region', { name: 'Comparar as formas de pagamento' });
    expect(rowValue(compare, 'Pix à vista')).toBe(brl(32699));
    expect(rowValue(compare, 'Cartão em até 6x, sem juros')).toBe(brl(33710));
    expect(within(compare).getAllByRole('term')).toHaveLength(2);
    expect(
      screen.getByText(
        spaced(`Preço: ${brl(33710)}, pago uma vez. O site fica no ar até 14 de fev. de 2027.`),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Na publicação, o preço para em R$ 449. Depois de publicar, cada mês a mais custa R$ 29, sem esse limite.',
      ),
    ).toBeInTheDocument();
    // A desistência uma vez só, dentro do Resumo do contrato (decisão 323(d)).
    const contract = screen.getByRole('region', { name: 'Resumo do contrato' });
    const refund = screen.getAllByText(/^Vocês podem desistir em até 7 dias/);
    expect(refund).toHaveLength(1);
    expect(within(contract).getByText(/^Vocês podem desistir em até 7 dias/)).toBe(refund[0]);
    // Com o cartão e a cotação, o Pagar e publicar fica habilitado (E3), sem motivo.
    expect(payButton()).toBeEnabled();
    expect(payButton()).not.toHaveAccessibleDescription();
  });

  it('as parcelas: sem juros até 6x, com a 1ª separada quando não fecha, e com juros pela 2ª cotação (decisão 322)', async () => {
    const user = userEvent.setup();
    const quotes = mockPublish();
    renderAreaScreen({ url: URL_PUBLISH });
    await chooseDate(user, '2027-02-14');
    const select = screen.getByLabelText('Parcelas');
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(12));
    const options = within(select)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options[1]).toBe(`2x de ${brl(16855)} sem juros`);
    expect(options[2]).toBe(`3x sem juros: 1ª de ${brl(11238)} e as outras de ${brl(11236)}`);
    expect(options[7]).toBe(`8x de ${brl(4388)} com juros (total ${brl(35104)})`);
    // A 2ª cotação, só para o total com juros, pede 7x no cartão.
    expect(quotes.some((params) => params.get('installments') === '7')).toBe(true);
  });

  it('em 8x: a linha dos juros, o Alert de juros e a 3ª linha do Comparar', async () => {
    const user = userEvent.setup();
    mockPublish();
    renderAreaScreen({ url: URL_PUBLISH });
    await chooseDate(user, '2027-02-14');
    const select = screen.getByLabelText('Parcelas');
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(12));
    await user.selectOptions(select, '8');
    const summary = screen.getByRole('region', { name: 'Resumo' });
    await waitFor(() => expect(rowValue(summary, 'Juros do cartão (8x)')).toBe(brl(1394)));
    expect(rowValue(summary, 'Total')).toBe(brl(35104));
    expect(
      screen.getByText(
        spaced(
          `Em 8x, o cartão cobra juros de ${brl(1394)} (3,99% + ${brl(49)} sobre o valor). Vocês pagam ${brl(35104)} no total. Até 6x, não há juros.`,
        ),
      ),
    ).toBeInTheDocument();
    const compare = screen.getByRole('region', { name: 'Comparar as formas de pagamento' });
    expect(rowValue(compare, 'Cartão em 8x, com juros')).toBe(brl(35104));
  });

  it('no Pix: o desconto do Pix no Resumo e sem parcelas', async () => {
    const user = userEvent.setup();
    mockPublish();
    renderAreaScreen({ url: URL_PUBLISH });
    await chooseDate(user, '2027-02-14');
    await user.click(screen.getByRole('radio', { name: 'Pix à vista · 3% de desconto' }));
    const summary = screen.getByRole('region', { name: 'Resumo' });
    await waitFor(() => expect(rowValue(summary, 'Desconto do Pix (3%)')).toBe(brl(-1011)));
    expect(rowValue(summary, 'Total')).toBe(brl(32699));
    expect(screen.queryByLabelText('Parcelas')).toBeNull();
  });

  it('a data no limite: o teto com a legenda, sem o Alert de meses', async () => {
    const user = userEvent.setup();
    mockPublish();
    renderAreaScreen({ url: URL_PUBLISH });
    await chooseDate(user, '2027-11-14');
    const summary = screen.getByRole('region', { name: 'Resumo' });
    await waitFor(() => expect(rowValue(summary, 'Preço máximo do Kore')).toBe(brl(-4800)));
    expect(
      within(summary).getByText('A publicação custa no máximo R$ 449, a partir de 11 meses.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Na publicação, o preço para em/)).toBeNull();
  });

  it('a data fora do limite: o erro no campo, sem cotação dela', async () => {
    const user = userEvent.setup();
    const quotes = mockPublish();
    renderAreaScreen({ url: URL_PUBLISH });
    await chooseDate(user, '2027-12-14');
    expect(
      await screen.findByText('Escolham uma data depois do casamento e até 14 de nov. de 2027.'),
    ).toBeInTheDocument();
    expect(dateField()).toHaveAttribute('aria-invalid', 'true');
    expect(quotes.some((params) => params.get('endDate') === '2027-12-14')).toBe(false);
  });

  it.each([
    [{ lifecycleOverrides: { blocked: true } }, 'Indisponível enquanto o site está bloqueado.'],
    [
      { site: { slug: null, eventDate: '2026-11-14', state: 'SP' } },
      'Escolham o endereço do site em Dados básicos para publicar.',
    ],
    [
      { site: { slug: 'ana-e-marcos', eventDate: null, state: 'SP' } },
      'Informem a data do casamento em Dados básicos para publicar.',
    ],
    [
      { site: { slug: 'ana-e-marcos', eventDate: null, state: null } },
      'Informem a data e a UF do casamento em Dados básicos para publicar.',
    ],
  ])(
    'o bloqueio conhecido aparece ao lado do botão, sem cotação (228(4)): %#',
    async (setup, reason) => {
      const quotes = mockPublish(setup);
      renderAreaScreen({ url: URL_PUBLISH });
      expect(await screen.findByText(reason)).toBeInTheDocument();
      expect(payButton()).toHaveAccessibleDescription(reason);
      expect(dateField()).toBeDisabled();
      expect(quotes).toHaveLength(0);
    },
  );

  it('o site já publicado volta ao Dashboard', async () => {
    mockPublish({ lifecycleOverrides: { status: 'published' } });
    const { router } = renderAreaScreen({ url: URL_PUBLISH });
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
  });

  it('Cancelar volta ao Dashboard (decisão 322)', async () => {
    const user = userEvent.setup();
    mockPublish();
    const { router } = renderAreaScreen({ url: URL_PUBLISH });
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
  });

  it('sem violações de acessibilidade, com a cotação', async () => {
    const user = userEvent.setup();
    mockPublish();
    const { container } = renderAreaScreen({ url: URL_PUBLISH });
    await chooseDate(user, '2027-02-14');
    await screen.findByText('Ativação');
    await expectNoA11yViolations({ container });
  });
});

describe('Publicar o site, o pagar com o cartão (E3; Publicar RN02 a RN07; decisão 322(3))', () => {
  async function ready(user: ReturnType<typeof userEvent.setup>) {
    await chooseDate(user, '2027-02-14');
    await waitFor(() => expect(payButton()).toBeEnabled());
  }

  it('sem os dados, os erros de cada campo e nada mandado (Pena, item 5; 322(4))', async () => {
    const user = userEvent.setup();
    const api = mockPublish();
    renderAreaScreen({ url: URL_PUBLISH });
    await ready(user);
    await user.click(payButton());
    for (const text of [
      'Informem o número do cartão.',
      'Informem o nome como está impresso no cartão.',
      'Informem a validade, como 08/29.',
      'Informem o CVV, os 3 ou 4 números no verso ou na frente do cartão.',
      'Informem o nome de quem paga.',
      'Este CPF não é válido. Confiram os números.',
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Número do cartão')).toHaveAttribute('aria-invalid', 'true');
    // O foco no 1º campo inválido (sugestão do Crivo no E3).
    await waitFor(() => expect(screen.getByLabelText('Número do cartão')).toHaveFocus());
    expect(api.payments).toEqual([]);
  });

  it('paga: o corpo com o token local, o total esperado e a Idempotency-Key; confirma e volta ao Dashboard', async () => {
    const user = userEvent.setup();
    const api = mockPublish();
    const { router } = renderAreaScreen({ url: URL_PUBLISH });
    await ready(user);
    await fillCardAndPayer(user);
    await user.click(payButton());
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(api.payments).toEqual([
      {
        kind: 'publication',
        endDate: '2027-02-14',
        method: 'card',
        installments: 1,
        payer: { name: 'Ana Beatriz Moreira', taxId: '52998224725' },
        cardToken: 'local_card_1111',
        priceVersion: '2026-11',
        expectedTotalCents: 33710,
      },
    ]);
    const call = api.fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith('/v1/weddings/w1/payments'),
    );
    const headers = (call?.[1]?.headers ?? {}) as Record<string, string>;
    expect(headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('o cartão em análise mostra o "Confirmando…" e espera a confirmação (RN04)', async () => {
    const user = userEvent.setup();
    mockPublish({
      paidAfterPay: false,
      // Depois do POST, o cartão segue pendente no billing.
      pendingPayment: (posts) =>
        posts > 0
          ? {
              paymentId: 'p1',
              kind: 'publication',
              method: 'card',
              amountCents: 33710,
              dueAt: null,
              pixCopyPaste: null,
            }
          : null,
    });
    renderAreaScreen({ url: URL_PUBLISH });
    await ready(user);
    await fillCardAndPayer(user);
    await user.click(payButton());
    // O Spinner (um status, com o texto para o leitor de tela) e a frase visível.
    expect(
      await screen.findAllByText(
        'Confirmando o pagamento com o banco do cartão. Isso leva alguns segundos.',
      ),
    ).not.toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('Confirmando o pagamento');
    expect(payButton()).toBeDisabled();
  });

  it('o cartão recusado: o Alert e o casal tenta de novo na mesma tela (RN03)', async () => {
    const user = userEvent.setup();
    const api = mockPublish({
      pay: () =>
        Response.json(
          {
            paymentId: 'p1',
            status: 'failed',
            method: 'card',
            amountCents: 33710,
            failureReason: 'card_declined',
            nextAction: { type: 'none' },
          },
          { status: 201 },
        ),
    });
    renderAreaScreen({ url: URL_PUBLISH });
    await ready(user);
    await fillCardAndPayer(user);
    await user.click(payButton());
    expect(
      await screen.findByText(
        'O banco do cartão não aprovou o pagamento. Confiram os dados, usem outro cartão ou paguem com Pix.',
      ),
    ).toBeInTheDocument();
    expect(payButton()).toBeEnabled();
    // Outra tentativa é outra intenção: chave nova (B2-10).
    await user.click(payButton());
    await waitFor(() => expect(api.payments).toHaveLength(2));
    const keys = api.fetchMock.mock.calls
      .filter(([input]) => String(input).endsWith('/v1/weddings/w1/payments'))
      .map(([, init]) => (init?.headers as Record<string, string>)['Idempotency-Key']);
    expect(new Set(keys).size).toBe(2);
  });

  it('o pagador anterior: o nome e o CPF final, o pagar pelo payerId e o Usar outro CPF (316(3))', async () => {
    const user = userEvent.setup();
    const api = mockPublish({
      payer: { name: 'Ana Beatriz Moreira', taxIdLast4: '4821', payerId: 'pay-1' },
    });
    renderAreaScreen({ url: URL_PUBLISH });
    await ready(user);
    expect(await screen.findByText('Ana Beatriz Moreira · CPF final 4821')).toBeInTheDocument();
    expect(screen.queryByLabelText('CPF')).toBeNull();
    await fillCardAndPayer(user, { payer: false });
    await user.click(payButton());
    await waitFor(() => expect(api.payments).toHaveLength(1));
    expect(api.payments[0]).toMatchObject({ payer: { payerId: 'pay-1' } });
  });

  it('Usar outro CPF abre o nome e o CPF', async () => {
    const user = userEvent.setup();
    mockPublish({ payer: { name: 'Ana Beatriz Moreira', taxIdLast4: '4821', payerId: 'pay-1' } });
    renderAreaScreen({ url: URL_PUBLISH });
    await ready(user);
    await user.click(await screen.findByRole('button', { name: 'Usar outro CPF' }));
    expect(screen.getByLabelText('CPF')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome completo')).toBeInTheDocument();
  });

  it('o 422 PAYER_NOT_FOUND volta a pedir o CPF', async () => {
    const user = userEvent.setup();
    mockPublish({
      payer: { name: 'Ana Beatriz Moreira', taxIdLast4: '4821', payerId: 'pay-1' },
      pay: () => apiError({ status: 422, body: { error: 'PAYER_NOT_FOUND' } }),
    });
    renderAreaScreen({ url: URL_PUBLISH });
    await ready(user);
    await fillCardAndPayer(user, { payer: false });
    await user.click(payButton());
    expect(await screen.findByLabelText('CPF')).toBeInTheDocument();
  });

  it.each([
    ['PRICE_CHANGED', 409, 'O valor mudou. Confiram o novo total antes de pagar.'],
    ['PAYMENT_PENDING', 409, 'Já há um pagamento aguardando confirmação. Vejam em Pagamentos.'],
    [
      'GATEWAY_UNAVAILABLE',
      503,
      'O serviço de pagamento não respondeu. Tentem de novo em alguns minutos. Se continuar, escrevam para suporte@kore.com.br.',
    ],
    [
      'REFUND_IN_PROGRESS',
      409,
      'O reembolso anterior ainda está em andamento. Publiquem de novo quando ele for concluído.',
    ],
  ])('o %s mostra o aviso da Voz', async (error, status, text) => {
    const user = userEvent.setup();
    const api = mockPublish({ pay: () => apiError({ status, body: { error } }) });
    renderAreaScreen({ url: URL_PUBLISH });
    await ready(user);
    const quotesBefore = api.length;
    await fillCardAndPayer(user);
    await user.click(payButton());
    expect(await screen.findByText(text)).toBeInTheDocument();
    // O valor mudou: a cotação de novo (Preço RN05).
    if (error === 'PRICE_CHANGED')
      await waitFor(() => expect(api.length).toBeGreaterThan(quotesBefore));
  });

  it('o 403 WEDDING_BLOCKED em corrida refaz o /me: o motivo e a tela desabilitada (Bloqueado RN07)', async () => {
    const user = userEvent.setup();
    mockPublish({
      blockedAfterPay: true,
      pay: () => apiError({ status: 403, body: { error: 'WEDDING_BLOCKED' } }),
    });
    renderAreaScreen({ url: URL_PUBLISH });
    await ready(user);
    await fillCardAndPayer(user);
    await user.click(payButton());
    await waitFor(() =>
      expect(payButton()).toHaveAccessibleDescription(
        'Indisponível enquanto o site está bloqueado.',
      ),
    );
    expect(payButton()).toBeDisabled();
    expect(dateField()).toBeDisabled();
  });

  it('com o Pix: só quem paga, o POST sem cartão e a tela do Pix (E4)', async () => {
    const user = userEvent.setup();
    const api = mockPublish({
      paidAfterPay: false,
      pendingPayment: (posts) =>
        posts > 0
          ? {
              paymentId: 'p1',
              kind: 'publication',
              method: 'pix',
              amountCents: 32699,
              dueAt: '2026-11-25T15:00:00Z',
              pixCopyPaste: '00020126LOCALPIX',
            }
          : null,
      pay: () =>
        Response.json(
          {
            paymentId: 'p1',
            status: 'pending',
            method: 'pix',
            amountCents: 32699,
            dueAt: '2026-11-25T15:00:00Z',
            pix: { copyPaste: '00020126LOCALPIX' },
            nextAction: { type: 'none' },
          },
          { status: 201 },
        ),
    });
    const { router } = renderAreaScreen({ url: URL_PUBLISH });
    await ready(user);
    await user.click(screen.getByRole('radio', { name: 'Pix à vista · 3% de desconto' }));
    expect(screen.queryByLabelText('Número do cartão')).toBeNull();
    await user.type(screen.getByLabelText('Nome completo'), 'Ana Beatriz Moreira');
    await user.type(screen.getByLabelText('CPF'), '52998224725');
    await waitFor(() => expect(payButton()).toBeEnabled());
    const visited: [string, unknown][] = [];
    router.subscribe((state) => visited.push([state.location.pathname, state.location.state]));
    await user.click(payButton());
    // A tela do Pix, com a data (o Gerar novo Pix volta com ela; 324).
    await waitFor(() =>
      expect(visited[0]).toEqual(['/app/cobranca/pix', { endDate: '2027-02-14' }]),
    );
    expect(api.payments).toEqual([
      {
        kind: 'publication',
        endDate: '2027-02-14',
        method: 'pix',
        payer: { name: 'Ana Beatriz Moreira', taxId: '52998224725' },
        installments: 1,
        priceVersion: '2026-11',
        expectedTotalCents: 32699,
      },
    ]);
  });

  it('reabrir com o Pix pendente leva à tela do Pix (decisão 324)', async () => {
    mockPublish({
      pendingPayment: () => ({
        paymentId: 'p0',
        kind: 'publication',
        method: 'pix',
        amountCents: 32699,
        dueAt: '2026-11-25T15:00:00Z',
        pixCopyPaste: '00020126LOCALPIX',
      }),
    });
    const { router } = renderAreaScreen({ url: URL_PUBLISH });
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/cobranca/pix'));
    // Sem a data no app (a tela recém-aberta), vai sem ela (324).
    expect(router.state.location.state).toEqual({});
  });

  it('reabrir com o cartão pendente retoma o Confirmando (decisão 324; cobrança do Crivo)', async () => {
    mockPublish({
      paidAfterPay: false,
      pendingPayment: () => ({
        paymentId: 'p0',
        kind: 'publication',
        method: 'card',
        amountCents: 33710,
        dueAt: null,
        pixCopyPaste: null,
      }),
    });
    renderAreaScreen({ url: URL_PUBLISH });
    expect(
      await screen.findAllByText(
        'Confirmando o pagamento com o banco do cartão. Isso leva alguns segundos.',
      ),
    ).not.toHaveLength(0);
    expect(payButton()).toBeDisabled();
  });

  it('o cartão que sai do pendente sem o site publicado vira o recusado (a lista só traz os aplicados)', async () => {
    const user = userEvent.setup();
    // Depois do POST, o billing não tem mais o pendente nem o site publicado.
    mockPublish({ paidAfterPay: false });
    renderAreaScreen({ url: URL_PUBLISH });
    await ready(user);
    await fillCardAndPayer(user);
    await user.click(payButton());
    expect(
      await screen.findByText(
        'O banco do cartão não aprovou o pagamento. Confiram os dados, usem outro cartão ou paguem com Pix.',
      ),
    ).toBeInTheDocument();
  });

  it('vindo da tela do Pix (Pagar com cartão): a forma, a data e o replacesPaymentId (RN07; 324)', async () => {
    const user = userEvent.setup();
    const api = mockPublish();
    renderAreaScreen({
      url: URL_PUBLISH,
      state: { method: 'card', endDate: '2027-02-14', replacesPaymentId: 'p0' },
    });
    await waitFor(() => expect(payButton()).toBeEnabled());
    expect(dateField()).toHaveValue('2027-02-14');
    await fillCardAndPayer(user);
    await user.click(payButton());
    await waitFor(() => expect(api.payments).toHaveLength(1));
    expect(api.payments[0]).toMatchObject({ method: 'card', replacesPaymentId: 'p0' });
  });

  it('o PAYMENT_ALREADY_PAID mostra o Toast da Pena e vai ao Dashboard (RN07; Pena, item 2)', async () => {
    const user = userEvent.setup();
    mockPublish({ pay: () => apiError({ status: 409, body: { error: 'PAYMENT_ALREADY_PAID' } }) });
    const { router } = renderAreaScreen({ url: URL_PUBLISH });
    await ready(user);
    await fillCardAndPayer(user);
    await user.click(payButton());
    expect(
      await screen.findByText(
        'Este Pix já foi pago. O pagamento foi confirmado e o site está no ar.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
  });
});

describe('Publicar o site, a versão da colaboradora (decisão 323)', () => {
  it('o cabeçalho, o contrato sem o preço e o botão com o motivo; sem cotação', async () => {
    profileUnderTest.current = 'planner';
    const quotes = mockPublish();
    renderAreaScreen({ url: URL_PUBLISH });
    expect(await screen.findByText('Só o casal pode publicar e pagar.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Publicar o site' })).toBeInTheDocument();
    // O título sem o subtítulo do casal (acréscimo à 323).
    expect(screen.queryByText(/^Escolham até quando o site fica no ar/)).toBeNull();
    expect(screen.getByRole('region', { name: 'Resumo do contrato' })).toBeInTheDocument();
    expect(payButton()).toBeDisabled();
    expect(payButton()).toHaveAccessibleDescription('Só o casal pode publicar e pagar.');
    for (const name of ['Resumo', 'Comparar as formas de pagamento', 'Forma de pagamento']) {
      expect(screen.queryByRole('region', { name })).toBeNull();
    }
    expect(screen.queryByLabelText('Data de saída do ar')).toBeNull();
    expect(screen.queryByText(/^Preço:/)).toBeNull();
    expect(quotes).toHaveLength(0);
  });
});
