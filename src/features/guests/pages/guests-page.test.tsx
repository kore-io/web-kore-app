import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderAreaScreen, renderRoute } from '../../../../tests/render-route';
import { intersect } from '../../../../tests/setup';
import type { PartyListItemResponse, PartyListResponse } from '../../../shared/api/generated/model';

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

function party(
  id: string,
  name: string,
  overrides: Partial<PartyListItemResponse> = {},
): PartyListItemResponse {
  return {
    id,
    name,
    contact: { guestId: `${id}-g`, name: 'Célia Moreira', phoneMasked: '(19) 9****-3310' },
    firstGuestName: 'Célia Moreira',
    people: 3,
    counts: { confirmed: 3, declined: 0, pending: 0, pendingPlusOnes: 0 },
    deliveryStatus: 'not_sent',
    respondedAt: null,
    respondedBy: null,
    lastResponse: null,
    tags: [],
    ...overrides,
  };
}

const summary = {
  guests: 142,
  namedGuests: 140,
  parties: 58,
  confirmed: 96,
  declined: 18,
  pending: 28,
};

function page(
  data: PartyListItemResponse[],
  extra: Partial<PartyListResponse> = {},
): PartyListResponse {
  return { summary, total: 58, data, nextCursor: null, ...extra };
}

/** Responde o /me e a lista; devolve os caminhos pedidos da lista. */
let applied: unknown[] = [];

