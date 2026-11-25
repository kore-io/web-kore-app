import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

const BANNER = 'O site foi bloqueado. O suporte atende em suporte@kore.com.br.';

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
          blocked: true,
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

function mockBlocked(lifecycle: Record<string, unknown> = {}) {
  mockApi(({ path }) => {
    if (path === '/v1/me') return Response.json(meFor(me(lifecycle)));
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
}

/** A faixa: o Alert do bloqueio, com a frase inteira (o e-mail é um link dentro dela). */
async function banner() {
  await screen.findByRole('link', { name: 'suporte@kore.com.br' });
  const alert = document.querySelector('.kore-lifecycle-banner') as HTMLElement;
  expect(alert).toHaveTextContent(BANNER);
  return alert;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2027-02-18T15:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('a faixa do casamento bloqueado (Bloqueado RN04; textos-f3 B5)', () => {
  it('o casal: a frase sem o motivo, com o e-mail do suporte como link', async () => {
    mockBlocked();
    renderRoute({ url: '/app' });
    const alert = await banner();
    expect(within(alert).getByRole('link', { name: 'suporte@kore.com.br' })).toHaveAttribute(
      'href',
      'mailto:suporte@kore.com.br',
    );
  });

  it('substitui a faixa do expirado (329(4))', async () => {
    mockBlocked({ status: 'expired', expiredAt: '2027-02-10' });
    renderRoute({ url: '/app' });
    await banner();
    expect(screen.queryByText(/^O site está fora do ar/)).toBeNull();
  });

  it('a colaboradora: empilhada acima de "Você colabora neste casamento."', async () => {
    profileUnderTest.current = 'planner';
    mockBlocked();
    renderRoute({ url: '/cerimonialista/casamentos/w1' });
    const alert = await banner();
    const collaborator = screen.getByText('Você colabora neste casamento.');
    expect(
      alert.compareDocumentPosition(collaborator) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('sem bloqueio, sem a faixa', async () => {
    mockBlocked({ blocked: false });
    renderRoute({ url: '/app' });
    await screen.findByRole('button', { name: 'Menu do usuário' });
    expect(screen.queryByText(/^O site foi bloqueado/)).toBeNull();
  });

  it('sem violações de acessibilidade, com a faixa', async () => {
    mockBlocked();
    const { container } = renderRoute({ url: '/app' });
    await banner();
    await expectNoA11yViolations({ container });
  });
});
