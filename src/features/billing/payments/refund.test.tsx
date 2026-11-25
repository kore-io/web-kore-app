import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor } from '../../../../tests/profile';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

const membership = {
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
  },
};

function me({ blocked = false }: { blocked?: boolean } = {}) {
  return {
    user: { id: 'u1', name: 'Ana Beatriz Moreira', email: 'ana@exemplo.com', platformRole: 'none' },
    activeProfile: 'couple',
    authenticatedAt: '2026-11-24T12:00:00Z',
    memberships: [{ ...membership, lifecycle: { ...membership.lifecycle, blocked } }],
    profiles: ['couple'],
    lastProfileOnDevice: 'couple',
    planner: null,
    referrer: null,
    plannerSignupEnabled: true,
  };
}

/** Pago em 10/08; o prazo vai até o fim de 17/08 em São Paulo (03h de 18/08 em UTC). */
const PUBLICATION = {
  id: 'p1',
  kind: 'publication',
  periodStart: '2026-08-10',
  periodEnd: '2027-02-14',
  monthsCovered: 7,
  amountCents: 33710,
  method: 'card',
  installments: 2,
  status: 'paid',
  paidAt: '2026-08-10T14:48:00Z',
  refundableUntil: '2026-08-18T02:59:59Z',
  disputeDeadline: null,
  refundEndDate: null,
};

const EXTENSION = {
  ...PUBLICATION,
  id: 'e1',
  kind: 'extension',
  periodStart: '2027-02-14',
  periodEnd: '2027-05-14',
  monthsCovered: 3,
  amountCents: 8700,
  installments: 1,
  paidAt: '2026-08-12T15:00:00Z',
  refundableUntil: '2026-08-20T02:59:59Z',
  // A data para onde a endDate volta (RN03): aqui, a da cortesia que veio antes (14/03).
  refundEndDate: '2027-03-14',
};

function billing(overrides: Record<string, unknown> = {}) {
  return {
    status: 'published',
    publishedAt: '2026-08-10T14:48:00Z',
    endDate: '2027-02-14',
    paidThrough: '2027-02-14',
    graceUntil: null,
    expiredAt: null,
    purgeAt: null,
    publicationSource: 'payment',
    awaitingPayment: false,
    pendingPayment: null,
    payments: [PUBLICATION],
    payer: null,
    ...overrides,
  };
}

interface Call {
  path: string;
  body: unknown;
}

/** Quantas vezes a Topbar leu o GET …/site (o selo do status). */
const siteReads = { count: 0 };

