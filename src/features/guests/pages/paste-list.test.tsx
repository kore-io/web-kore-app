import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderAreaScreen, renderRoute } from '../../../../tests/render-route';
import type { PastePreviewResponse } from '../../../shared/api/generated/model';

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

const LIST =
  'Família Moreira: Jorge, Célia, Pedro\nCarla Nunes + 2 filhos\nRafael e Bianca\nMárcia Rocha';

const example: PastePreviewResponse = {
  groups: [
    {
      line: 1,
      source: 'Família Moreira: Jorge, Célia, Pedro',
      name: 'Família Moreira',
      guests: [{ name: 'Jorge' }, { name: 'Célia' }, { name: 'Pedro' }],
      warnings: [],
      duplicatesRemoved: 0,
    },
    {
      line: 2,
      source: 'Carla Nunes + 2 filhos',
      name: 'Carla Nunes',
      guests: [{ name: 'Carla Nunes' }, { name: null }, { name: null }],
      warnings: [],
      duplicatesRemoved: 0,
    },
    {
      line: 3,
      source: 'Rafael e Bianca',
      name: 'Rafael e Bianca',
      guests: [{ name: 'Rafael' }, { name: 'Bianca' }],
      warnings: [],
      duplicatesRemoved: 0,
    },
    {
      line: 4,
      source: 'Márcia Rocha',
      name: 'Márcia Rocha',
      guests: [{ name: 'Márcia Rocha' }],
      warnings: [],
      duplicatesRemoved: 0,
    },
  ],
  droppedLines: [],
  parties: 4,
  guests: 9,
  missingNames: 2,
};

type Call = { method: string; path: string; body: unknown };

