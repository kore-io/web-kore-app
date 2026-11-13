import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import {
  apiError,
  mockApi,
  renderAreaScreen,
  renderRoute,
  isLayoutRead,
  layoutReadNotFound,
} from '../../../../tests/render-route';
import type { TagResponse } from '../../../shared/api/generated/model';

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

const igreja: TagResponse = { id: 't6', name: 'Igreja', color: null, guests: 16 };
const seis: TagResponse[] = [
  { id: 't1', name: 'Família da Ana', color: 'wine', guests: 31 },
  { id: 't2', name: 'Família do Marcos', color: 'blue', guests: 28 },
  { id: 't3', name: 'Padrinhos', color: 'champagne', guests: 1 },
  { id: 't4', name: 'Trabalho da Ana', color: 'green', guests: 18 },
  { id: 't5', name: 'Amigos da faculdade', color: 'amber', guests: 0 },
  igreja,
];

type Call = { method: string; path: string; body: unknown };

/** Responde o /me, o resumo, as tags e as gravações; guarda as gravações. */
function mockTags({
  tags = seis,
  write,
}: { tags?: TagResponse[]; write?: (call: Call) => Response | undefined } = {}) {
  const calls: Call[] = [];
  let current = [...tags];
  mockApi((call) => {
    const { method, path, body } = call;
    if (path === '/v1/me') return Response.json(meFor(me));
    if (path === '/v1/weddings/w1/parties?limit=1') {
      return Response.json({
        summary: {
          guests: 142,
          namedGuests: 140,
          parties: 58,
          confirmed: 96,
          declined: 18,
          pending: 28,
        },
        total: 58,
        data: [],
        nextCursor: null,
      });
    }
    if (method === 'GET' && path === '/v1/weddings/w1/tags')
      return Response.json({ limit: 10, data: current });
    // O layout lê o site e o contador do sino: não são chamadas da tela.
    if (isLayoutRead(call)) return layoutReadNotFound();
    calls.push(call);
    const custom = write?.(call);
    if (custom) return custom;
    if (method === 'POST' && path === '/v1/weddings/w1/tags') {
      const created = { id: 'new', name: (body as { name: string }).name, color: null, guests: 0 };
      current = [...current, created];
      return Response.json(created, { status: 201 });
    }
    if (method === 'PATCH' && path === '/v1/weddings/w1/tags/t6') {
      current = current.map((tag) => (tag.id === 't6' ? { ...tag, ...(body as object) } : tag));
      return Response.json(current.find((tag) => tag.id === 't6'));
    }
    if (method === 'DELETE' && path === '/v1/weddings/w1/tags/t6') {
      current = current.filter((tag) => tag.id !== 't6');
      return new Response(null, { status: 204 });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

async function openEdit(user: ReturnType<typeof userEvent.setup>, name: string) {
  const item = (await screen.findByText(name)).closest('li') as HTMLElement;
  await user.click(within(item).getByRole('button', { name: 'Editar' }));
  return screen.getByRole('dialog', { name: 'Editar tag' });
}

describe('Convidados › Tags (Tags dos convidados)', () => {
  it('mostra o contador, as tags com a contagem e a legenda do casal (RN04, RN05)', async () => {
    mockTags();
    renderRoute({ url: '/app/convidados/tags' });
    expect(await screen.findByRole('heading', { name: '6 de 10 tags' })).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Convidados' });
    expect(within(tabs).getByRole('link', { current: 'page' })).toHaveTextContent('Tags · 6 de 10');
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(within(items[0] as HTMLElement).getByText('Família da Ana')).toHaveClass(
      'kore-tag--wine',
    );
    expect(within(items[0] as HTMLElement).getByText('31 convidados')).toBeInTheDocument();
    expect(within(items[2] as HTMLElement).getByText('1 convidado')).toBeInTheDocument();
    // Com 0, o plural (em pt-BR o Intl põe o 0 no singular).
    expect(within(items[4] as HTMLElement).getByText('0 convidados')).toBeInTheDocument();
    // Cada Editar fica ligado ao nome da sua tag para o leitor de tela.
    expect(
      within(items[5] as HTMLElement).getByRole('button', { name: 'Editar' }),
    ).toHaveAccessibleDescription('Igreja');
    expect(
      screen.getByText('Um convidado pode ter várias tags. Vocês podem criar até 10.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('142 convidados em 58 grupos · 96 confirmados, 18 recusados e 28 pendentes'),
    ).toBeInTheDocument();
  });

  it('cria uma tag pelo nome, sem espaços nas pontas', async () => {
    const user = userEvent.setup();
    const calls = mockTags();
    renderRoute({ url: '/app/convidados/tags' });
    const field = await screen.findByRole('textbox', { name: 'Nome da tag nova' });
    expect(screen.getByRole('button', { name: 'Criar tag' })).toBeDisabled();
    await user.type(field, '  Vizinhos  ');
    await user.click(screen.getByRole('button', { name: 'Criar tag' }));
    expect(await screen.findByText('Vizinhos')).toBeInTheDocument();
    expect(calls).toEqual([
      { method: 'POST', path: '/v1/weddings/w1/tags', body: { name: 'Vizinhos' } },
    ]);
    expect(field).toHaveValue('');
    expect(screen.getByRole('heading', { name: '7 de 10 tags' })).toBeInTheDocument();
  });

  it('nome repetido marca o campo com "Já existe uma tag com este nome." (RN02)', async () => {
    const user = userEvent.setup();
    mockTags({
      write: ({ method }) =>
        method === 'POST'
          ? apiError({ status: 409, body: { error: 'TAG_NAME_TAKEN' } })
          : undefined,
    });
    renderRoute({ url: '/app/convidados/tags' });
    const field = await screen.findByRole('textbox', { name: 'Nome da tag nova' });
    await user.type(field, 'igreja');
    await user.click(screen.getByRole('button', { name: 'Criar tag' }));
    expect(await screen.findByText('Já existe uma tag com este nome.')).toBeInTheDocument();
    expect(field).toHaveAccessibleDescription('Já existe uma tag com este nome.');
  });

  it('com 10 tags, o Criar tag fica desabilitado com o aviso do casal (RN01)', async () => {
    const dez = Array.from({ length: 10 }, (_, index) => ({
      id: `t${index}`,
      name: `Tag ${index}`,
      color: null,
      guests: 0,
    }));
    mockTags({ tags: dez });
    renderRoute({ url: '/app/convidados/tags' });
    expect(
      await screen.findByText('Vocês já têm 10 tags. Excluam uma para criar outra.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nome da tag nova' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Criar tag' })).toBeDisabled();
  });

  it('se a API recusa pelo limite, o mesmo aviso (409 TAG_LIMIT_REACHED)', async () => {
    const user = userEvent.setup();
    mockTags({
      write: ({ method }) =>
        method === 'POST'
          ? apiError({ status: 409, body: { error: 'TAG_LIMIT_REACHED' } })
          : undefined,
    });
    renderRoute({ url: '/app/convidados/tags' });
    await user.type(await screen.findByRole('textbox', { name: 'Nome da tag nova' }), 'Vizinhos');
    await user.click(screen.getByRole('button', { name: 'Criar tag' }));
    expect(
      await screen.findByText('Vocês já têm 10 tags. Excluam uma para criar outra.'),
    ).toBeInTheDocument();
  });

  it('Editar tag troca o nome e a cor e mostra "Alterações salvas." (RN06)', async () => {
    const user = userEvent.setup();
    const calls = mockTags();
    renderRoute({ url: '/app/convidados/tags' });
    const dialog = await openEdit(user, 'Igreja');
    const name = within(dialog).getByRole('textbox', { name: 'Nome da tag' });
    expect(name).toHaveValue('Igreja');
    const colors = within(dialog).getByRole('radiogroup', { name: 'Cor' });
    expect(
      within(colors)
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent),
    ).toEqual(['Sem cor', 'Vinho', 'Champanhe', 'Verde', 'Âmbar', 'Vermelho', 'Azul']);
    expect(within(colors).getByRole('radio', { name: 'Sem cor' })).toBeChecked();
    await user.clear(name);
    await user.type(name, 'Igreja Matriz');
    await user.click(within(colors).getByRole('radio', { name: 'Azul' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: 'PATCH',
        path: '/v1/weddings/w1/tags/t6',
        body: { name: 'Igreja Matriz', color: 'blue' },
      },
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Igreja Matriz')).toHaveClass('kore-tag--blue');
  });

  it('Editar tag sem nome mostra "Deem um nome à tag." e não chama a API (RN02)', async () => {
    const user = userEvent.setup();
    const calls = mockTags();
    renderRoute({ url: '/app/convidados/tags' });
    const dialog = await openEdit(user, 'Igreja');
    await user.clear(within(dialog).getByRole('textbox', { name: 'Nome da tag' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));
    expect(within(dialog).getByText('Deem um nome à tag.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('Excluir tag pede confirmação e manda para a lixeira com o Toast (RN06)', async () => {
    const user = userEvent.setup();
    const calls = mockTags();
    renderRoute({ url: '/app/convidados/tags' });
    const dialog = await openEdit(user, 'Igreja');
    await user.click(within(dialog).getByRole('button', { name: 'Excluir tag' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Excluir a tag Igreja?' });
    expect(confirm).toHaveAccessibleDescription(
      'A tag sai dos grupos e dos convidados e fica 30 dias na lixeira. Depois, é apagada de vez.',
    );
    await user.click(within(confirm).getByRole('button', { name: 'Excluir tag' }));
    expect(await screen.findByText('A tag Igreja foi para a lixeira.')).toBeInTheDocument();
    expect(calls).toEqual([{ method: 'DELETE', path: '/v1/weddings/w1/tags/t6', body: undefined }]);
    expect(await screen.findByRole('heading', { name: '5 de 10 tags' })).toBeInTheDocument();
  });

  it('depois de excluir, o foco vai para o campo "Nome da tag nova" (a linha sumiu)', async () => {
    const user = userEvent.setup();
    mockTags();
    renderRoute({ url: '/app/convidados/tags' });
    const dialog = await openEdit(user, 'Igreja');
    await user.click(within(dialog).getByRole('button', { name: 'Excluir tag' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir tag' }),
    );
    await screen.findByText('A tag Igreja foi para a lixeira.');
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Nome da tag nova' })).toHaveFocus(),
    );
  });

  it('com 10 tags, depois de excluir, o foco vai ao campo quando ele volta a habilitar', async () => {
    const user = userEvent.setup();
    const nove = Array.from({ length: 9 }, (_, index) => ({
      id: `t${index}`,
      name: `Tag ${index}`,
      color: null,
      guests: 0,
    }));
    mockTags({ tags: [...nove, igreja] });
    renderRoute({ url: '/app/convidados/tags' });
    expect(await screen.findByRole('textbox', { name: 'Nome da tag nova' })).toBeDisabled();
    const dialog = await openEdit(user, 'Igreja');
    await user.click(within(dialog).getByRole('button', { name: 'Excluir tag' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir tag' }),
    );
    const field = screen.getByRole('textbox', { name: 'Nome da tag nova' });
    await waitFor(() => expect(field).toBeEnabled());
    await waitFor(() => expect(field).toHaveFocus());
  });

  it('enquanto carrega, o Spinner diz "Carregando as tags"', async () => {
    mockApi(({ path }) =>
      path === '/v1/me'
        ? Response.json(meFor(me))
        : new Promise<Response>(() => {
            // Nada responde: fica carregando.
          }),
    );
    renderRoute({ url: '/app/convidados/tags' });
    expect(await screen.findByRole('status')).toHaveTextContent('Carregando as tags');
  });

  it('Cancelar no Excluir não apaga', async () => {
    const user = userEvent.setup();
    const calls = mockTags();
    renderRoute({ url: '/app/convidados/tags' });
    const dialog = await openEdit(user, 'Igreja');
    await user.click(within(dialog).getByRole('button', { name: 'Excluir tag' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }),
    );
    expect(calls).toHaveLength(0);
    expect(screen.getByText('Igreja')).toBeInTheDocument();
  });

  it('Editar tag com um nome que já existe: o 409 TAG_NAME_TAKEN marca o campo (RN02)', async () => {
    const user = userEvent.setup();
    mockTags({
      write: ({ method }) =>
        method === 'PATCH'
          ? apiError({ status: 409, body: { error: 'TAG_NAME_TAKEN' } })
          : undefined,
    });
    renderRoute({ url: '/app/convidados/tags' });
    const dialog = await openEdit(user, 'Igreja');
    const name = within(dialog).getByRole('textbox', { name: 'Nome da tag' });
    await user.clear(name);
    await user.type(name, 'Padrinhos');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() =>
      expect(name).toHaveAccessibleDescription('Já existe uma tag com este nome.'),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  describe('versão da cerimonialista (decisão 198(2))', () => {
    it('a legenda e o aviso das 10 tags no singular (RN01, RN04)', async () => {
      profileUnderTest.current = 'planner';
      const dez = Array.from({ length: 10 }, (_, index) => ({
        id: `t${index}`,
        name: `Tag ${index}`,
        color: null,
        guests: 0,
      }));
      mockTags({ tags: dez });
      renderAreaScreen({ url: '/app/convidados/tags' });
      expect(
        await screen.findByText('Este casamento já tem 10 tags. Exclua uma para criar outra.'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Um convidado pode ter várias tags. Este casamento pode ter até 10.'),
      ).toBeInTheDocument();
    });

    it('Editar tag sem nome: "Dê um nome à tag." (RN02)', async () => {
      profileUnderTest.current = 'planner';
      const user = userEvent.setup();
      const calls = mockTags();
      renderAreaScreen({ url: '/app/convidados/tags' });
      const dialog = await openEdit(user, 'Igreja');
      await user.clear(within(dialog).getByRole('textbox', { name: 'Nome da tag' }));
      await user.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));
      expect(within(dialog).getByText('Dê um nome à tag.')).toBeInTheDocument();
      expect(calls).toHaveLength(0);
    });
  });

  it('é acessível, com o Editar tag aberto', async () => {
    const user = userEvent.setup();
    mockTags();
    renderRoute({ url: '/app/convidados/tags' });
    await screen.findByRole('heading', { name: '6 de 10 tags' });
    await expectNoA11yViolations({ container: document.body });
    await openEdit(user, 'Igreja');
    await expectNoA11yViolations({ container: document.body, disabledRules: ['region'] });
  });
});