function mockRefund({
  data = () => billing(),
  refund = () =>
    Response.json({ status: 'refund_requested', refundsPaymentIds: ['p1'] }, { status: 202 }),
  blocked = false,
}: {
  data?: (calls: number) => Record<string, unknown>;
  refund?: () => Response;
  blocked?: boolean;
} = {}) {
  const calls: Call[] = [];
  let reads = 0;
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(meFor(me({ blocked })));
    if (path === '/v1/weddings/w1/site') {
      siteReads.count += 1;
      return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
    }
    if (path === '/v1/weddings/w1/billing') {
      reads += 1;
      return Response.json(data(reads));
    }
    if (method === 'POST' && path.endsWith('/refund-request')) {
      calls.push({ path, body });
      return refund();
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const URL_BILLING = '/app/cobranca';
/** O valor como o app escreve: o espaço sem quebra depois do "R$". */
const nb = (text: string) => text.replace(/R\$ /g, 'R$\u00a0');
const ACTION = 'Desistir e pedir reembolso';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  // 17/08 às 20h em São Paulo: o último dia do prazo da publicação.
  vi.setSystemTime(new Date('2026-08-17T23:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

async function openDialog(user: ReturnType<typeof userEvent.setup>, index = 0) {
  const buttons = await screen.findAllByRole('button', { name: ACTION });
  await user.click(buttons[index] as HTMLElement);
  return screen.findByRole('dialog');
}

describe('Desistir e pedir reembolso (Pagamentos RN02 a RN07; Penpot 21, A9; decisão 327)', () => {
  it('a publicação: o Alert com o prazo no fuso e o valor; o Dialog do cartão; o motivo vai no pedido', async () => {
    const user = userEvent.setup();
    siteReads.count = 0;
    const calls = mockRefund({
      data: (reads) =>
        reads === 1
          ? billing()
          : billing({
              status: 'draft',
              endDate: null,
              payments: [{ ...PUBLICATION, status: 'refund_requested', refundableUntil: null }],
            }),
    });
    renderRoute({ url: URL_BILLING });
    expect(
      await screen.findByText('Vocês podem desistir até 17 de ago. e receber R$ 337,10 de volta.', {
        normalizer: (text) => text.replace(/\u00a0/g, ' '),
      }),
    ).toBeInTheDocument();
    const dialog = await openDialog(user);
    expect(
      within(dialog).getByRole('heading', { name: 'Desistir da publicação?' }),
    ).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription(
      nb('O site sai do ar e volta a ser rascunho. Devolvemos R$ 337,10 no mesmo cartão.'),
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Motivo (opcional)' }),
      'Decidimos adiar o casamento.',
    );
    const before = siteReads.count;
    await user.click(within(dialog).getByRole('button', { name: ACTION }));
    expect(
      await screen.findByText('Reembolso pedido. O site voltou a ser rascunho.'),
    ).toBeInTheDocument();
    // O selo da Topbar relê o site: ele volta a Rascunho no pedido (RN07).
    await waitFor(() => expect(siteReads.count).toBeGreaterThan(before));
    expect(calls).toEqual([
      {
        path: '/v1/weddings/w1/payments/p1/refund-request',
        body: { reason: 'Decidimos adiar o casamento.' },
      },
    ]);
    // A tela relida: o Reembolso pedido com a legenda dos prazos, sem o Desistir.
    expect(
      await screen.findByText(
        'No Pix, o valor volta em até 7 dias úteis. No cartão, o estorno aparece numa das próximas faturas.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ACTION })).toBeNull();
  });

  it('o motivo vazio não vai no corpo; Manter o site no ar fecha sem pedir', async () => {
    const user = userEvent.setup();
    const calls = mockRefund();
    renderRoute({ url: URL_BILLING });
    let dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Manter o site no ar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls).toHaveLength(0);
    dialog = await openDialog(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Motivo (opcional)' }), '   ');
    await user.click(within(dialog).getByRole('button', { name: ACTION }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body).toEqual({});
  });

  it('o texto muda com a forma: Pix e cartão com juros (RN02; 327(5))', async () => {
    const user = userEvent.setup();
    mockRefund({
      data: () =>
        billing({
          payments: [{ ...PUBLICATION, method: 'pix', installments: 1, amountCents: 32699 }],
        }),
    });
    const view = renderRoute({ url: URL_BILLING });
    expect(await openDialog(user)).toHaveAccessibleDescription(
      nb(
        'O site sai do ar e volta a ser rascunho. Devolvemos R$ 326,99 por Pix, para a conta que pagou.',
      ),
    );
    view.unmount();
    mockRefund({
      data: () => billing({ payments: [{ ...PUBLICATION, installments: 7, amountCents: 35104 }] }),
    });
    renderRoute({ url: URL_BILLING });
    expect(await openDialog(user)).toHaveAccessibleDescription(
      nb(
        'O site sai do ar e volta a ser rascunho. Devolvemos R$ 351,04 no mesmo cartão, com os juros.',
      ),
    );
  });

  it('publicação e extensão no prazo: um bloco por pagamento, do mais novo; a publicação com o total e as partes (327(1) e (4))', async () => {
    const user = userEvent.setup();
    mockRefund({
      data: () => billing({ endDate: '2027-05-14', payments: [EXTENSION, PUBLICATION] }),
    });
    renderRoute({ url: URL_BILLING });
    const normalizer = (text: string) => text.replace(/\u00a0/g, ' ');
    const extensionAlert = await screen.findByText(
      'Vocês podem desistir da extensão até 19 de ago. e receber R$ 87,00 de volta.',
      { normalizer },
    );
    const publicationAlert = screen.getByText(
      'Vocês podem desistir até 17 de ago. e receber R$ 424,10 de volta, com a extensão.',
      { normalizer },
    );
    expect(
      extensionAlert.compareDocumentPosition(publicationAlert) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const extension = await openDialog(user, 0);
    expect(
      within(extension).getByRole('heading', { name: 'Desistir da extensão?' }),
    ).toBeInTheDocument();
    expect(extension).toHaveAccessibleDescription(
      nb('A data de saída do ar volta a 14 de mar. de 2027. Devolvemos R$ 87,00 no mesmo cartão.'),
    );
    await user.click(within(extension).getByRole('button', { name: 'Manter a extensão' }));
    const publication = await openDialog(user, 1);
    expect(publication).toHaveAccessibleDescription(
      nb(
        'O site sai do ar e volta a ser rascunho. Devolvemos R$ 424,10 no cartão: R$ 337,10 da publicação e R$ 87,00 da extensão, cada valor no cartão que pagou.',
      ),
    );
  });

  it('a extensão: o Toast com a data de saída do ar relida depois do pedido (RN07; 327(2))', async () => {
    const user = userEvent.setup();
    mockRefund({
      data: (reads) =>
        reads === 1
          ? billing({ endDate: '2027-05-14', payments: [EXTENSION] })
          : billing({
              endDate: '2027-03-01',
              payments: [{ ...EXTENSION, status: 'refund_requested', refundableUntil: null }],
            }),
    });
    renderRoute({ url: URL_BILLING });
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: ACTION }));
    expect(
      await screen.findByText(
        'Reembolso pedido. A data de saída do ar voltou a 1 de mar. de 2027.',
      ),
    ).toBeInTheDocument();
  });

  it('bloqueado: o Desistir desabilitado com o texto do suporte (RN02; P6)', async () => {
    mockRefund({ blocked: true });
    renderRoute({ url: URL_BILLING });
    const button = await screen.findByRole('button', { name: ACTION });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      'Indisponível enquanto o site está bloqueado. Para desistir da compra, escrevam para suporte@kore.com.br.',
    );
  });

  it('a contestação: a legenda, sem o Desistir (RN06)', async () => {
    mockRefund({
      data: () =>
        billing({ payments: [{ ...PUBLICATION, status: 'disputed', refundableUntil: null }] }),
    });
    renderRoute({ url: URL_BILLING });
    expect(
      await screen.findByText(
        'O banco do cartão abriu uma contestação deste pagamento. O site continua no ar. Se tiverem dúvidas, escrevam para suporte@kore.com.br.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ACTION })).toBeNull();
  });

  it.each([
    [
      'REFUND_WINDOW_CLOSED',
      { refundableUntil: '2026-08-18T02:59:59Z' },
      'O prazo para desistir terminou em 17 de ago.',
    ],
    ['REFUND_ALREADY_REQUESTED', {}, 'O reembolso deste pagamento já foi pedido.'],
    ['REFUND_NOT_LAST_EXTENSION', {}, 'Há uma extensão mais recente. Desistam dela primeiro.'],
  ])('o %s em corrida: o Toast e a tela relida', async (error, extra, message) => {
    const user = userEvent.setup();
    mockRefund({ refund: () => apiError({ status: 409, body: { error, ...extra } }) });
    renderRoute({ url: URL_BILLING });
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: ACTION }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('sem violações de acessibilidade, com o Dialog aberto', async () => {
    const user = userEvent.setup();
    mockRefund();
    const { container } = renderRoute({ url: URL_BILLING });
    await openDialog(user);
    await expectNoA11yViolations({ container: container.ownerDocument.body });
  });
});
