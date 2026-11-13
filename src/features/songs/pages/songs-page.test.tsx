import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';
import { intersect } from '../../../../tests/setup';
import { me, siteWith } from '../../site/sections/section-test-fixtures';

const suggestion = (guestId: string, song: string, overrides: object = {}) => ({
  guestId,
  song,
  guestName: 'Célia Moreira',
  partyName: 'Família Moreira',
  suggestedAt: new Date(2026, 8, 12, 20, 14).toISOString(),
  ...overrides,
});

type Call = { method: string; path: string };

function mockSongs({
  enabled = true,
  pages = [
    [suggestion('g1', 'Evidências'), suggestion('g2', 'Evidências', { guestName: 'Pedro' })],
  ],
  listError,
  exportError,
}: {
  enabled?: boolean;
  pages?: object[][];
  listError?: { status: number; body: Record<string, unknown> };
  exportError?: { status: number; body: Record<string, unknown> };
} = {}) {
  const calls: Call[] = [];
  const total = pages.flat().length;
  mockApi(({ method, path }) => {
    if (path === '/v1/me') return Response.json(me);
    if (path === '/v1/weddings/w1/site') {
      return Response.json({
        ...siteWith(),
        songQuestion: { enabled, text: 'Que música não pode faltar na festa?' },
      });
    }
    if (path === '/v1/weddings/w1/song-suggestions/export') {
      calls.push({ method, path });
      if (exportError) return apiError(exportError);
      return new Response(new Blob(['xlsx']), {
        headers: {
          'Content-Disposition': `attachment; filename="musicas-ana-e-marcos.xlsx"`,
        },
      });
    }
    if (path.startsWith('/v1/weddings/w1/song-suggestions')) {
      calls.push({ method, path });
      if (listError) return apiError(listError);
      const cursor = new URLSearchParams(path.split('?')[1]).get('cursor');
      const index = cursor ? Number(cursor) : 0;
      return Response.json({
        items: pages[index] ?? [],
        nextCursor: index + 1 < pages.length ? String(index + 1) : null,
        total,
      });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

let clicked: { href: string; download: string }[] = [];
beforeEach(() => {
  clicked = [];
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:kore/songs', revokeObjectURL: vi.fn() }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({ href: this.getAttribute('href') ?? '', download: this.download });
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Músicas (Música RN03, RN05, RN06)', () => {
  it('a lista com as colunas, sem juntar repetidas, e Músicas marcado na Sidebar', async () => {
    mockSongs();
    renderRoute({ url: '/app/musicas' });
    expect(await screen.findByRole('heading', { name: 'Músicas', level: 1 })).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Músicas' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Música', 'Quem sugeriu', 'Grupo', 'Data da sugestão']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByText('Evidências')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText(/^12\/09 às 20h14$/)).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('Pedro')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Músicas' })).toHaveAttribute('aria-current', 'page');
  });

  it('desligada: o caminho leva ao Editor › Pergunta de música, e a Sidebar fica sem Músicas', async () => {
    mockSongs({ enabled: false });
    const { router } = renderRoute({ url: '/app/musicas' });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/app/site/pergunta-de-musica'),
    );
    await screen.findByRole('heading', { name: 'Pergunta de música', level: 2 });
    expect(screen.queryByRole('link', { name: 'Músicas' })).toBeNull();
  });

  it('o 404 SONG_QUESTION_DISABLED da lista também leva ao Editor', async () => {
    mockSongs({ listError: { status: 404, body: { error: 'SONG_QUESTION_DISABLED' } } });
    const { router } = renderRoute({ url: '/app/musicas' });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/app/site/pergunta-de-musica'),
    );
  });

  it('vazia: o Empty State e o Exportar desabilitado com o motivo', async () => {
    mockSongs({ pages: [[]] });
    renderRoute({ url: '/app/musicas' });
    expect(await screen.findByText('Ainda não há sugestões')).toBeInTheDocument();
    expect(screen.getByText('Elas aparecem conforme os convidados confirmam.')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Exportar para o DJ' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Ainda não há sugestões para exportar.');
  });

  it('a rolagem pede a próxima página pelo cursor', async () => {
    const calls = mockSongs({
      pages: [[suggestion('g1', 'Evidências')], [suggestion('g2', 'Garota de Ipanema')]],
    });
    renderRoute({ url: '/app/musicas' });
    await screen.findByText('Evidências');
    expect(screen.queryByText('Garota de Ipanema')).toBeNull();
    intersect();
    expect(await screen.findByText('Garota de Ipanema')).toBeInTheDocument();
    expect(calls.map((call) => call.path)).toContain('/v1/weddings/w1/song-suggestions?cursor=1');
  });

  it('Exportar para o DJ baixa o .xlsx na hora e mostra "Lista exportada."', async () => {
    const user = userEvent.setup();
    mockSongs();
    renderRoute({ url: '/app/musicas' });
    await screen.findByRole('table', { name: 'Músicas' });
    await user.click(screen.getByRole('button', { name: 'Exportar para o DJ' }));
    expect(await screen.findByText('Lista exportada.')).toBeInTheDocument();
    expect(clicked).toEqual([{ href: 'blob:kore/songs', download: 'musicas-ana-e-marcos.xlsx' }]);
  });

  it('a recusa do arquivo (429): o Toast de erro, sem baixar', async () => {
    const user = userEvent.setup();
    mockSongs({ exportError: { status: 429, body: { error: 'TOO_MANY_REQUESTS' } } });
    renderRoute({ url: '/app/musicas' });
    await screen.findByRole('table', { name: 'Músicas' });
    await user.click(screen.getByRole('button', { name: 'Exportar para o DJ' }));
    expect(await screen.findByText(/^Não foi possível continuar/)).toBeInTheDocument();
    expect(screen.queryByText('Lista exportada.')).toBeNull();
    expect(clicked).toEqual([]);
  });

  it('é acessível', async () => {
    mockSongs();
    const { container } = renderRoute({ url: '/app/musicas' });
    await screen.findByRole('table', { name: 'Músicas' });
    await expectNoA11yViolations({ container });
  });
});
