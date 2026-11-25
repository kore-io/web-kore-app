import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderAreaScreen, renderRoute } from '../../../../tests/render-route';
import { formatCents } from '../../../shared/money';
import { numericDay } from './payments-texts';

const me = {
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
      },
    },
  ],
  profiles: ['couple'],
  lastProfileOnDevice: 'couple',
  planner: null,
  referrer: null,
  plannerSignupEnabled: true,
};

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
  // 10/08 às 11h48 em São Paulo.
  paidAt: '2026-08-10T14:48:00Z',
  refundableUntil: null,
  disputeDeadline: null,
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

function mockBilling(data: Record<string, unknown> = billing()) {
  mockApi(({ path }) => {
    if (path === '/v1/me') {
      // O ciclo de vida do /me segue o do billing (o Publicar lê o do /me).
      const memberships = me.memberships.map((membership) => ({
        ...membership,
        lifecycle: { ...membership.lifecycle, status: String(data.status) },
      }));
      return Response.json(meFor({ ...me, memberships }));
    }
    if (path === '/v1/weddings/w1/billing') return Response.json(data);
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
}

const URL_BILLING = '/app/cobranca';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-25T14:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Cobrança e publicação › Pagamentos (Pagamentos RN01; Penpot 21, A9; decisão 326)', () => {
  it('publicado: o subtítulo com a data por extenso e o histórico nas colunas, sem o canceled', async () => {
    mockBilling(
      billing({
        payments: [
          PUBLICATION,
          { ...PUBLICATION, id: 'p0', status: 'canceled', method: 'pix', installments: 1 },
        ],
      }),
    );
    renderRoute({ url: URL_BILLING });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cobrança e publicação' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Publicado · no ar até 14 de fev. de 2027')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Pagamentos' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Data', 'Tipo', 'Meses cobertos', 'Valor', 'Forma', 'Situação']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    const cells = within(rows[0] as HTMLElement).getAllByRole('cell');
    expect(
      cells.map((cell) => cell.querySelector('.kore-data-table__cell-value')?.textContent),
    ).toEqual([
      '10/08',
      'Publicação',
      '10/08 a 14/02/2027 (7 meses)',
      formatCents({ cents: 33710 }),
      'Cartão 2x',
      'Pago',
    ]);
    // Publicado: sem o Publicar, e com o Mudar a data de saída do ar (E10; 333(2)).
    expect(screen.queryByRole('button', { name: 'Publicar o site' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Mudar a data de saída do ar' })).toBeEnabled();
  });

  it('as formas, o mês no singular e as seis situações (RN01)', async () => {
    const statuses = ['paid', 'pending', 'failed', 'refund_requested', 'refunded', 'disputed'];
    mockBilling(
      billing({
        payments: statuses.map((status, index) => ({
          ...PUBLICATION,
          id: `x${index}`,
          status,
          kind: index === 0 ? 'publication' : 'extension',
          method: index % 2 === 0 ? 'pix' : 'card',
          installments: 1,
          monthsCovered: index === 1 ? 1 : 3,
          paidAt: status === 'paid' ? PUBLICATION.paidAt : null,
        })),
      }),
    );
    renderRoute({ url: URL_BILLING });
    const table = await screen.findByRole('table', { name: 'Pagamentos' });
    for (const label of [
      'Pago',
      'Pendente',
      'Não aprovado',
      'Reembolso pedido',
      'Reembolsado',
      'Em contestação',
    ]) {
      expect(within(table).getByText(label)).toBeInTheDocument();
    }
    expect(within(table).getAllByText('Pix')).toHaveLength(3);
    expect(within(table).getAllByText('Cartão')).toHaveLength(3);
    expect(within(table).getByText('10/08 a 14/02/2027 (1 mês)')).toBeInTheDocument();
    expect(within(table).getAllByText('Extensão')).toHaveLength(5);
  });

  it('rascunho: sem subtítulo, o vazio do Penpot e o Publicar o site primário (326(1))', async () => {
    const user = userEvent.setup();
    mockBilling(billing({ status: 'draft', publishedAt: null, endDate: null, payments: [] }));
    const { router } = renderRoute({ url: URL_BILLING });
    expect(await screen.findByText('Nenhum pagamento ainda.')).toBeInTheDocument();
    expect(
      screen.getByText('Ele aparece aqui quando vocês publicarem o site.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/no ar até/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Publicar o site' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/cobranca/publicar'));
  });

  it('rascunho com histórico (ex.: depois do reembolso): o Publicar o site e a tabela (326(1))', async () => {
    mockBilling(
      billing({
        status: 'draft',
        endDate: null,
        payments: [{ ...PUBLICATION, status: 'refunded' }],
      }),
    );
    renderRoute({ url: URL_BILLING });
    expect(await screen.findByText('Reembolsado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar o site' })).toBeEnabled();
  });

  it('aguardando o casal: o Publicar o site desabilitado com o motivo (325)', async () => {
    mockBilling(billing({ status: 'awaiting_couple', endDate: null, payments: [] }));
    renderRoute({ url: URL_BILLING });
    const publish = await screen.findByRole('button', { name: 'Publicar o site' });
    expect(publish).toBeDisabled();
    expect(publish).toHaveAccessibleDescription('O casal ainda não aceitou o convite.');
  });

  it('pós-evento e expirado: o subtítulo pelo rótulo do selo (326(2))', async () => {
    mockBilling(billing({ status: 'post_event' }));
    const view = renderRoute({ url: URL_BILLING });
    expect(
      await screen.findByText('Pós-evento · no ar até 14 de fev. de 2027'),
    ).toBeInTheDocument();
    view.unmount();
    mockBilling(billing({ status: 'expired', expiredAt: '2027-02-21T03:00:00Z' }));
    renderRoute({ url: URL_BILLING });
    expect(await screen.findByText('Expirado')).toBeInTheDocument();
  });

  it('carência: o subtítulo com o rótulo do selo (326(2); cobrança do Crivo no E6)', async () => {
    // 25/11 em São Paulo; expira em 02/12 (graceUntil + 1): faltam 7 dias.
    mockBilling(billing({ status: 'grace', graceUntil: '2026-12-01' }));
    renderRoute({ url: URL_BILLING });
    expect(await screen.findByText('Vence em 7 dias')).toBeInTheDocument();
  });

  it('a colaboradora vê só o status e as datas, sem o histórico (decisões 29 e 272(2))', async () => {
    profileUnderTest.current = 'planner';
    mockBilling(billing({ payments: undefined, pendingPayment: undefined }));
    renderAreaScreen({ url: URL_BILLING });
    expect(await screen.findByText('Publicado · no ar até 14 de fev. de 2027')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('Nenhum pagamento ainda.')).toBeNull();
  });

  it('o item Cobrança e publicação da Sidebar fica marcado', async () => {
    mockBilling();
    renderRoute({ url: URL_BILLING });
    await screen.findByRole('table', { name: 'Pagamentos' });
    expect(screen.getByRole('link', { name: 'Cobrança e publicação' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('sem violações de acessibilidade', async () => {
    mockBilling();
    const { container } = renderRoute({ url: URL_BILLING });
    await screen.findByRole('table', { name: 'Pagamentos' });
    await expectNoA11yViolations({ container });
  });
});

describe('numericDay (Voz; 274(6) e 326(4))', () => {
  const now = new Date('2026-11-25T14:00:00Z');
  it('dd/mm no ano corrente e dd/mm/aaaa fora dele', () => {
    expect(numericDay({ day: '2026-08-10', timezone: 'America/Sao_Paulo', now })).toBe('10/08');
    expect(numericDay({ day: '2027-02-14', timezone: 'America/Sao_Paulo', now })).toBe(
      '14/02/2027',
    );
  });

  it('o ano corrente é o do fuso do casamento', () => {
    // 31/12 às 23h em São Paulo já é 2027 em UTC.
    const newYearUtc = new Date('2027-01-01T02:00:00Z');
    expect(numericDay({ day: '2026-12-31', timezone: 'America/Sao_Paulo', now: newYearUtc })).toBe(
      '31/12',
    );
    expect(numericDay({ day: '2026-12-31', timezone: 'UTC', now: newYearUtc })).toBe('31/12/2026');
  });
});
