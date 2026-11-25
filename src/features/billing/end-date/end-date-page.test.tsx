import { fireEvent, screen, waitFor } from '@testing-library/react';
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

interface Call {
  body: unknown;
}

function mockEndDate({
  lifecycle = {},
  patch = (body: { endDate: string }) =>
    Response.json({ endDate: body.endDate, paidThrough: '2027-02-14', status: 'post_event' }),
}: {
  lifecycle?: Record<string, unknown>;
  patch?: (body: { endDate: string }) => Response;
} = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(meFor(me(lifecycle)));
    if (path === '/v1/weddings/w1/end-date' && method === 'PATCH') {
      calls.push({ body });
      return patch(body as { endDate: string });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const URL_END_DATE = '/app/cobranca/data-de-saida';
const field = () => screen.getByLabelText('Nova data de saída do ar');
const setDate = (value: string) => fireEvent.change(field(), { target: { value } });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-12-01T15:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Mudar a data de saída do ar (Data de saída RN05; 289; 293; Penpot 21, A6; E10)', () => {
  it('no ar: o título, a data atual, a ajuda e o Pagar e adiar desabilitado até o E11 (333(1))', async () => {
    mockEndDate();
    renderRoute({ url: URL_END_DATE });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mudar a data de saída do ar' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No ar até 14 de fev. de 2027')).toBeInTheDocument();
    expect(field()).toHaveValue('2027-02-14');
    expect(field()).toHaveAccessibleDescription(
      'Até 14 de nov. de 2027, 12 meses depois do casamento.',
    );
    setDate('2027-05-14');
    expect(screen.getByRole('button', { name: 'Pagar e adiar' })).toBeDisabled();
  });

  it('antecipar: o aviso, o Antecipar a data, o PATCH e o Toast; volta a Pagamentos (RN05)', async () => {
    const user = userEvent.setup();
    const calls = mockEndDate();
    const { router } = renderRoute({ url: URL_END_DATE });
    await screen.findByRole('heading', { level: 1, name: 'Mudar a data de saída do ar' });
    setDate('2027-01-10');
    expect(
      screen.getByText('Antecipar a data não devolve dinheiro: os meses já pagos não voltam.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Antecipar a data' }));
    expect(
      await screen.findByText('O site fica no ar até 10 de jan. de 2027.'),
    ).toBeInTheDocument();
    expect(calls).toEqual([{ body: { endDate: '2027-01-10' } }]);
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/cobranca'));
  });

  it('quem antecipou: a ajuda em duas faixas e o Voltar a data de graça (293(3)(4))', async () => {
    mockEndDate({ lifecycle: { endDate: '2027-01-10' } });
    renderRoute({ url: URL_END_DATE });
    await screen.findByRole('heading', { level: 1, name: 'Mudar a data de saída do ar' });
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
    expect(calls).toEqual([{ body: { endDate: '2027-02-14' } }]);
  });

  it('o caso B depois da data paga: o Pagar e renovar desabilitado até o E11', async () => {
    mockEndDate({
      lifecycle: { status: 'expired', endDate: '2026-11-20', expiredAt: '2026-11-28' },
    });
    renderRoute({ url: URL_END_DATE });
    await screen.findByText('Fora do ar desde 28 de nov.');
    setDate('2027-03-01');
    expect(screen.getByRole('button', { name: 'Pagar e renovar' })).toBeDisabled();
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
    await screen.findByRole('heading', { level: 1, name: 'Mudar a data de saída do ar' });
    setDate('2027-02-14');
    await user.click(screen.getByRole('button', { name: 'Voltar a data' }));
    await waitFor(() =>
      expect(field()).toHaveAccessibleDescription(
        'Esta data é depois do que vocês já pagaram. Atualizem a tela e escolham de novo.',
      ),
    );
  });

  it('fora dos limites: o erro no campo e o botão desabilitado', async () => {
    mockEndDate();
    renderRoute({ url: URL_END_DATE });
    await screen.findByRole('heading', { level: 1, name: 'Mudar a data de saída do ar' });
    setDate('2027-12-01');
    expect(field()).toHaveAccessibleDescription(
      'Escolham uma data depois do casamento e até 14 de nov. de 2027.',
    );
    expect(screen.getByRole('button', { name: 'Pagar e adiar' })).toBeDisabled();
  });

  it('bloqueado: o primário desabilitado com o motivo', async () => {
    mockEndDate({ lifecycle: { endDate: '2027-01-10', blocked: true } });
    renderRoute({ url: URL_END_DATE });
    await screen.findByRole('heading', { level: 1, name: 'Mudar a data de saída do ar' });
    setDate('2027-02-14');
    const button = screen.getByRole('button', { name: 'Voltar a data' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Indisponível enquanto o site está bloqueado.');
  });

  it('sem o que mudar de graça (expirado sem mês pago) e a colaboradora: Pagamentos', async () => {
    mockEndDate({
      lifecycle: {
        status: 'expired',
        endDate: '2026-11-20',
        paidThrough: '2026-11-20',
        expiredAt: '2026-11-28',
      },
    });
    const view = renderRoute({ url: URL_END_DATE });
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/app/cobranca'));
    view.unmount();
    profileUnderTest.current = 'planner';
    mockEndDate();
    const planner = renderAreaScreen({ url: URL_END_DATE });
    await waitFor(() => expect(planner.router.state.location.pathname).toBe('/app/cobranca'));
  });

  it('sem violações de acessibilidade', async () => {
    mockEndDate();
    const { container } = renderRoute({ url: URL_END_DATE });
    await screen.findByRole('heading', { level: 1, name: 'Mudar a data de saída do ar' });
    setDate('2027-01-10');
    await expectNoA11yViolations({ container });
  });
});