function mockPaste({
  previewResponse = () => Response.json(example),
  importResponse = () => Response.json({ parties: 4, guests: 9 }, { status: 201 }),
}: { previewResponse?: () => Response; importResponse?: () => Response } = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path, body }) => {
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
    calls.push({ method, path, body });
    if (path === '/v1/weddings/w1/guest-imports/paste/preview') return previewResponse();
    if (path === '/v1/weddings/w1/guest-imports/paste') return importResponse();
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

async function openPaste(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Colar a lista' }));
  return screen.getByRole('textbox', { name: 'Colar a lista' });
}

async function pasteAndContinue(user: ReturnType<typeof userEvent.setup>, text = LIST) {
  const field = await openPaste(user);
  await user.click(field);
  await user.paste(text);
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findByText('da lista colada');
}

const card = (source: string) => screen.getByRole('region', { name: source });

describe('Convidados › Colar a lista (Importação RN10 a RN12)', () => {
  it('o texto: a frase do casal, o exemplo, o Continuar só com texto e o Voltar, que guarda o texto', async () => {
    const user = userEvent.setup();
    mockPaste();
    renderRoute({ url: '/app/convidados/importar' });
    const field = await openPaste(user);
    expect(
      screen.getByText('Uma linha por grupo. Podem colar do jeito que está na planilha.'),
    ).toBeInTheDocument();
    expect(field).toHaveAttribute('placeholder', LIST.replace('Jorge', 'Luiz'));
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await user.type(field, 'Márcia Rocha');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('heading', { name: '1. Baixar o modelo' })).toBeInTheDocument();
    expect(await openPaste(user)).toHaveValue('Márcia Rocha');
  });

  it('a lista do exemplo: 4 grupos, 9 convidados, 2 nomes faltando num grupo; importa com os nomes', async () => {
    const user = userEvent.setup();
    const calls = mockPaste();
    const { router } = renderRoute({ url: '/app/convidados/importar' });
    await pasteAndContinue(user);
    expect(calls[0]).toEqual({
      method: 'POST',
      path: '/v1/weddings/w1/guest-imports/paste/preview',
      body: { text: LIST },
    });
    expect(screen.getAllByText(/^[0-9]+$/).map((node) => node.textContent)).toEqual([
      '4',
      '9',
      '2',
    ]);
    expect(screen.getByText('num grupo')).toBeInTheDocument();
    const carla = card('Carla Nunes + 2 filhos');
    expect(
      within(carla).getByText('Qual é o nome de cada pessoa deste grupo?'),
    ).toBeInTheDocument();
    expect(
      within(card('Rafael e Bianca')).queryByText('Qual é o nome de cada pessoa deste grupo?'),
    ).toBeNull();
    expect(
      within(card('Rafael e Bianca')).getByRole('textbox', { name: 'Nome da 1ª pessoa' }),
    ).toHaveValue('Rafael');
    expect(within(carla).getAllByRole('button', { name: 'Remover pessoa' })).toHaveLength(2);
    expect(screen.getByText('4 grupos e 9 convidados serão criados.')).toBeInTheDocument();
    const importButton = screen.getByRole('button', { name: 'Importar 9 convidados' });
    expect(importButton).toBeDisabled();

    await user.type(
      within(carla).getByRole('textbox', { name: 'Nome da 2ª pessoa' }),
      'Lucas Nunes',
    );
    await user.type(within(carla).getByRole('textbox', { name: 'Nome da 3ª pessoa' }), 'Ana Nunes');
    expect(within(carla).queryByRole('button', { name: 'Remover pessoa' })).toBeNull();
    expect(importButton).toBeEnabled();
    await user.click(importButton);
    expect(importButton).toBeDisabled();
    expect(await screen.findByText('4 grupos importados')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/convidados'));
    expect(calls[1]?.body).toEqual({
      removedInPreview: 0,
      groups: [
        { name: 'Família Moreira', guests: ['Jorge', 'Célia', 'Pedro'] },
        { name: 'Carla Nunes', guests: ['Carla Nunes', 'Lucas Nunes', 'Ana Nunes'] },
        { name: 'Rafael e Bianca', guests: ['Rafael', 'Bianca'] },
        { name: 'Márcia Rocha', guests: ['Márcia Rocha'] },
      ],
    });
  });

  it('Remover pessoa: o botão vira "Importar 8 convidados" e o removedInPreview conta 1', async () => {
    const user = userEvent.setup();
    const calls = mockPaste();
    renderRoute({ url: '/app/convidados/importar' });
    await pasteAndContinue(user);
    const carla = card('Carla Nunes + 2 filhos');
    const [, third] = within(carla).getAllByRole('button', { name: 'Remover pessoa' });
    await user.click(third as HTMLElement);
    await user.type(
      within(carla).getByRole('textbox', { name: 'Nome da 2ª pessoa' }),
      'Lucas Nunes',
    );
    await user.click(screen.getByRole('button', { name: 'Importar 8 convidados' }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect((calls[1]?.body as { removedInPreview: number }).removedInPreview).toBe(1);
  });

  it('os avisos do grupo, o nome repetido que o casal digita e o nome de grupo longo', async () => {
    const user = userEvent.setup();
    const long = 'G'.repeat(81);
    mockPaste({
      previewResponse: () =>
        Response.json({
          ...example,
          groups: [
            {
              line: 1,
              source: 'Família Moreira: Jorge, jorge, Célia',
              name: 'Família Moreira',
              guests: [{ name: 'Jorge' }, { name: 'Célia' }],
              warnings: ['PARTY_NAME_EXISTS', 'DUPLICATE_REMOVED'],
              duplicatesRemoved: 0,
            },
            {
              line: 2,
              source: 'Carla Nunes + 99',
              name: 'Carla Nunes',
              guests: [{ name: 'Carla Nunes' }],
              warnings: ['PLUS_OUT_OF_RANGE'],
              duplicatesRemoved: 0,
            },
            {
              line: 3,
              source: `${long}: Ana`,
              name: long,
              guests: [{ name: 'Ana' }],
              warnings: ['TOO_LONG'],
              duplicatesRemoved: 0,
            },
          ],
        }),
    });
    renderRoute({ url: '/app/convidados/importar' });
    await pasteAndContinue(user);
    const moreira = card('Família Moreira: Jorge, jorge, Célia');
    expect(within(moreira).getByText('Já existe um grupo com este nome.')).toBeInTheDocument();
    expect(
      within(moreira).getByText('Um nome repetido neste grupo ficou de fora.'),
    ).toBeInTheDocument();
    expect(
      within(card('Carla Nunes + 99')).getByText('Usem de + 1 a + 20 por linha.'),
    ).toBeInTheDocument();

    const groupName = within(card(`${long}: Ana`)).getByRole('textbox', { name: 'Nome do grupo' });
    expect(groupName).toHaveAccessibleDescription('O nome passa de 80 caracteres.');
    const importButton = screen.getByRole('button', { name: 'Importar 4 convidados' });
    expect(importButton).toBeDisabled();
    await user.clear(groupName);
    await user.type(groupName, 'Amigos');
    expect(importButton).toBeEnabled();

    const second = within(moreira).getByRole('textbox', { name: 'Nome da 2ª pessoa' });
    await user.clear(second);
    await user.type(second, 'jorge');
    expect(second).toHaveAccessibleDescription('Este nome já está neste grupo.');
    expect(importButton).toBeDisabled();
  });

  it('Voltar na prévia volta ao texto, sem perdê-lo', async () => {
    const user = userEvent.setup();
    mockPaste();
    renderRoute({ url: '/app/convidados/importar' });
    await pasteAndContinue(user);
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('textbox', { name: 'Colar a lista' })).toHaveValue(LIST);
  });

  it('lista acima de 1.000 convidados mostra o texto do casal', async () => {
    const user = userEvent.setup();
    mockPaste({
      previewResponse: () => apiError({ status: 422, body: { error: 'TOO_MANY_GUESTS' } }),
    });
    renderRoute({ url: '/app/convidados/importar' });
    const field = await openPaste(user);
    await user.type(field, 'Família + 20');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A lista passa de 1.000 convidados. Dividam em duas.',
    );
  });

  it('é acessível, no texto e na prévia', async () => {
    const user = userEvent.setup();
    mockPaste();
    const { container } = renderRoute({ url: '/app/convidados/importar' });
    await openPaste(user);
    await expectNoA11yViolations({ container });
    await user.click(screen.getByRole('textbox', { name: 'Colar a lista' }));
    await user.paste(LIST);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByText('da lista colada');
    await expectNoA11yViolations({ container });
  });
  describe('versão da cerimonialista (decisão 198(2))', () => {
    it('a frase do texto e o aviso do "+ N" fora de 1 a 20 no singular (RN10)', async () => {
      profileUnderTest.current = 'planner';
      const user = userEvent.setup();
      mockPaste({
        previewResponse: () =>
          Response.json({
            ...example,
            groups: [
              {
                line: 1,
                source: 'Carla Nunes + 99',
                name: 'Carla Nunes',
                guests: [{ name: 'Carla Nunes' }],
                warnings: ['PLUS_OUT_OF_RANGE'],
                duplicatesRemoved: 0,
              },
            ],
          }),
      });
      renderAreaScreen({ url: '/app/convidados/importar' });
      await user.click(await screen.findByRole('button', { name: 'Colar a lista' }));
      expect(
        screen.getByText('Uma linha por grupo. Pode colar do jeito que está na planilha.'),
      ).toBeInTheDocument();
      await user.type(screen.getByRole('textbox', { name: 'Colar a lista' }), 'Carla Nunes + 99');
      await user.click(screen.getByRole('button', { name: 'Continuar' }));
      expect(
        within(await screen.findByRole('region', { name: 'Carla Nunes + 99' })).getByText(
          'Use de + 1 a + 20 por linha.',
        ),
      ).toBeInTheDocument();
    });

    it('lista acima de 1.000 convidados: "Divida em duas." (RN10)', async () => {
      profileUnderTest.current = 'planner';
      const user = userEvent.setup();
      mockPaste({
        previewResponse: () => apiError({ status: 422, body: { error: 'TOO_MANY_GUESTS' } }),
      });
      renderAreaScreen({ url: '/app/convidados/importar' });
      await user.click(await screen.findByRole('button', { name: 'Colar a lista' }));
      await user.type(screen.getByRole('textbox', { name: 'Colar a lista' }), 'Família + 20');
      await user.click(screen.getByRole('button', { name: 'Continuar' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'A lista passa de 1.000 convidados. Divida em duas.',
      );
    });
  });
});
