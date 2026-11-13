import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderAreaScreen, renderRoute } from '../../../../tests/render-route';
import type { SpreadsheetPreviewResponse } from '../../../shared/api/generated/model';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

const preview: SpreadsheetPreviewResponse = {
  fileName: 'convidados-ana-e-marcos.xlsx',
  parties: 58,
  guests: 142,
  counts: { valid: 142, errors: 2, duplicates: 1 },
  skipped: [
    {
      row: 37,
      name: 'Rosa Almeida',
      kind: 'error',
      code: 'PHONE_TOO_SHORT',
      field: 'phone',
      params: { n: 8 },
    },
    { row: 88, name: null, kind: 'error', code: 'NAME_MISSING', field: 'name', params: {} },
    {
      row: 120,
      name: 'Pedro Moreira',
      kind: 'duplicate',
      code: 'DUPLICATE',
      params: {},
      duplicateOf: { row: 12, party: 'Família Moreira' },
    },
  ],
  warnings: [
    { code: 'PARTY_NAME_EXISTS', party: 'Família Rocha', rows: [5] },
    { code: 'TAG_LIMIT', tag: 'Vizinhos', rows: [9] },
  ],
};

type Call = { method: string; path: string };

function mockImport({
  previewResponse = () => Response.json(preview),
  importResponse = () =>
    Response.json({ parties: 58, guests: 142, skipped: 3, tagsCreated: [] }, { status: 201 }),
}: {
  previewResponse?: () => Response | Promise<Response>;
  importResponse?: () => Response | Promise<Response>;
} = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path }) => {
    if (path === '/v1/me') return Response.json(meFor(me));
    if (path === '/v1/weddings/w1/tags') return Response.json({ limit: 10, data: [] });
    if (method === 'GET' && path.startsWith('/v1/weddings/w1/parties')) {
      return Response.json({
        summary: { guests: 0, namedGuests: 0, parties: 0, confirmed: 0, declined: 0, pending: 0 },
        total: 0,
        data: [],
        nextCursor: null,
      });
    }
    // A Sidebar lê o site (o item Músicas, Música RN03): não é chamada da tela.
    if (path === '/v1/weddings/w1/site')
      return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
    calls.push({ method, path });
    if (path === '/v1/weddings/w1/guest-imports/spreadsheet/preview') return previewResponse();
    if (path === '/v1/weddings/w1/guest-imports/spreadsheet') return importResponse();
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const sheet = () =>
  new File(['x'], 'convidados-ana-e-marcos.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

async function sendSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(
    await screen.findByLabelText(/Arrastem a planilha ou cliquem para escolher/),
    sheet(),
  );
}

describe('Convidados › Importar planilha (Importação RN01 a RN09)', () => {
  it('o envio: os dois passos, o modelo estático e a área de envio do casal', async () => {
    mockImport();
    renderRoute({ url: '/app/convidados/importar' });
    expect(await screen.findByRole('heading', { name: '1. Baixar o modelo' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Uma linha por convidado. Convidados do mesmo grupo repetem o nome do grupo.',
      ),
    ).toBeInTheDocument();
    const download = screen.getByRole('link', { name: 'Baixar modelo (.xlsx)' });
    expect(download).toHaveAttribute('href', '/modelo-convidados-kore.xlsx');
    expect(download).toHaveAttribute('download');
    expect(
      screen.getByRole('heading', { name: '2. Enviar a planilha preenchida' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Arrastem a planilha/)).toHaveAccessibleName(
      'Arrastem a planilha ou cliquem para escolher Excel (.xlsx) com até 1.000 linhas',
    );
    expect(
      screen.getByText(
        'Antes de criar os grupos, mostramos uma prévia com as linhas que têm erro.',
      ),
    ).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Convidados' });
    expect(within(tabs).getByRole('link', { current: 'page' })).toHaveTextContent('Importar');
  });

  it('a prévia: o arquivo, os quadros, as linhas de fora com o texto de cada código e os avisos', async () => {
    const user = userEvent.setup();
    const calls = mockImport();
    renderRoute({ url: '/app/convidados/importar' });
    await sendSheet(user);
    expect(await screen.findByText('convidados-ana-e-marcos.xlsx')).toBeInTheDocument();
    expect(screen.getByText('58 grupos · 142 convidados')).toBeInTheDocument();
    expect(screen.getByText('viram 58 grupos')).toBeInTheDocument();
    expect(screen.getAllByText('ficam de fora')).toHaveLength(2);
    const rows = within(
      screen
        .getByRole('heading', { name: 'Linhas que ficam de fora' })
        .closest('section') as HTMLElement,
    ).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Linha 37 · Rosa AlmeidaO telefone tem 8 números. Usem DDD + número, ex.: (19) 99999-9999.',
      'Linha 88 · sem nomeFalta o nome do convidado. Preencham a coluna Nome.',
      'Linha 120 · Pedro MoreiraRepetido: já está na linha 12, no grupo Família Moreira.',
    ]);
    expect(
      screen.getByText('Família Rocha: já existe um grupo com este nome.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('A tag Vizinhos não foi criada: vocês já têm 10 tags.'),
    ).toBeInTheDocument();
    expect(screen.getByText('58 grupos e 142 convidados serão criados.')).toBeInTheDocument();
    expect(
      screen.getByText('As 3 linhas que ficaram de fora vocês cadastram depois, uma a uma.'),
    ).toBeInTheDocument();
    expect(calls).toEqual([
      { method: 'POST', path: '/v1/weddings/w1/guest-imports/spreadsheet/preview' },
    ]);
  });

  it('com 1 linha de fora, o singular aprovado; sem nenhuma, só o resumo', async () => {
    const user = userEvent.setup();
    mockImport({
      previewResponse: () =>
        Response.json({
          ...preview,
          counts: { valid: 142, errors: 1, duplicates: 0 },
          skipped: [preview.skipped[1]],
          warnings: [],
        }),
    });
    renderRoute({ url: '/app/convidados/importar' });
    await sendSheet(user);
    expect(
      await screen.findByText('A linha que ficou de fora vocês cadastram depois.'),
    ).toBeInTheDocument();
  });

  it('Importar reenvia o arquivo, fica desabilitado e volta à lista com "58 grupos importados"', async () => {
    const user = userEvent.setup();
    // A resposta do importar fica presa até o teste conferir o botão desabilitado (186(1)).
    let answer: (response: Response) => void = () => undefined;
    const calls = mockImport({
      importResponse: () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    const { router } = renderRoute({ url: '/app/convidados/importar' });
    await sendSheet(user);
    const button = await screen.findByRole('button', { name: 'Importar 142 convidados' });
    await user.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    answer(
      Response.json({ parties: 58, guests: 142, skipped: 3, tagsCreated: [] }, { status: 201 }),
    );
    expect(await screen.findByText('58 grupos importados')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/convidados'));
    expect(calls.map((call) => call.path)).toEqual([
      '/v1/weddings/w1/guest-imports/spreadsheet/preview',
      '/v1/weddings/w1/guest-imports/spreadsheet',
    ]);
  });

  it('enquanto a API lê o arquivo, o Spinner "Lendo a planilha" e a área desabilitada (209(c))', async () => {
    const user = userEvent.setup();
    let answer: (response: Response) => void = () => undefined;
    mockImport({
      previewResponse: () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    renderRoute({ url: '/app/convidados/importar' });
    await sendSheet(user);
    expect((await screen.findByText('Lendo a planilha')).closest('[role="status"]')).not.toBeNull();
    expect(screen.getByLabelText(/Arrastem a planilha/)).toBeDisabled();
    answer(Response.json(preview));
    expect(await screen.findByText('convidados-ana-e-marcos.xlsx')).toBeInTheDocument();
    expect(screen.queryByText('Lendo a planilha')).toBeNull();
  });

  describe('versão da cerimonialista (decisão 198(2))', () => {
    it('o envio, o erro da linha, o aviso da tag e o rodapé no singular', async () => {
      profileUnderTest.current = 'planner';
      const user = userEvent.setup();
      mockImport();
      renderAreaScreen({ url: '/app/convidados/importar' });
      await user.upload(
        await screen.findByLabelText(/Arraste a planilha ou clique para escolher/),
        sheet(),
      );
      expect(
        await screen.findByText('Falta o nome do convidado. Preencha a coluna Nome.'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('A tag Vizinhos não foi criada: este casamento já tem 10 tags.'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('As 3 linhas que ficaram de fora você cadastra depois, uma a uma.'),
      ).toBeInTheDocument();
    });

    it.each([
      [
        422,
        'TEMPLATE_MISMATCH',
        'Esta planilha não está no modelo do Kore. Baixe o modelo ou use Colar a lista.',
      ],
      [422, 'TOO_MANY_ROWS', 'A planilha tem mais de 1.000 linhas. Divida em duas.'],
      [
        422,
        'NOT_XLSX',
        'Este arquivo não é uma planilha do Excel (.xlsx). Baixe o modelo ou use Colar a lista.',
      ],
      [413, 'FILE_TOO_LARGE', 'A planilha passa de 5 MB. Divida em duas.'],
    ])('arquivo recusado com %s %s', async (status, error, text) => {
      profileUnderTest.current = 'planner';
      const user = userEvent.setup();
      mockImport({ previewResponse: () => apiError({ status, body: { error } }) });
      renderAreaScreen({ url: '/app/convidados/importar' });
      await user.upload(await screen.findByLabelText(/Arraste a planilha/), sheet());
      expect(await screen.findByRole('alert')).toHaveTextContent(text);
    });
  });

  it('Enviar outra planilha volta ao envio, sem importar', async () => {
    const user = userEvent.setup();
    const calls = mockImport();
    renderRoute({ url: '/app/convidados/importar' });
    await sendSheet(user);
    // O X do arquivo e o botão de baixo têm o mesmo nome; o de baixo é o segundo.
    const [, bottom] = await screen.findAllByRole('button', { name: 'Enviar outra planilha' });
    await user.click(bottom as HTMLElement);
    expect(await screen.findByRole('heading', { name: '1. Baixar o modelo' })).toBeInTheDocument();
    expect(calls).toHaveLength(1);
  });

  it('sem nenhuma linha válida, o Importar fica desabilitado (RN09)', async () => {
    const user = userEvent.setup();
    mockImport({
      previewResponse: () =>
        Response.json({
          ...preview,
          parties: 0,
          guests: 0,
          counts: { valid: 0, errors: 3, duplicates: 0 },
        }),
    });
    renderRoute({ url: '/app/convidados/importar' });
    await sendSheet(user);
    expect(await screen.findByRole('button', { name: 'Importar 0 convidados' })).toBeDisabled();
  });

  it.each([
    [
      422,
      'TEMPLATE_MISMATCH',
      'Esta planilha não está no modelo do Kore. Baixem o modelo ou usem Colar a lista.',
    ],
    [422, 'TOO_MANY_ROWS', 'A planilha tem mais de 1.000 linhas. Dividam em duas.'],
    [
      422,
      'NOT_XLSX',
      'Este arquivo não é uma planilha do Excel (.xlsx). Baixem o modelo ou usem Colar a lista.',
    ],
    [413, 'FILE_TOO_LARGE', 'A planilha passa de 5 MB. Dividam em duas.'],
  ])('arquivo recusado com %s %s mostra o texto do casal', async (status, error, text) => {
    const user = userEvent.setup();
    mockImport({ previewResponse: () => apiError({ status, body: { error } }) });
    renderRoute({ url: '/app/convidados/importar' });
    await sendSheet(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.getByRole('heading', { name: '1. Baixar o modelo' })).toBeInTheDocument();
  });

  it('o "Importar planilha" do topo abre a aba Importar', async () => {
    const user = userEvent.setup();
    mockImport();
    const { router } = renderRoute({ url: '/app/convidados' });
    await user.click(await screen.findByRole('button', { name: 'Importar planilha' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/convidados/importar'));
  });

  it('é acessível, no envio e na prévia', async () => {
    const user = userEvent.setup();
    mockImport();
    const { container } = renderRoute({ url: '/app/convidados/importar' });
    await screen.findByRole('heading', { name: '1. Baixar o modelo' });
    await expectNoA11yViolations({ container });
    await sendSheet(user);
    await screen.findByText('convidados-ana-e-marcos.xlsx');
    await expectNoA11yViolations({ container });
  });
});
