import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

const me = {
  user: {
    id: 'u1',
    name: 'Ana Beatriz Moreira',
    email: 'ana.moreira@gmail.com',
    platformRole: 'none',
  },
  activeProfile: 'couple',
  authenticatedAt: '2026-11-05T12:00:00Z',
  memberships: [
    {
      weddingId: 'w1',
      role: 'owner',
      weddingName: 'Ana & Marcos',
      eventDate: '2026-11-14',
      city: 'Campinas',
      state: 'SP',
    },
  ],
  profiles: ['couple'],
  lastProfileOnDevice: 'couple',
  planner: null,
  referrer: null,
};

const tags = [
  { id: 't1', name: 'Família da Ana', color: 'wine', guests: 0 },
  { id: 't2', name: 'Padrinhos', color: 'champagne', guests: 12 },
];

let clicked: { href: string; download: string }[] = [];

beforeEach(() => {
  clicked = [];
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:kore/1', revokeObjectURL: vi.fn() }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({ href: this.getAttribute('href') ?? '', download: this.download });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockExport({
  confirmed = 0,
  namedGuests = 140,
  tagList = tags,
  exportResponse = () =>
    new Response(new Blob(['x']), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="convidados-ana-e-marcos-2026-11-11.xlsx"; filename*=UTF-8\'\'convidados-ana-e-marcos-2026-11-11.xlsx',
      },
    }),
}: {
  confirmed?: number;
  namedGuests?: number;
  tagList?: typeof tags;
  exportResponse?: () => Response;
} = {}) {
  const exports: string[] = [];
  mockApi(({ path }) => {
    if (path === '/v1/me') return Response.json(me);
    if (path === '/v1/weddings/w1/tags') return Response.json({ limit: 10, data: tagList });
    if (path.startsWith('/v1/weddings/w1/parties')) {
      return Response.json({
        summary: {
          guests: 142,
          namedGuests,
          parties: 58,
          confirmed,
          declined: 0,
          pending: 142 - confirmed,
        },
        total: 58,
        data: [],
        nextCursor: null,
      });
    }
    if (path.startsWith('/v1/weddings/w1/guests/export')) {
      exports.push(path);
      return exportResponse();
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return exports;
}

describe('Convidados › Exportar (Exportação RN01 a RN06; decisão 212)', () => {
  it('sem confirmados: começa em Todos com o namedGuests, Confirmados (0) desabilitado e sem o texto do buffet', async () => {
    mockExport();
    renderRoute({ url: '/app/convidados/exportar' });
    const all = await screen.findByRole('radio', { name: 'Todos (140)' });
    expect(all).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Confirmados (0)' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Excel (.xlsx)' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'PDF para impressão' })).not.toBeChecked();
    expect(screen.getByRole('group', { name: 'Formato' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Quem entra' })).toBeInTheDocument();
    const columns = within(screen.getByRole('group', { name: 'Colunas' })).getAllByRole('checkbox');
    expect(
      columns.map((box) => [box.closest('label')?.textContent, (box as HTMLInputElement).checked]),
    ).toEqual([
      ['Nome', true],
      ['Grupo', true],
      ['Faixa etária', true],
      ['Restrição alimentar', true],
      ['Resposta', true],
      ['Telefone de contato', false],
      ['Tags', false],
    ]);
    expect(screen.queryByText(/Para o buffet/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Exportar 140 convidados' })).toBeEnabled();
    const tabs = screen.getByRole('navigation', { name: 'Convidados' });
    expect(within(tabs).getByRole('link', { current: 'page' })).toHaveTextContent('Exportar');
  });

  it('com confirmados: começa em Confirmados, com o texto do buffet no plural e no singular', async () => {
    mockExport({ confirmed: 96 });
    const { unmount } = renderRoute({ url: '/app/convidados/exportar' });
    expect(await screen.findByRole('radio', { name: 'Confirmados (96)' })).toBeChecked();
    expect(
      screen.getByText(
        'Para o buffet: nome, faixa etária e restrição alimentar dos 96 confirmados.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar 96 convidados' })).toBeEnabled();
    unmount();
    mockExport({ confirmed: 1 });
    renderRoute({ url: '/app/convidados/exportar' });
    expect(
      await screen.findByText(
        'Para o buffet: nome, faixa etária e restrição alimentar de 1 confirmado.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar 1 convidado' })).toBeEnabled();
  });

  it('Exportar pede o arquivo com as escolhas e baixa com o nome da API (RN01, RN04, RN09)', async () => {
    const user = userEvent.setup();
    const exports = mockExport();
    renderRoute({ url: '/app/convidados/exportar' });
    await user.click(await screen.findByRole('button', { name: 'Exportar 140 convidados' }));
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(exports).toEqual([
      '/v1/weddings/w1/guests/export?format=xlsx&who=all&columns=name%2Cparty%2CageGroup%2CdietaryRestriction%2Crsvp',
    ]);
    expect(clicked[0]).toEqual({
      href: 'blob:kore/1',
      download: 'convidados-ana-e-marcos-2026-11-11.xlsx',
    });
  });

  it('PDF, Por tag e as colunas desmarcadas por padrão (RN02, RN04, RN05)', async () => {
    const user = userEvent.setup();
    const exports = mockExport();
    renderRoute({ url: '/app/convidados/exportar' });
    await user.click(await screen.findByRole('radio', { name: 'PDF para impressão' }));
    await user.click(screen.getByRole('radio', { name: 'Por tag' }));
    const select = screen.getByRole('combobox', { name: 'Tag' });
    expect(select).toHaveValue('t2');
    expect(screen.getByRole('option', { name: 'Família da Ana (0)' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Padrinhos (12)' })).toBeEnabled();
    await user.click(screen.getByRole('checkbox', { name: 'Telefone de contato' }));
    await user.click(screen.getByRole('checkbox', { name: 'Tags' }));
    await user.click(screen.getByRole('checkbox', { name: 'Resposta' }));
    await user.click(screen.getByRole('button', { name: 'Exportar 12 convidados' }));
    await waitFor(() => expect(exports).toHaveLength(1));
    const query = new URLSearchParams(exports[0]?.split('?')[1]);
    expect(Object.fromEntries(query)).toEqual({
      format: 'pdf',
      who: 'tag',
      columns: 'name,party,ageGroup,dietaryRestriction,phone,tags',
      tag: 't2',
    });
  });

  it('sem coluna marcada, Exportar fica desabilitado (RN04)', async () => {
    const user = userEvent.setup();
    mockExport();
    renderRoute({ url: '/app/convidados/exportar' });
    await screen.findByRole('radio', { name: 'Todos (140)' });
    for (const name of ['Nome', 'Grupo', 'Faixa etária', 'Restrição alimentar', 'Resposta']) {
      await user.click(screen.getByRole('checkbox', { name }));
    }
    expect(screen.getByRole('button', { name: 'Exportar 140 convidados' })).toBeDisabled();
  });

  it('sem tag com convidado, Por tag fica desabilitado', async () => {
    mockExport({ tagList: [] });
    renderRoute({ url: '/app/convidados/exportar' });
    expect(await screen.findByRole('radio', { name: 'Por tag' })).toBeDisabled();
  });

  it('erro da API mostra o aviso genérico e não baixa', async () => {
    const user = userEvent.setup();
    mockExport({
      exportResponse: () => apiError({ status: 429, body: { error: 'RATE_LIMITED' } }),
    });
    renderRoute({ url: '/app/convidados/exportar' });
    await user.click(await screen.findByRole('button', { name: 'Exportar 140 convidados' }));
    expect(
      await screen.findByText('Não foi possível continuar. Confira sua conexão e tente de novo.'),
    ).toBeInTheDocument();
    expect(clicked).toHaveLength(0);
  });

  it('é acessível', async () => {
    const user = userEvent.setup();
    mockExport({ confirmed: 96 });
    const { container } = renderRoute({ url: '/app/convidados/exportar' });
    await screen.findByRole('radio', { name: 'Confirmados (96)' });
    await expectNoA11yViolations({ container });
    await user.click(screen.getByRole('radio', { name: 'Por tag' }));
    await expectNoA11yViolations({ container });
  });
});
