import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderAreaScreen, renderRoute } from '../../../../tests/render-route';

function me(lifecycle: Record<string, unknown>) {
  return {
    user: { id: 'u1', name: 'Ana Beatriz Moreira', email: 'ana@exemplo.com', platformRole: 'none' },
    activeProfile: 'couple',
    authenticatedAt: '2026-11-24T12:00:00Z',
    memberships: [
      {
        weddingId: 'w1',
        role: 'owner',
        weddingName: 'Ana & Marcos',
        eventDate: '2026-11-14',
        city: 'Campinas',
        state: 'SP',
        timezone: 'America/Sao_Paulo',
        lifecycle: {
          status: 'published',
          endDate: '2027-02-14',
          graceUntil: null,
          expiredAt: null,
          paidThrough: '2027-02-14',
          deletionScheduledFor: null,
          blocked: false,
          ...lifecycle,
        },
      },
    ],
    profiles: ['couple'],
    lastProfileOnDevice: 'couple',
    planner: null,
    referrer: null,
    plannerSignupEnabled: true,
  };
}

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

/** A cotação da extensão: 3 meses (R$ 87,00), o desconto do Pix (R$ 2,61), do periodStart dado. */
function quoteFor({
  params,
  periodStart,
  canExtend,
}: {
  params: URLSearchParams;
  periodStart: string;
  canExtend: boolean;
}) {
  const endDate = params.get('endDate');
  const empty = {
    priceVersion: '2026-11',
    monthsCovered: null,
    periodStart,
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
    endDateMin: '2026-12-02',
    endDateMax: '2027-11-14',
    canExtend,
    cannotExtendReason: canExtend ? null : 'END_DATE_LIMIT_REACHED',
  };
  if (endDate === null) return empty;
  const method = params.get('method');
  const total = method === 'pix' ? 8439 : 8700;
  return {
    ...empty,
    monthsCovered: 3,
    periodEnd: endDate,
    monthlyListCents: 2900,
    listTotalCents: 8700,
    pixDiscountCents: method === 'pix' ? 261 : 0,
    installmentInterestCents: 0,
    totalCents: total,
    installments: 1,
    installmentCents: total,
    firstInstallmentCents: total,
    maxInstallments: 3,
    totalsByMethod: { pix: 8439, cardUpTo6: 8700, cardChosen: 8700 },
  };
}

interface Calls {
  patches: unknown[];
  payments: unknown[];
}

