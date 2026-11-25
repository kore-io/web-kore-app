import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderAreaScreen } from '../../../../tests/render-route';
import { formatCents } from '../../../shared/money';

// O jsdom não tem canvas: o QR vem pronto (o qrcode desenha no navegador de verdade).
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async () => 'data:image/png;base64,UVI=') },
}));

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
        status: 'draft',
        endDate: null,
        graceUntil: null,
        expiredAt: null,
        paidThrough: null,
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

const PENDING = {
  paymentId: 'p1',
  kind: 'publication',
  method: 'pix',
  amountCents: 32699,
  // 15h em UTC é meio-dia em São Paulo, no dia do relógio fixo.
  dueAt: '2026-11-25T15:00:00Z',
  pixCopyPaste: '00020126LOCALPIX',
  // A data pedida, no pendente desde o #213 (324(3)).
  endDate: '2027-03-14',
};

/** O billing a cada consulta: a função recebe o número da consulta (1, 2, …). */
function mockPix({
  billing = () => ({ status: 'draft', pendingPayment: PENDING }),
}: {
  billing?: (call: number) => { status: string; pendingPayment: unknown };
} = {}) {
  let calls = 0;
  mockApi(({ path }) => {
    if (path === '/v1/me') return Response.json(meFor(me));
    if (path === '/v1/weddings/w1/billing') {
      calls += 1;
      return Response.json({
        publishedAt: null,
        endDate: null,
        paidThrough: null,
        graceUntil: null,
        expiredAt: null,
        purgeAt: null,
        publicationSource: null,
        awaitingPayment: true,
        payments: [],
        payer: null,
        ...billing(calls),
      });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
}

const URL_PIX = '/app/cobranca/pix';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-25T14:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Pagar com Pix (Publicar RN03, RN07, RN11 e RN13; Penpot 21, A3)', () => {
  it('o valor, o QR, o copia e cola, a espera e a validade no fuso do casamento', async () => {
    mockPix();
    renderAreaScreen({ url: URL_PIX });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pagar com Pix' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatCents({ cents: 32699 }).replace(/\u00a0/g, ' ')),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Abram o app do banco e leiam o QR Code, ou copiem o código.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'QR Code do Pix' })).toHaveAttribute(
      'src',
      'data:image/png;base64,UVI=',
    );
    expect(
      screen.getByRole('textbox', {
        name: 'Abram o app do banco e leiam o QR Code, ou copiem o código.',
      }),
    ).toHaveValue('00020126LOCALPIX');
    expect(screen.getByRole('status')).toHaveTextContent('Aguardando a confirmação do pagamento');
    expect(screen.getByText('O código vale até 25 de nov. às 12h.')).toBeInTheDocument();
    expect(
      screen.getByText('O site vai ao ar assim que o pagamento for confirmado.'),
    ).toBeInTheDocument();
  });

  it('Copiar código copia o copia e cola e mostra o Toast', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    mockPix();
    renderAreaScreen({ url: URL_PIX });
    await user.click(await screen.findByRole('button', { name: 'Copiar código' }));
    expect(writeText).toHaveBeenCalledWith('00020126LOCALPIX');
    expect(await screen.findByText('Código copiado.')).toBeInTheDocument();
  });

  it('a confirmação leva ao Dashboard com o Toast (RN13)', async () => {
    mockPix({
      billing: (call) =>
        call === 1
          ? { status: 'draft', pendingPayment: PENDING }
          : { status: 'published', pendingPayment: null },
    });
    const { router } = renderAreaScreen({ url: URL_PIX });
    await screen.findByRole('button', { name: 'Copiar código' });
    // O polling de 5 s: o tempo de verdade (o Date é o único falso).
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'), { timeout: 7000 });
    expect(screen.getByText('Pagamento confirmado. O site está no ar.')).toBeInTheDocument();
  }, 10_000);

  it('o dueAt passado: o vencido e o Gerar novo Pix volta ao Publicar com o pendente (324)', async () => {
    const user = userEvent.setup();
    vi.setSystemTime(new Date('2026-11-25T16:00:00Z'));
    mockPix();
    const { router } = renderAreaScreen({ url: URL_PIX, state: { endDate: '2027-02-14' } });
    expect(
      await screen.findByText('Este código Pix venceu. Gerem um novo para pagar.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar código' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Gerar novo Pix' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/cobranca/publicar'));
    // A data do pendente vale sobre a da navegação.
    expect(router.state.location.state).toEqual({
      method: 'pix',
      endDate: '2027-03-14',
      replacesPaymentId: 'p1',
    });
  });

  it('o pendente que some sem o site publicado também é o vencido (RN11), sem o replaces', async () => {
    const user = userEvent.setup();
    mockPix({
      billing: (call) =>
        call === 1
          ? { status: 'draft', pendingPayment: PENDING }
          : { status: 'draft', pendingPayment: null },
    });
    const { router } = renderAreaScreen({ url: URL_PIX });
    await screen.findByRole('button', { name: 'Copiar código' });
    expect(
      await screen.findByText(
        'Este código Pix venceu. Gerem um novo para pagar.',
        {},
        { timeout: 7000 },
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Gerar novo Pix' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/cobranca/publicar'));
    expect(router.state.location.state).toEqual({ method: 'pix', endDate: '2027-03-14' });
  }, 10_000);

  it('Pagar com cartão volta ao Publicar no cartão, com o pendente a trocar (RN07; 324)', async () => {
    const user = userEvent.setup();
    mockPix();
    const { router } = renderAreaScreen({ url: URL_PIX, state: { endDate: '2027-02-14' } });
    await user.click(await screen.findByRole('button', { name: 'Pagar com cartão' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/cobranca/publicar'));
    expect(router.state.location.state).toEqual({
      method: 'card',
      endDate: '2027-03-14',
      replacesPaymentId: 'p1',
    });
  });

  it('sem Pix pendente, o Publicar', async () => {
    mockPix({ billing: () => ({ status: 'draft', pendingPayment: null }) });
    const { router } = renderAreaScreen({ url: URL_PIX });
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/cobranca/publicar'));
  });

  it('a colaboradora vai ao Publicar, na versão dela (decisão 323)', async () => {
    profileUnderTest.current = 'planner';
    mockPix();
    const { router } = renderAreaScreen({ url: URL_PIX });
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/cobranca/publicar'));
  });

  it('sem violações de acessibilidade', async () => {
    mockPix();
    const { container } = renderAreaScreen({ url: URL_PIX });
    await screen.findByRole('img', { name: 'QR Code do Pix' });
    await expectNoA11yViolations({ container });
  });
});
