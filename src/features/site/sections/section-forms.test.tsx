import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderAreaScreen, renderRoute } from '../../../../tests/render-route';
import type { SiteEditorResponse, SiteSectionResponse } from '../../../shared/api/generated/model';

vi.mock('../site-fonts', () => ({ loadEditorFonts: vi.fn(async () => undefined) }));

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

const baseSections: SiteSectionResponse[] = [
  {
    type: 'story',
    title: 'Nossa história',
    content: { text: '', images: [] },
    enabled: false,
    empty: true,
  },
  { type: 'countdown', title: null, content: {}, enabled: true, empty: false },
  {
    type: 'ceremony',
    title: 'Cerimônia & Recepção',
    content: { venues: [] },
    enabled: true,
    empty: true,
  },
  {
    type: 'lodging',
    title: 'Hospedagem e transporte',
    content: { text: '' },
    enabled: false,
    empty: true,
  },
  {
    type: 'dress_code',
    title: 'Dress code',
    content: { text: '', image: null },
    enabled: false,
    empty: true,
  },
  {
    type: 'faq',
    title: 'Perguntas frequentes',
    content: { items: [] },
    enabled: false,
    empty: true,
  },
];

function siteWith({
  sections = baseSections,
  eventDate = '2026-11-14',
  editable = { names: true, eventDate: true, state: true, slug: true },
}: {
  sections?: SiteSectionResponse[];
  eventDate?: string | null;
  editable?: Record<string, boolean>;
} = {}) {
  return {
    publishedAt: null,
    siteUpdatedAt: '2026-11-11T13:31:00Z',
    partners: [
      { id: 'pa', title: 'bride', name: 'Ana Beatriz Moreira' },
      { id: 'pm', title: 'groom', name: 'Marcos Vinícius Rocha' },
    ],
    eventDate,
    city: 'Campinas',
    state: 'SP',
    timezone: 'America/Sao_Paulo',
    slug: 'ana-e-marcos',
    contactWhatsapp: null,
    contactEmail: null,
    cover: null,
    appearance: {
      starterPaletteKey: 'terracota',
      fontPairKey: 'romantico',
      primaryColor: '#A94F37',
      accentColor: '#7A8B69',
      backgroundMode: 'cream',
    },
    sections,
    editable,
    status: 'draft',
  } as unknown as SiteEditorResponse;
}

const withSection = (section: SiteSectionResponse) =>
  baseSections.map((item) => (item.type === section.type ? section : item));

type Call = { method: string; path: string; body: Record<string, unknown> };

