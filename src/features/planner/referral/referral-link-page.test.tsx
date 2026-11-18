import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

afterEach(() => {
  vi.unstubAllGlobals();
});

const URL = '/cerimonialista/link-de-indicacao';

const me = {
  user: {
    id: 'u1',
    name: 'Juliana Prado',
    email: 'juliana@pradoassessoria.com.br',
    platformRole: 'none',
  },
  activeProfile: 'planner',
  authenticatedAt: '2026-11-18T12:00:00Z',
  memberships: [],
  profiles: ['planner'],
  lastProfileOnDevice: 'planner',
  planner: { organization: 'Prado Assessoria', weddingsCount: 1 },
  referrer: null,
  plannerSignupEnabled: true,
  identities: [{ provider: 'email' }],
};

// A ordem é a do servidor, do cadastro mais recente (RN03); só Ana e Marcos é colaboração (RN05).
const referred = [
  { weddingId: null, partnerNames: ['Tatiane', 'Leandro'], status: 'draft', commission: null },
  {
    weddingId: null,
    partnerNames: ['Bianca', 'Henrique'],
    status: 'published',
    commission: { totalCents: 4422, byStatus: [{ status: 'pending', amountCents: 4422 }] },
  },
  { weddingId: 'w1', partnerNames: ['Ana', 'Marcos'], status: 'published', commission: null },
];

function api({
  weddings = referred,
  discountPercent = 10 as number | null,
  failWeddings = false,
}: { weddings?: object[]; discountPercent?: number | null; failWeddings?: boolean } = {}) {
  mockApi(({ path }) => {
    if (path === '/v1/me') return Response.json(me);
    if (path === '/v1/me/referrer') {
      return Response.json({
        referralCode: 'juliana-prado',
        link: 'https://kore.com.br/i/juliana-prado',
        discountPercent,
        ratePercent: 20,
        balances: { availableCents: 0, pendingCents: 0, receivedCents: 0, inPayoutCents: 0 },
        taxIdMasked: null,
        pixKeyMasked: null,
      });
    }
    if (path === '/v1/me/referrer/weddings') {
      return failWeddings
        ? apiError({ status: 503, body: { error: 'UNAVAILABLE' } })
        : Response.json(weddings);
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
}

describe('Link de indicação (Link de indicação RN01 a RN06; Penpot 09; decisão 288)', () => {
  it('o link, o subtítulo do desconto sem o percentual da comissão e a lista Casal · Status', async () => {
    api();
    const { container } = renderRoute({ url: URL });
    expect(
      await screen.findByRole('heading', { name: 'Link de indicação', level: 1 }),
    ).toBeVisible();
    expect(
      await screen.findByText('Quem se cadastrar por este link ganha 10% de desconto na ativação.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/20%/)).toBeNull();
    expect(screen.getByText('kore.com.br/i/juliana-prado')).toBeInTheDocument();
    const list = screen.getByRole('region', { name: 'Casais que vieram pelo seu link' });
    const table = within(list).getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Casal', 'Status']);
    // Sem a coluna Comissão até a F3 (decisão 288(b)).
    expect(within(list).queryByText(/Comissão|R\$/)).toBeNull();
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Tatiane e Leandro', 'Bianca e Henrique', 'Ana e Marcos']);
    expect(within(table).getByText('Rascunho')).toBeInTheDocument();
    await expectNoA11yViolations({ container });
  });

  it('só a linha de quem colabora abre o detalhe de Meus casamentos (RN05)', async () => {
    const user = userEvent.setup();
    api();
    const { router } = renderRoute({ url: URL });
    const list = await screen.findByRole('region', { name: 'Casais que vieram pelo seu link' });
    const table = within(list).getByRole('table');
    expect(within(table).queryByRole('link', { name: 'Tatiane e Leandro' })).toBeNull();
    expect(within(table).queryByRole('link', { name: 'Bianca e Henrique' })).toBeNull();
    const cards = within(list).getByRole('list');
    expect(
      within(cards)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([expect.stringContaining('Ana e Marcos')]);
    const link = within(table).getByRole('link', { name: 'Ana e Marcos' });
    expect(link).toHaveAttribute('href', '/cerimonialista?casamento=w1');
    await user.click(link);
    // O detalhe abre sobre Meus casamentos.
    await waitFor(() => expect(router.state.location.pathname).toBe('/cerimonialista'));
  });

  it('o clickable do servidor vale sobre o weddingId, quando vier (decisão 288)', async () => {
    api({
      weddings: [
        { ...referred[2], clickable: false },
        { ...referred[0], weddingId: null, clickable: false },
      ],
    });
    renderRoute({ url: URL });
    const list = await screen.findByRole('region', { name: 'Casais que vieram pelo seu link' });
    expect(within(list).queryAllByRole('link')).toEqual([]);
  });

  it('Copiar link e Compartilhar no WhatsApp com a mensagem da Voz (RN02)', async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    vi.stubGlobal('open', open);
    api();
    renderRoute({ url: URL });
    await user.click(await screen.findByRole('button', { name: 'Copiar link' }));
    expect(await screen.findByText('Link copiado.')).toBeInTheDocument();
    await expect(navigator.clipboard.readText()).resolves.toBe(
      'https://kore.com.br/i/juliana-prado',
    );
    await user.click(screen.getByRole('button', { name: 'Compartilhar no WhatsApp' }));
    const message =
      'Oi! Uso o Kore para organizar os casamentos dos meus clientes. Se vocês se cadastrarem por este link, ganham 10% de desconto na ativação do site: https://kore.com.br/i/juliana-prado';
    expect(open).toHaveBeenCalledWith(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener',
    );
  });

  it('com o desconto desligado: sem o subtítulo e a mensagem sem desconto (decisão 250(b))', async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    vi.stubGlobal('open', open);
    api({ discountPercent: null });
    renderRoute({ url: URL });
    await user.click(await screen.findByRole('button', { name: 'Compartilhar no WhatsApp' }));
    expect(screen.queryByText(/desconto na ativação/)).toBeNull();
    const message =
      'Oi! Uso o Kore para organizar os casamentos dos meus clientes. Vocês podem se cadastrar por este link: https://kore.com.br/i/juliana-prado';
    expect(open).toHaveBeenCalledWith(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener',
    );
  });

  it('o vazio com o Compartilhar no WhatsApp (RN06)', async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    vi.stubGlobal('open', open);
    api({ weddings: [] });
    const { container } = renderRoute({ url: URL });
    const list = await screen.findByRole('region', { name: 'Casais que vieram pelo seu link' });
    expect(
      within(list).getByText('Nenhum casal se cadastrou pelo seu link ainda.'),
    ).toBeInTheDocument();
    expect(
      within(list).getByText('Compartilhe com os casais que você atende.'),
    ).toBeInTheDocument();
    expect(within(list).queryByRole('table')).toBeNull();
    await user.click(within(list).getByRole('button', { name: 'Compartilhar no WhatsApp' }));
    expect(open).toHaveBeenCalledTimes(1);
    await expectNoA11yViolations({ container });
  });

  it('a falha de leitura mostra o aviso com Tentar de novo', async () => {
    api({ failWeddings: true });
    renderRoute({ url: URL });
    expect(await screen.findByRole('button', { name: /Tentar de novo/ })).toBeInTheDocument();
    expect(screen.queryByText('kore.com.br/i/juliana-prado')).toBeNull();
  });
});