function mockList(
  respond: (path: string) => Response,
  tags: unknown[] = [{ id: 't1', name: 'Família da Ana', color: 'wine', guests: 31 }],
) {
  const listPaths: string[] = [];
  applied = [];
  mockApi(({ path, body }) => {
    if (path === '/v1/me') return Response.json(meFor(me));
    if (path === '/v1/weddings/w1/tags') {
      return Response.json({ limit: 10, data: tags });
    }
    if (path === '/v1/weddings/w1/tags/t1/apply') {
      applied.push(body);
      return Response.json({ parties: (body as { partyIds: string[] }).partyIds.length });
    }
    // O resumo do cabeçalho (GuestsLayout) pede uma página de um grupo.
    if (path === '/v1/weddings/w1/parties?limit=1') return respond(path);
    if (path.startsWith('/v1/weddings/w1/parties')) {
      listPaths.push(path);
      return respond(path);
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return listPaths;
}

describe('Convidados › Grupos e convidados (RN13)', () => {
  it('mostra o resumo, a aba, as linhas e o "Mostrando", com o item Convidados ativo', async () => {
    mockList(() =>
      Response.json(
        page([
          party('p1', 'Família Moreira', {
            deliveryStatus: 'responded',
            tags: [{ id: 't1', name: 'Família da Ana', color: 'wine' }],
          }),
          party('p2', 'Carla e Rafael', {
            contact: { guestId: 'g2', name: 'Carla Nunes', phoneMasked: '(11) 9****-8024' },
            counts: { confirmed: 1, declined: 1, pending: 1, pendingPlusOnes: 1 },
          }),
        ]),
      ),
    );
    renderRoute({ url: '/app/convidados' });
    const table = await screen.findByRole('table', { name: 'Grupos e convidados' });
    expect(screen.getByRole('heading', { name: 'Convidados' })).toBeInTheDocument();
    expect(
      screen.getByText('142 convidados em 58 grupos · 96 confirmados, 18 recusados e 28 pendentes'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Convidados' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    const tabs = screen.getByRole('navigation', { name: 'Convidados' });
    const partiesTab = within(tabs).getByRole('link', { name: /^Grupos/ });
    const tagsTab = within(tabs).getByRole('link', { name: /^Tags/ });
    expect(partiesTab).toHaveAttribute('aria-current', 'page');
    // A aba Tags conta as tags do casamento (Tags RN04).
    expect(tagsTab).toHaveTextContent('Tags · 1 de 10');
    expect(tagsTab).not.toHaveAttribute('aria-current');

    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByText('Família Moreira')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('Respondido')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('Família da Ana')).toHaveClass(
      'kore-tag--wine',
    );
    expect(
      within(rows[1] as HTMLElement).getByText('Carla Nunes · (11) 9****-8024'),
    ).toBeInTheDocument();
    expect(
      within(rows[1] as HTMLElement).getByText('1 recusado · 1 vaga pendente'),
    ).toBeInTheDocument();
    expect(screen.getByText('Mostrando 2 de 58 grupos')).toBeInTheDocument();
    // O nome do grupo abre o Painel do grupo (RN13).
    expect(
      within(rows[0] as HTMLElement).getByRole('link', { name: 'Família Moreira' }),
    ).toHaveAttribute('href', '/app/convidados/grupos/p1');
  });

  it('a busca e os filtros vão para a URL e para a API, com a busca esperando a digitação', async () => {
    const user = userEvent.setup();
    const listPaths = mockList(() =>
      Response.json(page([party('p1', 'Família Moreira')], { total: 1 })),
    );
    const { router } = renderRoute({ url: '/app/convidados' });
    await screen.findByRole('table');

    await user.selectOptions(
      screen.getAllByRole('combobox', { name: 'Resposta' })[0] as HTMLElement,
      'pendentes',
    );
    await waitFor(() => expect(listPaths.at(-1)).toBe('/v1/weddings/w1/parties?rsvp=pending'));
    expect(router.state.location.search).toBe('?resposta=pendentes');

    await user.type(screen.getByRole('searchbox', { name: 'Buscar por nome' }), 'celia');
    await waitFor(() =>
      expect(listPaths.at(-1)).toBe('/v1/weddings/w1/parties?q=celia&rsvp=pending'),
    );
    // Uma só busca para "celia", não uma por letra.
    expect(listPaths.filter((path) => path.includes('q='))).toHaveLength(1);
    expect(router.state.location.search).toBe('?q=celia&resposta=pendentes');
  });

  it('abre com os filtros da URL', async () => {
    const listPaths = mockList(() =>
      Response.json(page([party('p1', 'Família Moreira')], { total: 1 })),
    );
    renderRoute({ url: '/app/convidados?envio=nao-enviado&resposta=x' });
    await screen.findByRole('table');
    expect(listPaths[0]).toBe('/v1/weddings/w1/parties?sent=not_sent');
    expect(screen.getAllByRole('combobox', { name: 'Envio' })[0]).toHaveValue('nao-enviado');
    expect(screen.getAllByRole('combobox', { name: 'Resposta' })[0]).toHaveValue('');
  });

  it('com ?ordem=respondido, a lista pede a ordem de Respondido em (Central RN05; decisão 246)', async () => {
    const listPaths = mockList(() =>
      Response.json(page([party('p1', 'Família Moreira')], { total: 1 })),
    );
    renderRoute({ url: '/app/convidados?ordem=respondido' });
    await screen.findByRole('table');
    expect(listPaths[0]).toBe('/v1/weddings/w1/parties?order=respondedAt');
  });

  it('a ordem não é filtro: sem grupos, o vazio de quem não cadastrou (tipo 3)', async () => {
    mockList(() =>
      Response.json(
        page([], { total: 0, summary: { ...summary, guests: 0, parties: 0, namedGuests: 0 } }),
      ),
    );
    renderRoute({ url: '/app/convidados?ordem=respondido' });
    expect(await screen.findByText('Vocês ainda não cadastraram convidados.')).toBeInTheDocument();
  });

  it('o filtro de Tag vai para a URL pelo id e para a API (Tags RN09)', async () => {
    const user = userEvent.setup();
    const listPaths = mockList(() =>
      Response.json(page([party('p1', 'Família Moreira')], { total: 1 })),
    );
    const { router } = renderRoute({ url: '/app/convidados' });
    await screen.findByRole('table');
    const select = screen.getAllByRole('combobox', { name: 'Tag' })[0] as HTMLElement;
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Tag: todas', 'Tag: Família da Ana']);
    await user.selectOptions(select, 't1');
    await waitFor(() => expect(listPaths.at(-1)).toBe('/v1/weddings/w1/parties?tag=t1'));
    expect(router.state.location.search).toBe('?tag=t1');
  });

  it('tag da URL que não existe mais é ignorada, sem 400 da API', async () => {
    const listPaths = mockList(() =>
      Response.json(page([party('p1', 'Família Moreira')], { total: 1 })),
    );
    renderRoute({ url: '/app/convidados?tag=apagada&resposta=pendentes' });
    await screen.findByRole('table');
    expect(listPaths).toEqual(['/v1/weddings/w1/parties?rsvp=pending']);
  });

  it('a folha do celular tem o Select de Tag e o "Filtros (n)" conta a tag', async () => {
    const user = userEvent.setup();
    mockList(() => Response.json(page([party('p1', 'Família Moreira')], { total: 1 })));
    renderRoute({ url: '/app/convidados?tag=t1&envio=enviado' });
    await user.click(await screen.findByRole('button', { name: 'Filtros (2)' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtros' });
    expect(within(sheet).getByRole('combobox', { name: 'Tag' })).toHaveValue('t1');
  });

  it('a folha de Filtros do celular só aplica no Mostrar resultados, e o Limpar tira tudo', async () => {
    const user = userEvent.setup();
    const listPaths = mockList(() =>
      Response.json(page([party('p1', 'Família Moreira')], { total: 1 })),
    );
    const { router } = renderRoute({ url: '/app/convidados' });
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtros' });
    await user.selectOptions(within(sheet).getByRole('combobox', { name: 'Envio' }), 'respondido');
    expect(router.state.location.search).toBe('');
    await user.click(within(sheet).getByRole('button', { name: 'Mostrar resultados' }));
    expect(sheet).not.toHaveAttribute('open');
    await waitFor(() => expect(listPaths.at(-1)).toBe('/v1/weddings/w1/parties?sent=responded'));

    // Com o filtro ativo, o botão conta (200(c)).
    await user.click(screen.getByRole('button', { name: 'Filtros (1)' }));
    await user.click(within(sheet).getByRole('button', { name: 'Limpar' }));
    expect(await screen.findByRole('button', { name: 'Filtros' })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('a seleção conta os grupos e o "marcar todos" fica parcial, depois marca todos', async () => {
    const user = userEvent.setup();
    mockList(() => Response.json(page([party('p1', 'Família Moreira'), party('p2', 'Tio Jorge')])));
    renderRoute({ url: '/app/convidados' });
    await screen.findByRole('table');
    const selectAll = screen.getByRole<HTMLInputElement>('checkbox', {
      name: 'Selecionar todos os grupos',
    });

    await user.click(screen.getByRole('checkbox', { name: 'Selecionar Tio Jorge' }));
    expect(screen.getByRole('status')).toHaveTextContent('1 grupo selecionado');
    expect(selectAll).toBePartiallyChecked();

    await user.click(selectAll);
    expect(screen.getByRole('status')).toHaveTextContent('2 grupos selecionados');
    expect(selectAll).toBeChecked();
    await user.click(selectAll);
    expect(screen.queryByText(/selecionad/)).toBeNull();
  });

  it('Lembrar pendentes leva os marcados à aba do lembrete (Envios RN04; Penpot A9)', async () => {
    const user = userEvent.setup();
    window.sessionStorage.clear();
    mockList(() => Response.json(page([party('p1', 'Família Moreira'), party('p2', 'Tio Jorge')])));
    const { router } = renderRoute({ url: '/app/convidados' });
    await screen.findByRole('table');
    await user.click(screen.getByRole('checkbox', { name: 'Selecionar Tio Jorge' }));
    await user.click(screen.getByRole('button', { name: 'Lembrar pendentes' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/envios/lembrete'));
    expect(
      JSON.parse(window.sessionStorage.getItem('kore.deliveries.w1.reminder') ?? '{}').ids,
    ).toEqual(['p2']);
  });

  it('Adicionar tag a 1 grupo: o Toast no singular "Tag aplicada a 1 grupo." (Tags RN08)', async () => {
    const user = userEvent.setup();
    mockList(() => Response.json(page([party('p1', 'Família Moreira'), party('p2', 'Tio Jorge')])));
    renderRoute({ url: '/app/convidados' });
    await screen.findByRole('table');
    await user.click(screen.getByRole('checkbox', { name: 'Selecionar Tio Jorge' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar tag' }));
    await user.click(screen.getByRole('menuitem', { name: 'Família da Ana' }));
    expect(await screen.findByText('Tag aplicada a 1 grupo.')).toBeInTheDocument();
    expect(applied).toEqual([{ partyIds: ['p2'] }]);
  });

  it('Adicionar tag aplica a tag escolhida aos grupos marcados e desfaz a seleção (Tags RN08)', async () => {
    const user = userEvent.setup();
    mockList(() => Response.json(page([party('p1', 'Família Moreira'), party('p2', 'Tio Jorge')])));
    renderRoute({ url: '/app/convidados' });
    await screen.findByRole('table');
    await user.click(screen.getByRole('checkbox', { name: 'Selecionar todos os grupos' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar tag' }));
    const item = screen.getByRole('menuitem', { name: 'Família da Ana' });
    expect(item.querySelector('.kore-tag--wine')).not.toBeNull();
    await user.click(item);
    expect(await screen.findByText('Tag aplicada a 2 grupos.')).toBeInTheDocument();
    expect(applied).toEqual([{ partyIds: ['p1', 'p2'] }]);
    await waitFor(() => expect(screen.queryByText(/selecionad/)).toBeNull());
  });

  it('com mais de 200 grupos marcados, o Adicionar tag fica desabilitado com o aviso (decisão 206)', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 201 }, (_, index) => party(`p${index}`, `Grupo ${index}`));
    mockList(() => Response.json(page(many, { total: 201 })));
    renderRoute({ url: '/app/convidados' });
    await screen.findByRole('table');
    await user.click(screen.getByLabelText('Selecionar todos os grupos'));
    const button = screen.getByRole('button', { name: 'Adicionar tag' });
    expect(button).toBeDisabled();
    // O Mover para a lixeira também (206 ampliada), com o mesmo aviso.
    const trash = screen.getByRole('button', { name: 'Mover para a lixeira' });
    expect(trash).toBeDisabled();
    expect(trash).toHaveAccessibleDescription(
      'Marquem até 200 grupos para adicionar uma tag ou mover para a lixeira.',
    );
    expect(button).toHaveAccessibleDescription(
      'Marquem até 200 grupos para adicionar uma tag ou mover para a lixeira.',
    );
    await user.click(screen.getByLabelText('Selecionar Grupo 0'));
    expect(screen.getByRole('button', { name: 'Adicionar tag' })).toBeEnabled();
    expect(
      screen.queryByText('Marquem até 200 grupos para adicionar uma tag ou mover para a lixeira.'),
    ).toBeNull();
  });

  it('cerimonialista: o aviso dos 200 no singular, nas Tags e na Lixeira (decisões 198(2) e 206)', async () => {
    profileUnderTest.current = 'planner';
    const user = userEvent.setup();
    const many = Array.from({ length: 201 }, (_, index) => party(`p${index}`, `Grupo ${index}`));
    mockList(() => Response.json(page(many, { total: 201 })));
    renderAreaScreen({ url: '/app/convidados' });
    await screen.findByRole('table');
    await user.click(screen.getByLabelText('Selecionar todos os grupos'));
    // O mesmo aviso nos dois botões: o das Tags e o da Lixeira (206 ampliada).
    for (const name of ['Adicionar tag', 'Mover para a lixeira']) {
      expect(screen.getByRole('button', { name })).toHaveAccessibleDescription(
        'Marque até 200 grupos para adicionar uma tag ou mover para a lixeira.',
      );
    }
  });

  it('sem nenhuma tag, o Adicionar tag fica desabilitado', async () => {
    const user = userEvent.setup();
    mockList(() => Response.json(page([party('p1', 'Família Moreira')])), []);
    renderRoute({ url: '/app/convidados' });
    await screen.findByRole('table');
    await user.click(screen.getByRole('checkbox', { name: 'Selecionar Família Moreira' }));
    expect(screen.getByRole('button', { name: 'Adicionar tag' })).toBeDisabled();
  });

  it('rolagem infinita: no fim da lista, pede a página seguinte pelo cursor (decisão 197)', async () => {
    const listPaths = mockList((path) =>
      path.includes('cursor=c1')
        ? Response.json(page([party('p2', 'Tio Jorge')], { total: 2 }))
        : Response.json(page([party('p1', 'Família Moreira')], { total: 2, nextCursor: 'c1' })),
    );
    renderRoute({ url: '/app/convidados' });
    await screen.findByText('Mostrando 1 de 2 grupos');
    intersect();
    await screen.findByText('Mostrando 2 de 2 grupos');
    expect(listPaths).toEqual(['/v1/weddings/w1/parties', '/v1/weddings/w1/parties?cursor=c1']);
    expect(screen.getByText('Tio Jorge')).toBeInTheDocument();
  });

  it('se a próxima página falha, o Tentar de novo embaixo pede de novo (decisão 200(d))', async () => {
    const user = userEvent.setup();
    let failNext = true;
    mockList((path) => {
      if (!path.includes('cursor=c1')) {
        return Response.json(
          page([party('p1', 'Família Moreira')], { total: 2, nextCursor: 'c1' }),
        );
      }
      return failNext
        ? apiError({ status: 500, body: {} })
        : Response.json(page([party('p2', 'Tio Jorge')], { total: 2 }));
    });
    renderRoute({ url: '/app/convidados' });
    await screen.findByText('Mostrando 1 de 2 grupos');
    intersect();
    const retry = await screen.findByRole('button', { name: 'Tentar de novo' });
    // A lista que já veio continua na tela.
    expect(screen.getByText('Família Moreira')).toBeInTheDocument();
    failNext = false;
    await user.click(retry);
    await screen.findByText('Mostrando 2 de 2 grupos');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
  });

  it('enquanto a lista carrega, o Spinner diz "Carregando os grupos" (200(b))', async () => {
    mockApi(({ path }) =>
      path === '/v1/me'
        ? Response.json(meFor(me))
        : new Promise<Response>(() => {
            // A lista não responde: fica carregando.
          }),
    );
    renderRoute({ url: '/app/convidados' });
    expect(await screen.findByRole('status')).toHaveTextContent('Carregando os grupos');
  });

  it('no celular, o botão diz quantos filtros estão ativos, sem contar a busca (200(c))', async () => {
    mockList(() => Response.json(page([party('p1', 'Família Moreira')], { total: 1 })));
    renderRoute({ url: '/app/convidados?q=celia&resposta=pendentes&envio=enviado' });
    expect(await screen.findByRole('button', { name: 'Filtros (2)' })).toBeInTheDocument();
  });

  it('sem filtro ativo, o botão é só "Filtros"', async () => {
    mockList(() => Response.json(page([party('p1', 'Família Moreira')], { total: 1 })));
    renderRoute({ url: '/app/convidados?q=celia' });
    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: 'Filtros' })).toBeInTheDocument();
  });

  it('sem grupo nenhum, o vazio do casal; com filtro sem resultado, o "Nenhum grupo encontrado." (198)', async () => {
    mockList((path) =>
      Response.json(
        page([], {
          total: 0,
          summary: path.includes('q=')
            ? summary
            : {
                ...summary,
                guests: 0,
                namedGuests: 0,
                parties: 0,
                confirmed: 0,
                declined: 0,
                pending: 0,
              },
        }),
      ),
    );
    renderRoute({ url: '/app/convidados' });
    expect(await screen.findByText('Vocês ainda não cadastraram convidados.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();

    renderRoute({ url: '/app/convidados?q=zz' });
    expect(await screen.findByText('Nenhum grupo encontrado.')).toBeInTheDocument();
  });

  it('se a lista não carrega, o aviso com o Tentar de novo (decisão 164)', async () => {
    const user = userEvent.setup();
    let fail = true;
    mockList(() =>
      fail
        ? apiError({ status: 500, body: {} })
        : Response.json(page([party('p1', 'Família Moreira')])),
    );
    renderRoute({ url: '/app/convidados' });
    const retry = await screen.findByRole('button', { name: 'Tentar de novo' });
    fail = false;
    await user.click(retry);
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('é acessível', async () => {
    mockList(() =>
      Response.json(
        page([
          party('p1', 'Família Moreira', {
            deliveryStatus: 'viewed',
            tags: [{ id: 't', name: 'Igreja', color: null }],
          }),
        ]),
      ),
    );
    const { container } = renderRoute({ url: '/app/convidados' });
    await screen.findByRole('table');
    await expectNoA11yViolations({ container });
  });
});