function mockSite({
  site = siteWith(),
  put,
}: {
  site?: SiteEditorResponse;
  put?: (type: string, body: Record<string, unknown>) => Response;
} = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(meFor(me));
    if (path === '/v1/weddings/w1/site' && method === 'GET') return Response.json(site);
    const match = /^\/v1\/weddings\/w1\/site\/sections\/(\w+)$/.exec(path);
    if (match && method === 'PUT') {
      const data = body as Record<string, unknown>;
      calls.push({ method, path, body: data });
      if (put) return put(match[1] ?? '', data);
      const content = data.content as Record<string, unknown>;
      const empty =
        match[1] === 'faq'
          ? (content.items as unknown[]).length === 0
          : !String(content.text ?? '').trim();
      return Response.json({ type: match[1], ...data, empty });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const save = () => screen.getByRole('button', { name: 'Salvar' });

describe('Site › Seções de conteúdo (S3)', () => {
  it('Hospedagem: o Switch, o título e o texto com o contador do Penpot; liga, escreve e salva (RN08, RN11, RN13)', async () => {
    const user = userEvent.setup();
    const calls = mockSite();
    renderRoute({ url: '/app/site/hospedagem-e-transporte' });
    const show = await screen.findByRole('switch', { name: 'Mostrar a seção no site' });
    expect(show).not.toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Título da seção' })).toHaveValue(
      'Hospedagem e transporte',
    );
    const text = screen.getByRole('textbox', { name: 'Texto' });
    expect(text).toHaveAttribute(
      'placeholder',
      'Ex.: hotéis perto da festa, como chegar, se haverá van',
    );
    expect(text).toHaveAttribute('maxlength', '5000');
    expect(text).toHaveAccessibleDescription('0/5.000');
    // Desligada não mostra o aviso de vazia; ligada e sem texto, mostra (RN03).
    expect(screen.queryByText(/ainda não tem conteúdo/)).not.toBeInTheDocument();
    await user.click(show);
    expect(
      screen.getByText(
        'Esta seção está ligada, mas ainda não tem conteúdo, então não aparece no site. Ela aparece quando for preenchida.',
      ),
    ).toBeInTheDocument();
    await user.type(text, 'Hotel Vitória, a 2 km.');
    expect(screen.queryByText(/ainda não tem conteúdo/)).not.toBeInTheDocument();
    expect(text).toHaveAccessibleDescription('22/5.000');
    await user.click(save());
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: 'PUT',
        path: '/v1/weddings/w1/site/sections/lodging',
        body: {
          enabled: true,
          title: 'Hospedagem e transporte',
          content: { text: 'Hotel Vitória, a 2 km.' },
        },
      },
    ]);
  });

  it('título vazio: "Deem um título à seção." e nada é gravado (RN12)', async () => {
    const user = userEvent.setup();
    const calls = mockSite();
    renderRoute({ url: '/app/site/hospedagem-e-transporte' });
    const title = await screen.findByRole('textbox', { name: 'Título da seção' });
    await user.clear(title);
    await user.click(save());
    expect(title).toHaveAccessibleDescription('Deem um título à seção.');
    expect(title).toBeInvalid();
    expect(calls).toHaveLength(0);
  });

  it('desligar só esconde: o texto fica (RN11)', async () => {
    const user = userEvent.setup();
    const calls = mockSite({
      site: siteWith({
        sections: withSection({
          type: 'lodging',
          title: 'Hospedagem e transporte',
          content: { text: 'Hotel Vitória.' },
          enabled: true,
          empty: false,
        }),
      }),
    });
    renderRoute({ url: '/app/site/hospedagem-e-transporte' });
    await user.click(await screen.findByRole('switch', { name: 'Mostrar a seção no site' }));
    await user.click(save());
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body).toEqual({
      enabled: false,
      title: 'Hospedagem e transporte',
      content: { text: 'Hotel Vitória.' },
    });
  });

  it('Contagem: só o Switch com o apoio; com data, liga e desliga (RN06)', async () => {
    const user = userEvent.setup();
    const calls = mockSite();
    renderRoute({ url: '/app/site/contagem-regressiva' });
    const show = await screen.findByRole('switch', { name: 'Mostrar a contagem no site' });
    expect(show).toBeChecked();
    expect(show).toHaveAccessibleDescription(
      'O site mostra quantos dias faltam, como “Faltam 3 dias”. No dia, mostra “É hoje”. Depois do casamento, a contagem some.',
    );
    expect(screen.queryByRole('textbox', { name: 'Título da seção' })).not.toBeInTheDocument();
    await user.click(show);
    await user.click(save());
    await waitFor(() =>
      expect(calls[0]?.body).toEqual({ enabled: false, title: null, content: {} }),
    );
  });

  it('Contagem sem data: o Switch desabilitado, o motivo e o link Ir para Dados básicos (RN06)', async () => {
    const user = userEvent.setup();
    mockSite({ site: siteWith({ eventDate: null }) });
    renderRoute({ url: '/app/site/contagem-regressiva' });
    expect(
      await screen.findByRole('switch', { name: 'Mostrar a contagem no site' }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Informem a data do casamento em Dados básicos para mostrar a contagem\./),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Ir para Dados básicos' }));
    expect(await screen.findByRole('heading', { name: 'Dados básicos' })).toBeInTheDocument();
  });

  it('Contagem sem data, cerimonialista: o texto dela e sem o link (RN06)', async () => {
    profileUnderTest.current = 'planner';
    mockSite({
      site: siteWith({
        eventDate: null,
        editable: { names: false, eventDate: false, state: false, slug: false },
      }),
    });
    renderAreaScreen({ url: '/app/site/contagem-regressiva' });
    expect(
      await screen.findByText('A contagem aparece quando o casal informar a data do casamento.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ir para Dados básicos' })).not.toBeInTheDocument();
  });

  it('Dress code: texto até 2.000 e a foto de referência; remover a foto manda o imageId nulo (RN09)', async () => {
    const user = userEvent.setup();
    const calls = mockSite({
      site: siteWith({
        sections: withSection({
          type: 'dress_code',
          title: 'Dress code',
          content: {
            text: 'Passeio completo.',
            image: {
              id: 'img1',
              url: 'https://cdn/x.jpg',
              thumbUrl: 'https://cdn/x-t.jpg',
              width: 1,
              height: 1,
            },
          },
          enabled: true,
          empty: false,
        }),
      }),
    });
    renderRoute({ url: '/app/site/dress-code' });
    const text = await screen.findByRole('textbox', { name: 'Texto' });
    expect(text).toHaveAttribute('maxlength', '2000');
    const photo = screen.getByRole('group', { name: 'Foto de referência (opcional)' });
    await user.click(within(photo).getByRole('button', { name: 'Remover foto' }));
    await user.click(save());
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body).toEqual({
      enabled: true,
      title: 'Dress code',
      content: { text: 'Passeio completo.', imageId: null },
    });
  });

  it('FAQ: adicionar, preencher, subir e remover, com os rótulos para o leitor de tela (RN10)', async () => {
    const user = userEvent.setup();
    const calls = mockSite({
      site: siteWith({
        sections: withSection({
          type: 'faq',
          title: 'Perguntas frequentes',
          content: {
            items: [
              { question: 'E se chover?', answer: 'Há área coberta.' },
              { question: 'Qual é o traje?', answer: 'Passeio completo.' },
            ],
          },
          enabled: true,
          empty: false,
        }),
      }),
    });
    renderRoute({ url: '/app/site/faq' });
    expect(await screen.findByRole('button', { name: 'Subir pergunta 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descer pergunta 2' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Subir pergunta 2' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar pergunta' }));
    const questions = screen.getAllByRole('textbox', { name: 'Pergunta' });
    const answers = screen.getAllByRole('textbox', { name: 'Resposta' });
    expect(questions).toHaveLength(3);
    await user.type(questions[2] as HTMLElement, 'Tem estacionamento?');
    await user.type(answers[2] as HTMLElement, 'Sim, com manobrista.');
    await user.click(screen.getByRole('button', { name: 'Remover pergunta 2' }));
    await user.click(save());
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body).toEqual({
      enabled: true,
      title: 'Perguntas frequentes',
      content: {
        items: [
          { question: 'Qual é o traje?', answer: 'Passeio completo.' },
          { question: 'Tem estacionamento?', answer: 'Sim, com manobrista.' },
        ],
      },
    });
  });

  it('FAQ: pergunta sem resposta mostra "Preencham este campo." e nada é gravado (RN12)', async () => {
    const user = userEvent.setup();
    const calls = mockSite();
    renderRoute({ url: '/app/site/faq' });
    await user.click(await screen.findByRole('button', { name: 'Adicionar pergunta' }));
    await user.type(screen.getByRole('textbox', { name: 'Pergunta' }), 'E se chover?');
    await user.click(save());
    expect(screen.getByRole('textbox', { name: 'Resposta' })).toHaveAccessibleDescription(
      'Preencham este campo.',
    );
    expect(calls).toHaveLength(0);
  });

  it('FAQ com 30 perguntas: Adicionar desabilitado com o limite, no texto de cada perfil (RN10)', async () => {
    const items = Array.from({ length: 30 }, (_, index) => ({
      question: `Pergunta ${index + 1}?`,
      answer: 'Sim.',
    }));
    const faq = withSection({
      type: 'faq',
      title: 'Perguntas frequentes',
      content: { items },
      enabled: true,
      empty: false,
    });
    mockSite({ site: siteWith({ sections: faq }) });
    const { unmount } = renderRoute({ url: '/app/site/faq' });
    const add = await screen.findByRole('button', { name: 'Adicionar pergunta' });
    expect(add).toBeDisabled();
    expect(add).toHaveAccessibleDescription(
      'Vocês já têm 30 perguntas, o limite do site. Removam uma para adicionar outra.',
    );
    unmount();
    profileUnderTest.current = 'planner';
    mockSite({ site: siteWith({ sections: faq }) });
    renderAreaScreen({ url: '/app/site/faq' });
    expect(
      await screen.findByRole('button', { name: 'Adicionar pergunta' }),
    ).toHaveAccessibleDescription(
      'Este site já tem 30 perguntas, o limite. Remova uma para adicionar outra.',
    );
  });

  it('o 400 do servidor volta ao campo pelo caminho (RN12)', async () => {
    const user = userEvent.setup();
    mockSite({
      site: siteWith({
        sections: withSection({
          type: 'faq',
          title: 'Perguntas frequentes',
          content: { items: [{ question: 'E se chover?', answer: 'Há área coberta.' }] },
          enabled: true,
          empty: false,
        }),
      }),
      put: () =>
        apiError({
          status: 400,
          body: {
            error: 'VALIDATION',
            errors: [{ path: 'content.items.0.answer', code: 'IS_NOT_EMPTY' }],
          },
        }),
    });
    renderRoute({ url: '/app/site/faq' });
    await user.type(await screen.findByRole('textbox', { name: 'Pergunta' }), ' E se ventar?');
    await user.click(save());
    expect(await screen.findByRole('textbox', { name: 'Resposta' })).toHaveAccessibleDescription(
      'Preencham este campo.',
    );
  });

  it('é acessível', async () => {
    mockSite({
      site: siteWith({
        sections: withSection({
          type: 'faq',
          title: 'Perguntas frequentes',
          content: { items: [{ question: 'E se chover?', answer: 'Há área coberta.' }] },
          enabled: true,
          empty: false,
        }),
      }),
    });
    const { container } = renderRoute({ url: '/app/site/faq' });
    await screen.findByRole('button', { name: 'Adicionar pergunta' });
    await expectNoA11yViolations({ container });
  });
});
