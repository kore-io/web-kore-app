import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

/*
 * A exclusão agendada no app (Retenção RN05; textos-f3 B8; 316(8); 318(11) e (12)): a faixa
 * das duas versões, o Cancelar a exclusão com os dois Toasts, a trava das telas e o 409 em
 * corrida.
 */

const LOCKED = 'Indisponível enquanto a exclusão está agendada.';
const COUPLE_BANNER = 'O casamento será apagado em 25 de fev. O site está fora do ar.';
const PLANNER_BANNER =
  'O casamento será apagado em 25 de fev. Só o casal pode cancelar a exclusão.';

function me(lifecycle: Record<string, unknown>) {
  return {
    user: { id: 'u1', name: 'Ana Beatriz Moreira', email: 'ana@exemplo.com', platformRole: 'none' },
    activeProfile: 'couple',
    authenticatedAt: '2027-02-18T12:00:00Z',
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
          deletionScheduledFor: '2027-02-25',
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

const summary = { guests: 0, namedGuests: 0, parties: 0, confirmed: 0, declined: 0, pending: 0 };

function mockDeletion({
  lifecycle = {},
  cancel,
  createParty,
}: {
  lifecycle?: Record<string, unknown>;
  cancel?: () => Response;
  createParty?: () => Response;
} = {}) {
  const calls: string[] = [];
  let current = lifecycle;
  mockApi(({ method, path }) => {
    if (path === '/v1/me') return Response.json(meFor(me(current)));
    if (method === 'POST' && path === '/v1/weddings/w1/deletion/cancel') {
      calls.push(path);
      const response = cancel?.();
      if (response) return response;
      current = { ...current, deletionScheduledFor: null };
      return Response.json({ lifecycle: me(current).memberships[0]?.lifecycle });
    }
    if (method === 'GET' && path.startsWith('/v1/weddings/w1/parties')) {
      return Response.json({ summary, total: 0, data: [], nextCursor: null });
    }
    if (method === 'GET' && path === '/v1/weddings/w1/tags') {
      return Response.json({ limit: 10, data: [] });
    }
    if (method === 'POST' && path === '/v1/weddings/w1/parties' && createParty) {
      return createParty();
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const banner = () => document.querySelector('.kore-lifecycle-banner') as HTMLElement | null;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2027-02-18T15:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('a exclusão agendada (Retenção RN05)', () => {
  it('o casal: a faixa com o Cancelar a exclusão, no lugar da faixa da carência (316(8))', async () => {
    mockDeletion({ lifecycle: { status: 'grace', graceUntil: '2027-02-21' } });
    renderRoute({ url: '/app' });
    expect(await screen.findByText(COUPLE_BANNER)).toBeInTheDocument();
    expect(
      within(banner() as HTMLElement).getByRole('button', { name: 'Cancelar a exclusão' }),
    ).toBeEnabled();
    expect(screen.queryByText(/^A data de saída do ar passou/)).toBeNull();
  });

  it('a colaboradora: a faixa sem o botão', async () => {
    profileUnderTest.current = 'planner';
    mockDeletion();
    renderRoute({ url: '/cerimonialista/casamentos/w1' });
    expect(await screen.findByText(PLANNER_BANNER)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar a exclusão' })).toBeNull();
  });

  it('com o bloqueio, só a faixa do bloqueio (Bloqueado RN04)', async () => {
    mockDeletion({ lifecycle: { blocked: true } });
    renderRoute({ url: '/app' });
    await screen.findByRole('link', { name: 'suporte@kore.com.br' });
    expect(screen.queryByText(COUPLE_BANNER)).toBeNull();
  });

  it('Cancelar a exclusão com o site no ar: o Toast "O site voltou ao ar." e a faixa some', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const calls = mockDeletion();
    renderRoute({ url: '/app' });
    await user.click(await screen.findByRole('button', { name: 'Cancelar a exclusão' }));
    expect(await screen.findByText('Exclusão cancelada. O site voltou ao ar.')).toBeInTheDocument();
    expect(calls).toEqual(['/v1/weddings/w1/deletion/cancel']);
    await vi.waitFor(() => expect(screen.queryByText(COUPLE_BANNER)).toBeNull());
  });

  it('Cancelar a exclusão no expirado: só "Exclusão cancelada."', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockDeletion({ lifecycle: { status: 'expired', expiredAt: '2027-02-10' } });
    renderRoute({ url: '/app' });
    await user.click(await screen.findByRole('button', { name: 'Cancelar a exclusão' }));
    expect(await screen.findByText('Exclusão cancelada.')).toBeInTheDocument();
  });

  it('Novo grupo desabilitado com o motivo da exclusão (o cenário da spec)', async () => {
    mockDeletion({ lifecycle: { status: 'grace', graceUntil: '2027-02-21' } });
    renderRoute({ url: '/app/convidados' });
    const add = await screen.findByRole('button', { name: 'Novo grupo' });
    expect(add).toBeDisabled();
    expect(add).toHaveAccessibleDescription(LOCKED);
  });

  it('o 409 WEDDING_DELETION_SCHEDULED em corrida: o Toast do casal (318(12))', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockDeletion({
      lifecycle: { deletionScheduledFor: null },
      createParty: () => Response.json({ error: 'WEDDING_DELETION_SCHEDULED' }, { status: 409 }),
    });
    renderRoute({ url: '/app/convidados/novo' });
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome do grupo' }),
      'Família Moreira',
    );
    const names = screen.getAllByRole('textbox', { name: /^Nome/ });
    await user.type(names[1] as HTMLElement, 'Célia Moreira');
    await user.click(screen.getByRole('button', { name: 'Salvar grupo' }));
    expect(
      await screen.findByText(
        'Indisponível enquanto a exclusão está agendada. Cancelem a exclusão para voltar a editar.',
      ),
    ).toBeInTheDocument();
  });

  it('o 409 em corrida na colaboradora: o Toast dela (318(12))', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    profileUnderTest.current = 'planner';
    mockDeletion({
      lifecycle: { deletionScheduledFor: null },
      createParty: () => Response.json({ error: 'WEDDING_DELETION_SCHEDULED' }, { status: 409 }),
    });
    renderRoute({ url: '/cerimonialista/casamentos/w1/convidados/novo' });
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome do grupo' }),
      'Família Moreira',
    );
    const names = screen.getAllByRole('textbox', { name: /^Nome/ });
    await user.type(names[1] as HTMLElement, 'Célia Moreira');
    await user.click(screen.getByRole('button', { name: 'Salvar grupo' }));
    expect(
      await screen.findByText(
        'Indisponível enquanto a exclusão está agendada. Só o casal pode cancelar a exclusão.',
      ),
    ).toBeInTheDocument();
  });

  it('sem violações de acessibilidade, com a faixa', async () => {
    mockDeletion();
    const { container } = renderRoute({ url: '/app' });
    await screen.findByText(COUPLE_BANNER);
    await expectNoA11yViolations({ container });
  });
});