function mockEndDate({
  lifecycle = {},
  patch = (body: { endDate: string }) =>
    Response.json({ endDate: body.endDate, paidThrough: '2027-02-14', status: 'post_event' }),
  pay = () => Response.json({ paymentId: 'x1', status: 'paid', method: 'card' }, { status: 201 }),
  periodStart = '2027-02-14',
  canExtend = true,
  purgeAt = null,
}: {
  lifecycle?: Record<string, unknown>;
  patch?: (body: { endDate: string }) => Response;
  pay?: (body: unknown) => Response;
  periodStart?: string;
  canExtend?: boolean;
  purgeAt?: string | null;
} = {}) {
  const calls: Calls = { patches: [], payments: [] };
  mockApi(({ method, path, body }) => {
    const url = new URL(path, 'http://api.test');
    if (url.pathname === '/v1/me') return Response.json(meFor(me(lifecycle)));
    if (url.pathname === '/v1/pricing') return Response.json(pricing);
    if (url.pathname === '/v1/weddings/w1/billing/quote') {
      return Response.json(quoteFor({ params: url.searchParams, periodStart, canExtend }));
    }
    if (url.pathname === '/v1/weddings/w1/billing') {
      return Response.json({
        status: 'published',
        publishedAt: '2026-08-10T14:48:00Z',
        endDate: '2027-05-14',
        paidThrough: '2027-05-14',
        graceUntil: null,
        expiredAt: null,
        purgeAt,
        publicationSource: 'payment',
        awaitingPayment: false,
        pendingPayment: null,
        payments: [],
        payer: null,
      });
    }
    if (url.pathname === '/v1/weddings/w1/end-date' && method === 'PATCH') {
      calls.patches.push(body);
      return patch(body as { endDate: string });
    }
    if (url.pathname === '/v1/weddings/w1/payments' && method === 'POST') {
      calls.payments.push(body);
      return pay(body);
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const URL_END_DATE = '/app/cobranca/data-de-saida';
const field = () => screen.getByLabelText('Nova data de saída do ar');
const setDate = (value: string) => fireEvent.change(field(), { target: { value } });
const ready = () => screen.findByRole('heading', { level: 1, name: 'Mudar a data de saída do ar' });

async function fillCardAndPayer(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Número do cartão'), '4111111111111111');
  await user.type(screen.getByLabelText('Nome impresso no cartão'), 'ANA B MOREIRA');
  await user.type(screen.getByLabelText('Validade'), '0829');
  await user.type(screen.getByLabelText('CVV'), '123');
  await user.type(screen.getByLabelText('Nome completo'), 'Ana Beatriz Moreira');
  await user.type(screen.getByLabelText('CPF'), '52998224725');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-12-01T15:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Mudar a data de saída do ar, sem pagar (Data de saída RN05; 289; 293; Penpot 21, A6)', () => {
  it('no ar: o título, a data atual e a ajuda', async () => {
    mockEndDate();
    renderRoute({ url: URL_END_DATE });
    await ready();
    expect(screen.getByText('No ar até 14 de fev. de 2027')).toBeInTheDocument();
    expect(field()).toHaveValue('2027-02-14');
    expect(field()).toHaveAccessibleDescription(
      'Até 14 de nov. de 2027, 12 meses depois do casamento.',
    );
  });

  it('antecipar: o aviso, o Antecipar a data, o PATCH e o Toast; volta a Pagamentos (RN05)', async () => {
    const user = userEvent.setup();
    const calls = mockEndDate();
    const { router } = renderRoute({ url: URL_END_DATE });
    await ready();
    setDate('2027-01-10');
    expect(
      screen.getByText('Antecipar a data não devolve dinheiro: os meses já pagos não voltam.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Antecipar a data' }));
    expect(
      await screen.findByText('O site fica no ar até 10 de jan. de 2027.'),
    ).toBeInTheDocument();
    expect(calls.patches).toEqual([{ endDate: '2027-01-10' }]);
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/cobranca'));
  });

  it('quem antecipou: a ajuda em duas faixas e o Voltar a data de graça (293(3)(4))', async () => {
    mockEndDate({ lifecycle: { endDate: '2027-01-10' } });
    renderRoute({ url: URL_END_DATE });
    await ready();
    expect(field()).toHaveAccessibleDescription(
      'Até 14 de fev. de 2027, sem custo. Depois dela, até 14 de nov. de 2027, com os meses a mais.',
    );
    setDate('2027-02-14');
    expect(
      screen.getByText('Sem cobrança: vocês já pagaram até 14 de fev. de 2027.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar a data' })).toBeEnabled();
    expect(screen.queryByText(/^Antecipar a data não devolve/)).toBeNull();
  });

  it('o caso B no expirado: Fora do ar desde, a data paga, o Voltar ao ar e o Toast da 293(6) (289(1))', async () => {
    const user = userEvent.setup();
    const calls = mockEndDate({
      lifecycle: { status: 'expired', endDate: '2026-11-20', expiredAt: '2026-11-28' },
    });
    renderRoute({ url: URL_END_DATE });
    expect(await screen.findByText('Fora do ar desde 28 de nov.')).toBeInTheDocument();
    expect(field()).toHaveValue('2027-02-14');
    await user.click(screen.getByRole('button', { name: 'Voltar ao ar' }));
    expect(
      await screen.findByText('O site voltou ao ar e fica até 14 de fev. de 2027.'),
    ).toBeInTheDocument();
    expect(calls.patches).toEqual([{ endDate: '2027-02-14' }]);
  });

  it('o caso B no ano corrente: o Alert com um ponto só, e a faixa sem o Voltar ao ar na própria tela', async () => {
    mockEndDate({
      lifecycle: {
        status: 'expired',
        endDate: '2026-11-20',
        expiredAt: '2026-11-28',
        paidThrough: '2026-12-25',
      },
    });
    renderRoute({ url: URL_END_DATE });
    expect(
      await screen.findByText('Sem cobrança: vocês já pagaram até 25 de dez.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Voltar ao ar' })).toBeNull();
  });

  it('o 422 END_DATE_BEYOND_PAID: o texto da 293(8) no campo', async () => {
    const user = userEvent.setup();
    mockEndDate({
      lifecycle: { endDate: '2027-01-10' },
      patch: () =>
        apiError({
          status: 422,
          body: { error: 'END_DATE_BEYOND_PAID', paidThrough: '2027-01-31' },
        }),
    });
    renderRoute({ url: URL_END_DATE });
    await ready();
    setDate('2027-02-14');
    await user.click(screen.getByRole('button', { name: 'Voltar a data' }));
    await waitFor(() =>
      expect(field()).toHaveAccessibleDescription(
        'Esta data é depois do que vocês já pagaram. Atualizem a tela e escolham de novo.',
      ),
    );
  });

  it('fora dos limites: o erro com a data mínima e o limite (335; pena-e11)', async () => {
    mockEndDate();
    renderRoute({ url: URL_END_DATE });
    await ready();
    setDate('2027-12-01');
    expect(field()).toHaveAccessibleDescription(
      'Escolham uma data de 2 de dez. de 2026 até 14 de nov. de 2027.',
    );
    expect(screen.getByRole('button', { name: 'Pagar e adiar' })).toBeDisabled();
  });

  it('bloqueado: o primário desabilitado com o motivo', async () => {
    mockEndDate({ lifecycle: { endDate: '2027-01-10', blocked: true } });
    renderRoute({ url: URL_END_DATE });
    await ready();
    setDate('2027-02-14');
    const button = screen.getByRole('button', { name: 'Voltar a data' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Indisponível enquanto o site está bloqueado.');
  });

  it('a colaboradora volta a Pagamentos', async () => {
    profileUnderTest.current = 'planner';
    mockEndDate();
    const { router } = renderAreaScreen({ url: URL_END_DATE });
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/cobranca'));
  });
});

describe('Pagar a extensão (Data de saída RN04; Preço RN03; 293(1)(2); Penpot 21, A6; E11)', () => {
  it('adiar no cartão: o Resumo, o Pagar e adiar, o POST da extensão e o Toast da nova data', async () => {
    const user = userEvent.setup();
    const calls = mockEndDate();
    const { router } = renderRoute({ url: URL_END_DATE });
    await ready();
    setDate('2027-05-14');
    const summary = (await screen.findByRole('heading', { name: 'Resumo' })).closest(
      'section',
    ) as HTMLElement;
    expect(await within(summary).findByText('3 meses a mais × R$ 29')).toBeInTheDocument();
    await fillCardAndPayer(user);
    await user.click(screen.getByRole('button', { name: 'Pagar e adiar' }));
    expect(
      await screen.findByText('O site fica no ar até 14 de mai. de 2027.'),
    ).toBeInTheDocument();
    expect(calls.payments).toEqual([
      expect.objectContaining({
        kind: 'extension',
        endDate: '2027-05-14',
        method: 'card',
        installments: 1,
        cardToken: 'local_card_1111',
        expectedTotalCents: 8700,
      }),
    ]);
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/cobranca'));
  });

  it('renovar o expirado sem mês pago: "de hoje" no Resumo e a ajuda, com o Pagar e renovar (293(1)(2))', async () => {
    mockEndDate({
      lifecycle: {
        status: 'expired',
        endDate: '2026-11-20',
        paidThrough: '2026-11-20',
        expiredAt: '2026-11-28',
      },
      periodStart: '2026-12-01',
    });
    renderRoute({ url: URL_END_DATE });
    await ready();
    expect(field()).toHaveValue('');
    setDate('2027-03-01');
    expect(
      await screen.findByText('3 meses × R$ 29 (de hoje até 1 de mar. de 2027)'),
    ).toBeInTheDocument();
    expect(field()).toHaveAccessibleDescription('Os meses contam a partir de hoje.');
    expect(screen.getByRole('button', { name: 'Pagar e renovar' })).toBeEnabled();
  });

  it('o caso B depois da data paga: os meses contam do paidThrough (293(1)(2))', async () => {
    mockEndDate({
      lifecycle: { status: 'expired', endDate: '2026-11-20', expiredAt: '2026-11-28' },
    });
    renderRoute({ url: URL_END_DATE });
    await screen.findByText('Fora do ar desde 28 de nov.');
    setDate('2027-05-14');
    expect(
      await screen.findByText('3 meses × R$ 29 (de 14 de fev. de 2027 até 14 de mai. de 2027)'),
    ).toBeInTheDocument();
    expect(field()).toHaveAccessibleDescription(
      'Vocês já pagaram até 14 de fev. de 2027. Os meses contam a partir dessa data.',
    );
  });

  it('a carência abre o campo vazio, e não na data que já passou (sugestão do Crivo no E10)', async () => {
    mockEndDate({
      lifecycle: {
        status: 'grace',
        endDate: '2026-11-28',
        paidThrough: '2026-11-28',
        graceUntil: '2026-12-05',
      },
    });
    renderRoute({ url: URL_END_DATE });
    await ready();
    expect(screen.getByText('No ar até 5 de dez.')).toBeInTheDocument();
    expect(field()).toHaveValue('');
    expect(field()).toHaveAccessibleDescription(
      'Até 14 de nov. de 2027, 12 meses depois do casamento.',
    );
  });

  it.each([
    // O mês pago à frente também já passou: vazio, e não uma data com erro.
    ['2026-11-30', ''],
    // Hoje é 01/12: o mês pago à frente ainda passou (o mínimo é amanhã).
    ['2026-12-01', ''],
    // A partir de amanhã, o campo abre no mês pago à frente.
    ['2026-12-02', '2026-12-02'],
    ['2026-12-20', '2026-12-20'],
  ])(
    'a carência com o paidThrough %s depois da endDate abre o campo em "%s" (335(1))',
    async (paidThrough, value) => {
      mockEndDate({
        lifecycle: {
          status: 'grace',
          endDate: '2026-11-28',
          paidThrough,
          graceUntil: '2026-12-05',
        },
      });
      renderRoute({ url: URL_END_DATE });
      await ready();
      expect(field()).toHaveValue(value);
      expect(field()).not.toHaveAttribute('aria-invalid', 'true');
    },
  );

  it('no Pix, a extensão segue para a tela do Pix com o kind', async () => {
    const user = userEvent.setup();
    mockEndDate({
      pay: () =>
        Response.json({ paymentId: 'x2', status: 'pending', method: 'pix' }, { status: 201 }),
    });
    const { router } = renderRoute({ url: URL_END_DATE });
    await ready();
    setDate('2027-05-14');
    await user.click(await screen.findByText('Pix à vista · 3% de desconto'));
    await user.type(screen.getByLabelText('Nome completo'), 'Ana Beatriz Moreira');
    await user.type(screen.getByLabelText('CPF'), '52998224725');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Pagar e adiar' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Pagar e adiar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/cobranca/pix'));
    expect(router.state.location.state).toEqual({ endDate: '2027-05-14', kind: 'extension' });
  });

  it('sem renovação: a A7, com a guarda dos dados e o Exportar os convidados (314; Retenção RN01)', async () => {
    vi.setSystemTime(new Date('2027-11-25T15:00:00Z'));
    mockEndDate({
      lifecycle: {
        status: 'expired',
        endDate: '2027-11-10',
        paidThrough: '2027-11-10',
        expiredAt: '2027-11-22',
      },
      canExtend: false,
      purgeAt: '2028-05-22',
    });
    renderRoute({ url: URL_END_DATE });
    expect(
      await screen.findByText(
        'O site chegou ao prazo máximo, 12 meses depois do casamento, e não pode mais ser renovado. Vocês ainda podem exportar os convidados.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Fora do ar desde 22 de nov. de 2027')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Os dados ficam guardados até 22 de mai. de 2028. Depois, são apagados.',
      ),
    ).toBeInTheDocument();
    // A faixa fica oculta na própria A7 (314(5)): um link só, o da tela.
    expect(screen.getAllByRole('link', { name: 'Exportar os convidados' })).toHaveLength(1);
    expect(screen.queryByLabelText('Nova data de saída do ar')).toBeNull();
  });

  it('sem violações de acessibilidade, com a extensão', async () => {
    mockEndDate();
    const { container } = renderRoute({ url: URL_END_DATE });
    await ready();
    setDate('2027-05-14');
    await screen.findByText('3 meses a mais × R$ 29');
    await expectNoA11yViolations({ container });
  });
});
