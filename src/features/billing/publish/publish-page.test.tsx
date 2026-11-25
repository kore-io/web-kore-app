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
}: {
  lifecycleOverrides?: Partial<typeof lifecycle>;
  site?: { slug: string | null; eventDate: string | null; state: string | null };
} = {}) {
  const quotes: URLSearchParams[] = [];
  mockApi(({ path }) => {
    const url = new URL(path, 'http://api.test');
    if (url.pathname === '/v1/me') return Response.json(meFor(me(lifecycleOverrides)));
    if (url.pathname === '/v1/pricing') return Response.json(pricing);
    if (url.pathname === '/v1/weddings/w1/site') {
      return Response.json({ ...site, timezone: 'America/Sao_Paulo' });
    }
    if (url.pathname === '/v1/weddings/w1/billing/quote') {
      quotes.push(url.searchParams);
      return Response.json(quoteFor(url.searchParams));
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return quotes;
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
    // Até o E3, o Pagar e publicar fica desabilitado, sem motivo novo (decisão 322).
    expect(payButton()).toBeDisabled();
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
