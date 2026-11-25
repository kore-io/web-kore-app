import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

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

const GRACE = { status: 'grace', graceUntil: '2027-02-21' };
const EXPIRED = { status: 'expired', expiredAt: '2027-02-22' };
const PAID_AHEAD = { status: 'expired', expiredAt: '2027-01-18', paidThrough: '2027-02-14' };
const FINAL = { status: 'expired', expiredAt: '2027-11-22' };

function mockLifecycle({
  lifecycle,
  data,
}: {
  lifecycle: Record<string, unknown>;
  data?: unknown;
}) {
  mockApi(({ path }) => {
    if (path === '/v1/me') return Response.json(meFor(me(lifecycle)));
    if (path === '/v1/weddings/w1/dashboard' && data) return Response.json(data);
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
}

/** A moldura da colaboradora (decisão 270), onde a faixa fica. */
const PLANNER_URL = '/cerimonialista/casamentos/w1';

/** A faixa: o Alert com o texto em título, fora da Topbar. */
async function bannerWith(text: string) {
  return (await screen.findByText(text)).closest('[role="alert"], .kore-lifecycle-banner');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2027-02-18T15:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('a faixa do ciclo de vida (Data de saída RN06; 231 P1; 293; 314; 329)', () => {
  it.each([
    [
      'carência',
      GRACE,
      'A data de saída do ar passou. O site fica no ar só até 21 de fev. Adiem a data para mantê-lo.',
      'A data de saída do ar passou. O site fica no ar só até 21 de fev. Peça ao casal para adiar a data.',
    ],
    [
      'expirado',
      EXPIRED,
      'O site está fora do ar desde 22 de fev. Renovem para os convidados voltarem a vê-lo.',
      'O site está fora do ar desde 22 de fev. Peça ao casal para renovar.',
    ],
    [
      'expirado com mês pago à frente (caso B)',
      PAID_AHEAD,
      'O site está fora do ar desde 18 de jan., mas vocês já pagaram até 14 de fev. Voltem o site ao ar, sem custo.',
      'O site está fora do ar desde 18 de jan. Peça ao casal para voltar o site ao ar.',
    ],
  ])(
    '%s: a versão do casal e a da colaboradora; só o caso B do casal com o Voltar ao ar (E10; 333(2))',
    async (_name, lifecycle, couple, planner) => {
      // O caso B vale com o paidThrough depois de hoje: roda em 20/01.
      if ('paidThrough' in lifecycle) vi.setSystemTime(new Date('2027-01-20T15:00:00Z'));
      mockLifecycle({ lifecycle });
      const view = renderRoute({ url: '/app' });
      expect(await bannerWith(couple)).not.toBeNull();
      // O Adiar a data e o Renovar entram no E11, com o pagar (333(2)).
      expect(screen.queryByRole('link', { name: /Adiar a data|Renovar/ })).toBeNull();
      if ('paidThrough' in lifecycle) {
        expect(screen.getByRole('link', { name: 'Voltar ao ar' })).toHaveAttribute(
          'href',
          '/app/cobranca/data-de-saida',
        );
      } else {
        expect(screen.queryByRole('link', { name: 'Voltar ao ar' })).toBeNull();
      }
      expect(
        screen.queryByRole('button', { name: /Adiar a data|Renovar|Voltar ao ar/ }),
      ).toBeNull();
      view.unmount();
      profileUnderTest.current = 'planner';
      mockLifecycle({ lifecycle });
      renderRoute({ url: PLANNER_URL });
      expect(await bannerWith(planner)).not.toBeNull();
      expect(screen.queryByRole('link', { name: 'Voltar ao ar' })).toBeNull();
    },
  );

  it('sem renovação: o casal com o Exportar os convidados; a colaboradora, sem link (314(1)(2))', async () => {
    // 22/11/2027: o casamento de 14/11/2026 já passou de 12 meses.
    vi.setSystemTime(new Date('2027-11-25T15:00:00Z'));
    mockLifecycle({ lifecycle: FINAL });
    const view = renderRoute({ url: '/app' });
    const banner = await bannerWith(
      'O site está fora do ar desde 22 de nov. Ele chegou ao prazo máximo, 12 meses depois do casamento, e não pode mais ser renovado. Vocês ainda podem exportar os convidados.',
    );
    expect(
      within(banner as HTMLElement).getByRole('link', { name: 'Exportar os convidados' }),
    ).toHaveAttribute('href', '/app/convidados/exportar');
    view.unmount();
    profileUnderTest.current = 'planner';
    mockLifecycle({ lifecycle: FINAL });
    renderRoute({ url: PLANNER_URL });
    const plannerBanner = await bannerWith(
      'O site está fora do ar desde 22 de nov. Ele chegou ao prazo máximo, 12 meses depois do casamento, e não pode mais ser renovado. Peça ao casal para exportar os convidados.',
    );
    expect(within(plannerBanner as HTMLElement).queryByRole('link')).toBeNull();
  });

  it('bloqueado: sem estas faixas, que a do bloqueio substitui (RN06; 329(4))', async () => {
    mockLifecycle({ lifecycle: { ...EXPIRED, blocked: true } });
    renderRoute({ url: '/app' });
    await screen.findByRole('button', { name: 'Menu do usuário' });
    expect(screen.queryByText(/^O site está fora do ar/)).toBeNull();
  });

  it('publicado e pós-evento: sem faixa', async () => {
    mockLifecycle({ lifecycle: { status: 'post_event' } });
    renderRoute({ url: '/app' });
    await screen.findByRole('button', { name: 'Menu do usuário' });
    expect(screen.queryByText(/^A data de saída do ar passou|^O site está fora do ar/)).toBeNull();
  });

  it('sem violações de acessibilidade, com a faixa', async () => {
    mockLifecycle({ lifecycle: GRACE });
    const { container } = renderRoute({ url: '/app' });
    await screen.findByText(/^A data de saída do ar passou/);
    await expectNoA11yViolations({ container });
  });
});
