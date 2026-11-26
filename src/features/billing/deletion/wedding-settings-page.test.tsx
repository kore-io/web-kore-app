import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

/*
 * Configurações › Casamento (Retenção RN05, RN06 e RN08; A11; textos-f3 B8): o Excluir com o
 * nome digitado, as travas, a sessão antiga, a exclusão agendada e a colaboradora.
 */

const URL = '/app/configuracoes/casamento';

function me(lifecycle: Record<string, unknown> = {}) {
  return {
    user: { id: 'u1', name: 'Ana Beatriz Moreira', email: 'ana@exemplo.com', platformRole: 'none' },
    activeProfile: 'couple',
    authenticatedAt: '2027-02-18T14:58:00Z',
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
          endDate: '2027-04-14',
          graceUntil: null,
          expiredAt: null,
          paidThrough: '2027-04-14',
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

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    kind: 'publication',
    periodStart: '2026-10-14',
    periodEnd: '2027-04-14',
    monthsCovered: 6,
    amountCents: 33710,
    method: 'card',
    installments: 1,
    status: 'paid',
    paidAt: '2026-10-10T14:00:00Z',
    refundableUntil: null,
    disputeDeadline: null,
    refundEndDate: null,
    ...overrides,
  };
}

function billing({
  payments = [payment()],
  pendingPayment = null,
}: { payments?: object[]; pendingPayment?: object | null } = {}) {
  return {
    status: 'published',
    publishedAt: '2026-10-10T14:00:00Z',
    endDate: '2027-04-14',
    paidThrough: '2027-04-14',
    graceUntil: null,
    expiredAt: null,
    purgeAt: null,
    publicationSource: 'payment',
    awaitingPayment: false,
    pendingPayment,
    payments,
    payer: null,
  };
}

type Call = { method: string; path: string; body: unknown };

