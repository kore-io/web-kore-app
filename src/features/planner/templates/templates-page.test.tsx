import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

const PAGE = '/cerimonialista/modelos';

const me = {
  user: { id: 'u1', name: 'Juliana Prado', email: 'juliana@prado.com.br', platformRole: 'none' },
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

// Criados neste ano: a data aparece sem o ano (Voz).
const THIS_YEAR = new Date().getFullYear();
const base = {
  locale: 'pt-BR',
  createdAt: `${THIS_YEAR}-06-12T15:00:00Z`,
  updatedAt: `${THIS_YEAR}-06-12T15:00:00Z`,
};
const STORY = {
  ...base,
  id: 't1',
  kind: 'section_content',
  sectionType: 'story',
  name: 'Nossa história: tom acolhedor',
  content: { text: '{casal} se conheceram em {cidade}.\nE agora vão casar.' },
};
const FAQ = {
  ...base,
  id: 't2',
  kind: 'faq',
  sectionType: null,
  name: 'FAQ, cerimônia ao ar livre',
  content: { questions: [{ question: 'Tem estacionamento?', answer: 'Tem.' }] },
};
const LOOK = {
  ...base,
  id: 't3',
  kind: 'appearance',
  sectionType: null,
  name: 'Romântico, sálvia e creme',
  content: {
    fontPairKey: 'romantico',
    starterPaletteKey: 'salvia',
    primaryColor: '#566C4B',
    accentColor: '#C9A66B',
    backgroundMode: 'cream',
  },
};

/** O Criar modelo do cabeçalho (o vazio tem outro, igual). */
async function clickCreate(user: ReturnType<typeof userEvent.setup>) {
  const [header] = await screen.findAllByRole('button', { name: 'Criar modelo' });
  if (!header) throw new Error('sem o Criar modelo');
  await user.click(header);
}

type Call = { method: string; path: string; body?: unknown };

function api({
  templates = [STORY, FAQ, LOOK] as object[],
  save,
}: { templates?: object[]; save?: (call: Call) => Response } = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(me);
    if (method === 'GET' && path.startsWith('/v1/me/planner-templates')) {
      const kind = new URL(`http://x${path}`).searchParams.get('kind');
      return Response.json(templates.filter((item) => (item as { kind: string }).kind === kind));
    }
    if (path.startsWith('/v1/me/planner-templates')) {
      const call = { method, path, body };
      calls.push(call);
      if (save) return save(call);
      if (method === 'DELETE') return new Response(null, { status: 204 });
      return Response.json(
        { ...STORY, ...(body as object) },
        { status: method === 'POST' ? 201 : 200 },
      );
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

describe('Modelos (Modelos do cerimonialista RN01 a RN06; Voz, Modelos)', () => {
  it('as abas, a lista de Textos com a Seção e o Criado em, sem o idioma', async () => {
    api();
    const { container } = renderRoute({ url: PAGE });
    expect(await screen.findByRole('heading', { name: 'Modelos', level: 1 })).toBeVisible();
    const tabs = screen.getByRole('navigation', { name: 'Tipos de modelo' });
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Textos', 'FAQ', 'Aparência']);
    const table = await screen.findByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Nome', 'Seção', 'Criado em']);
    const row = within(table).getByRole('row', { name: /Nossa história: tom acolhedor/ });
    expect(within(row).getByText('Nossa história')).toBeInTheDocument();
    expect(within(row).getByText('12/06')).toBeInTheDocument();
    expect(screen.queryByText('pt-BR')).toBeNull();
    await expectNoA11yViolations({ container });
  });

  it('no FAQ, a coluna Seção diz "FAQ" (Penpot 11)', async () => {
    api();
    renderRoute({ url: `${PAGE}?aba=faq` });
    const table = await screen.findByRole('table');
    const row = within(table).getByRole('row', { name: new RegExp(FAQ.name) });
    expect(within(row).getAllByRole('cell')[0]).toHaveTextContent('FAQ');
  });

  it('a aba Aparência mostra a amostra com o texto acessível da Voz', async () => {
    api();
    renderRoute({ url: `${PAGE}?aba=aparencia` });
    const table = await screen.findByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Nome', 'Amostra', 'Criado em']);
    expect(
      within(table).getByRole('img', {
        name: 'Fontes Romântico · Cor principal e destaque da paleta Sálvia · Fundo creme',
      }),
    ).toBeInTheDocument();
  });

  it.each([
    ['', 'Você ainda não tem modelos de texto.'],
    ['?aba=faq', 'Você ainda não tem modelos de FAQ.'],
    ['?aba=aparencia', 'Você ainda não tem modelos de aparência.'],
  ])('o vazio da aba %s', async (query, title) => {
    api({ templates: [] });
    renderRoute({ url: `${PAGE}${query}` });
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Criar modelo' })).toHaveLength(2);
  });

  it('Criar modelo de texto: o aviso, a ajuda dos marcadores, os erros e o POST', async () => {
    const user = userEvent.setup();
    const calls = api({ templates: [] });
    renderRoute({ url: PAGE });
    await clickCreate(user);
    const dialog = screen.getByRole('dialog', { name: 'Novo modelo de texto' });
    expect(
      within(dialog).getByText(
        'Use só textos seus, sem nomes nem dados de clientes. O modelo pode ir para o site de qualquer casal em que você aplicar.',
      ),
    ).toBeInTheDocument();
    const text = within(dialog).getByRole('textbox', { name: 'Texto' });
    expect(text).toHaveAccessibleDescription(
      'Use {casal}, {data} e {cidade}: o Kore troca pelos dados do casal quando você aplicar.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Criar modelo' }));
    expect(
      within(dialog).getByRole('textbox', { name: 'Nome do modelo' }),
    ).toHaveAccessibleDescription('Dê um nome ao modelo.');
    expect(text).toHaveAccessibleDescription('Escreva o texto do modelo.');
    expect(calls).toEqual([]);

    await user.type(within(dialog).getByRole('textbox', { name: 'Nome do modelo' }), 'Dress code');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Seção' }), 'dress_code');
    expect(text).toHaveAttribute('maxLength', '2000');
    await user.type(text, '  Traje passeio completo.  ');
    await user.click(within(dialog).getByRole('button', { name: 'Criar modelo' }));
    expect(await screen.findByText('Modelo criado.')).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/v1/me/planner-templates',
        body: {
          kind: 'section_content',
          name: 'Dress code',
          content: { text: 'Traje passeio completo.' },
          sectionType: 'dress_code',
        },
      },
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('o texto acima do limite da seção, depois de trocar para o Dress code, não sai (RN04)', async () => {
    const user = userEvent.setup();
    const calls = api({ templates: [] });
    renderRoute({ url: PAGE });
    await clickCreate(user);
    const dialog = screen.getByRole('dialog', { name: 'Novo modelo de texto' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome do modelo' }), 'Traje');
    const text = within(dialog).getByRole('textbox', { name: 'Texto' });
    await user.click(text);
    await user.paste('x'.repeat(2500));
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Seção' }), 'dress_code');
    await user.click(within(dialog).getByRole('button', { name: 'Criar modelo' }));
    expect(text).toHaveAccessibleDescription(
      'O texto passa de 2.000 caracteres. Encurte antes de salvar.',
    );
    expect(text).toBeInvalid();
    expect(calls).toEqual([]);
    // Trocar a Seção limpa o erro do texto (sugestão do Crivo no D8a).
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Seção' }), 'story');
    expect(text).not.toHaveAccessibleDescription(
      'O texto passa de 2.000 caracteres. Encurte antes de salvar.',
    );
    expect(text).toBeValid();
  });

  it('Editar: os dados do modelo, a seção fixa e o PATCH com o Toast "Alterações salvas."', async () => {
    const user = userEvent.setup();
    const calls = api();
    renderRoute({ url: PAGE });
    const table = await screen.findByRole('table');
    await user.click(
      within(table).getByRole('button', { name: 'Editar Nossa história: tom acolhedor' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Editar modelo' });
    expect(within(dialog).getByRole('combobox', { name: 'Seção' })).toBeDisabled();
    const name = within(dialog).getByRole('textbox', { name: 'Nome do modelo' });
    await user.clear(name);
    await user.type(name, 'Tom leve');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: 'PATCH',
        path: '/v1/me/planner-templates/t1',
        body: { name: 'Tom leve', content: { text: STORY.content.text } },
      },
    ]);
  });

  it('FAQ: pelo menos uma pergunta com resposta, Remover e o limite de 30', async () => {
    const user = userEvent.setup();
    const calls = api({ templates: [] });
    renderRoute({ url: `${PAGE}?aba=faq` });
    await clickCreate(user);
    const dialog = screen.getByRole('dialog', { name: 'Novo modelo de FAQ' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome do modelo' }), 'FAQ');
    await user.click(within(dialog).getByRole('button', { name: 'Criar modelo' }));
    expect(
      within(dialog).getByText('Adicione pelo menos uma pergunta com resposta.'),
    ).toBeInTheDocument();

    await user.type(
      within(dialog).getByRole('textbox', { name: 'Pergunta 1' }),
      'Pode levar criança?',
    );
    await user.type(within(dialog).getByRole('textbox', { name: 'Resposta 1' }), 'Pode.');
    await user.click(within(dialog).getByRole('button', { name: 'Adicionar pergunta' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Pergunta 2' }), 'Tem ônibus?');
    await user.click(within(dialog).getByRole('button', { name: 'Criar modelo' }));
    expect(within(dialog).getByRole('textbox', { name: 'Resposta 2' })).toHaveAccessibleDescription(
      'Escreva a resposta.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Remover a pergunta 2' }));
    await user.click(within(dialog).getByRole('button', { name: 'Criar modelo' }));
    expect(await screen.findByText('Modelo criado.')).toBeInTheDocument();
    expect(calls.at(-1)?.body).toEqual({
      kind: 'faq',
      name: 'FAQ',
      content: { questions: [{ question: 'Pode levar criança?', answer: 'Pode.' }] },
    });
  });

  it('FAQ com 30 perguntas: o Adicionar pergunta desabilitado com o motivo', async () => {
    const user = userEvent.setup();
    const questions = Array.from({ length: 30 }, (_, index) => ({
      question: `P${index + 1}`,
      answer: 'R',
    }));
    api({ templates: [{ ...FAQ, content: { questions } }] });
    renderRoute({ url: `${PAGE}?aba=faq` });
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: `Editar ${FAQ.name}` }));
    const dialog = screen.getByRole('dialog', { name: 'Editar modelo' });
    const add = within(dialog).getByRole('button', { name: 'Adicionar pergunta' });
    expect(add).toBeDisabled();
    expect(add).toHaveAccessibleDescription('Um modelo de FAQ pode ter até 30 perguntas.');
  });

  it('Aparência: sem o aviso de cliente, e o POST com os campos do Editor', async () => {
    const user = userEvent.setup();
    const calls = api({ templates: [] });
    renderRoute({ url: `${PAGE}?aba=aparencia` });
    await clickCreate(user);
    const dialog = screen.getByRole('dialog', { name: 'Novo modelo de aparência' });
    expect(within(dialog).queryByText(/Use só textos seus/)).toBeNull();
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome do modelo' }), 'Sálvia');
    await user.click(within(dialog).getByRole('radio', { name: /Sálvia/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Criar modelo' }));
    expect(await screen.findByText('Modelo criado.')).toBeInTheDocument();
    expect(calls.at(-1)?.body).toMatchObject({
      kind: 'appearance',
      name: 'Sálvia',
      content: { starterPaletteKey: 'salvia', primaryColor: '#566C4B' },
    });
  });

  it('a falha ao salvar (e o teto técnico 409 TEMPLATES_LIMIT) mostra o aviso da Voz no Dialog', async () => {
    const user = userEvent.setup();
    api({
      templates: [],
      save: () => apiError({ status: 409, body: { error: 'TEMPLATES_LIMIT' } }),
    });
    renderRoute({ url: PAGE });
    await clickCreate(user);
    const dialog = screen.getByRole('dialog', { name: 'Novo modelo de texto' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome do modelo' }), 'X');
    await user.type(within(dialog).getByRole('textbox', { name: 'Texto' }), 'Y');
    await user.click(within(dialog).getByRole('button', { name: 'Criar modelo' }));
    expect(
      await within(dialog).findByText(
        'Não foi possível salvar agora. Verifique sua conexão e tente de novo.',
      ),
    ).toBeInTheDocument();
  });

  it('Excluir com a confirmação da Voz, o DELETE e o Toast', async () => {
    const user = userEvent.setup();
    const calls = api();
    renderRoute({ url: PAGE });
    const table = await screen.findByRole('table');
    await user.click(
      within(table).getByRole('button', { name: 'Excluir Nossa história: tom acolhedor' }),
    );
    const dialog = screen.getByRole('alertdialog', {
      name: 'Excluir o modelo "Nossa história: tom acolhedor"?',
    });
    expect(dialog).toHaveAccessibleDescription(
      'Os sites em que você já aplicou este modelo não mudam. Não dá para desfazer.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Excluir modelo' }));
    expect(await screen.findByText('Modelo excluído.')).toBeInTheDocument();
    expect(calls).toEqual([
      { method: 'DELETE', path: '/v1/me/planner-templates/t1', body: undefined },
    ]);
  });
});