function mockSettings({
  lifecycle = {},
  billingBody = billing(),
  request,
}: {
  lifecycle?: Record<string, unknown>;
  billingBody?: object;
  request?: () => Response;
} = {}) {
  const calls: Call[] = [];
  let current = lifecycle;
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(meFor(me(current)));
    if (method === 'GET' && path === '/v1/weddings/w1/billing') return Response.json(billingBody);
    if (method === 'POST' && path === '/v1/weddings/w1/deletion') {
      calls.push({ method, path, body });
      const response = request?.();
      if (response) return response;
      current = { ...current, deletionScheduledFor: '2027-02-25' };
      return Response.json({ deletionScheduledFor: '2027-02-25' }, { status: 202 });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const deleteButton = () => screen.findByRole('button', { name: 'Excluir o casamento' });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2027-02-18T15:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Configurações › Casamento (Retenção RN05 e RN06)', () => {
  it('a aba, a seção e o Dialog com a data e o nome digitado; o pedido agenda e a faixa aparece', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const calls = mockSettings();
    const { container } = renderRoute({ url: URL });
    expect(await screen.findByRole('link', { name: 'Casamento' })).toHaveAttribute('href', URL);
    expect(
      await screen.findByText(
        'O site sai do ar na hora. Os convidados, as respostas e o site são apagados em 7 dias, e até lá vocês podem cancelar. Os registros de pagamento ficam guardados pelo prazo da lei.',
      ),
    ).toBeInTheDocument();
    await expectNoA11yViolations({ container });
    await user.click(await deleteButton());
    const dialog = screen.getByRole('alertdialog', {
      name: 'Excluir o casamento de Ana & Marcos?',
    });
    expect(dialog).toHaveAccessibleDescription(
      'O site sai do ar agora, e tudo é apagado em 25 de fev. Até lá, vocês podem cancelar.',
    );
    const field = within(dialog).getByRole('textbox', {
      name: 'Digitem Ana & Marcos para confirmar',
    });
    await user.type(field, 'Ana & Marcos');
    await user.click(within(dialog).getByRole('button', { name: 'Excluir o casamento' }));
    expect(
      await screen.findByText('O casamento será apagado em 25 de fev. O site está fora do ar.'),
    ).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/v1/weddings/w1/deletion',
        body: { confirmName: 'Ana & Marcos' },
      },
    ]);
    // A seção passa a mostrar a data e o Cancelar a exclusão.
    expect(await screen.findByText('O casamento será apagado em 25 de fev.')).toBeInTheDocument();
  });

  it('o nome que não confere: a ajuda do campo em perigo (318(10))', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockSettings({
      request: () => apiError({ status: 422, body: { error: 'CONFIRM_NAME_MISMATCH' } }),
    });
    renderRoute({ url: URL });
    await user.click(await deleteButton());
    const dialog = screen.getByRole('alertdialog');
    const field = within(dialog).getByRole('textbox');
    await user.type(field, 'Ana e Marcos');
    await user.click(within(dialog).getByRole('button', { name: 'Excluir o casamento' }));
    await waitFor(() =>
      expect(field).toHaveAccessibleDescription(
        'O nome não confere. Digitem Ana & Marcos do jeito que aparece acima.',
      ),
    );
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  it('no prazo de desistir: o Alert com o Ir para Pagamentos e o Excluir desabilitado (RN06)', async () => {
    mockSettings({
      billingBody: billing({ payments: [payment({ refundableUntil: '2027-02-20T02:59:59Z' })] }),
    });
    renderRoute({ url: URL });
    const button = await deleteButton();
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      /^Vocês ainda podem desistir da publicação e receber tudo de volta\. Façam isso antes de excluir\./,
    );
    expect(screen.getByRole('link', { name: 'Ir para Pagamentos' })).toHaveAttribute(
      'href',
      '/app/cobranca',
    );
  });

  it.each([
    [
      'o reembolso em andamento',
      { billingBody: billing({ payments: [payment({ status: 'refund_requested' })] }) },
      'Indisponível enquanto há um reembolso em andamento.',
    ],
    [
      'a contestação',
      { billingBody: billing({ payments: [payment({ status: 'disputed' })] }) },
      'Indisponível enquanto há um pagamento em contestação.',
    ],
    [
      'o bloqueio',
      { lifecycle: { blocked: true } },
      'Indisponível enquanto o site está bloqueado.',
    ],
  ])('%s: o Excluir desabilitado com o motivo (RN06)', async (_name, setup, reason) => {
    mockSettings(setup);
    renderRoute({ url: URL });
    const button = await deleteButton();
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(reason);
  });

  it('o Pix pendente só avisa que será cancelado (RN06)', async () => {
    mockSettings({
      billingBody: billing({
        pendingPayment: { id: 'x1', kind: 'extension', method: 'pix', endDate: '2027-06-14' },
      }),
    });
    renderRoute({ url: URL });
    expect(await deleteButton()).toBeEnabled();
    expect(
      screen.getByText(
        'Há um Pix aguardando pagamento. Se excluírem o casamento, ele é cancelado.',
      ),
    ).toBeInTheDocument();
  });

  it('o 409 REFUND_IN_PROGRESS em corrida: o Toast com o texto da trava', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockSettings({
      request: () => apiError({ status: 409, body: { error: 'REFUND_IN_PROGRESS' } }),
    });
    renderRoute({ url: URL });
    await user.click(await deleteButton());
    const dialog = screen.getByRole('alertdialog');
    await user.type(within(dialog).getByRole('textbox'), 'Ana & Marcos');
    await user.click(within(dialog).getByRole('button', { name: 'Excluir o casamento' }));
    expect(
      await screen.findByText('Indisponível enquanto há um reembolso em andamento.'),
    ).toBeInTheDocument();
  });

  it('a sessão antiga (403 REAUTH_REQUIRED): o Entrar com o aviso e a volta a esta tela (RN08)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockSettings({
      request: () => apiError({ status: 403, body: { error: 'REAUTH_REQUIRED' } }),
    });
    const { router } = renderRoute({ url: URL });
    await user.click(await deleteButton());
    const dialog = screen.getByRole('alertdialog');
    await user.type(within(dialog).getByRole('textbox'), 'Ana & Marcos');
    await user.click(within(dialog).getByRole('button', { name: 'Excluir o casamento' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent(URL)}`);
    expect(
      await screen.findByText('Por segurança, entrem de novo para excluir o casamento.'),
    ).toBeInTheDocument();
  });

  it('com a exclusão agendada: a data e o Cancelar a exclusão, no lugar do Excluir', async () => {
    mockSettings({ lifecycle: { deletionScheduledFor: '2027-02-25' } });
    renderRoute({ url: URL });
    expect(await screen.findByText('O casamento será apagado em 25 de fev.')).toBeInTheDocument();
    const section = screen.getByRole('region', { name: 'Excluir o casamento' });
    expect(within(section).getByRole('button', { name: 'Cancelar a exclusão' })).toBeEnabled();
    expect(within(section).queryByRole('button', { name: 'Excluir o casamento' })).toBeNull();
  });

  it('a colaboradora: o Excluir desabilitado com "Só o casal pode excluir o casamento."', async () => {
    profileUnderTest.current = 'planner';
    mockSettings();
    renderRoute({ url: '/cerimonialista/casamentos/w1/configuracoes/casamento' });
    const button = await deleteButton();
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Só o casal pode excluir o casamento.');
  });
});
