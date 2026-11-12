import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../tests/a11y';
import { apiError, mockApi } from '../../tests/render-route';
import type { PublicSiteResponse } from '../shared/api/generated/model';
import { companyLine } from './links';
import { parseSiteRoute } from './route';
import { SiteApp } from './site-app';
import { applySiteTheme } from './theme';

vi.mock('./fonts', () => ({ loadSiteFonts: vi.fn(async () => undefined) }));

afterEach(() => {
  document.documentElement.removeAttribute('data-site-fonts');
  document.documentElement.removeAttribute('data-site-background');
  document.documentElement.removeAttribute('style');
});

const site: PublicSiteResponse = {
  slug: 'ana-e-marcos',
  names: 'Ana & Marcos',
  eventDate: '2026-11-14',
  city: 'Campinas',
  state: 'SP',
  timezone: 'America/Sao_Paulo',
  cover: null,
  contact: null,
  viewer: { kind: 'visitor', party: null, preview: null },
  appearance: {
    fontPairKey: 'classico',
    primaryColor: '#2F4B6E',
    primaryForeground: '#FFFFFF',
    accentColor: '#C9A66B',
    backgroundMode: 'light',
  },
  sections: [
    { type: 'countdown', content: {} },
    { type: 'story', title: 'Como tudo começou', content: { text: 'Oi.', images: [] } },
    { type: 'ceremony', title: 'Cerimônia & Recepção', locked: true, content: {} },
    { type: 'faq', title: 'Perguntas frequentes', content: { items: [] } },
  ],
} as unknown as PublicSiteResponse;

function mockSite(respond: () => Response) {
  return mockApi(({ path }) =>
    path === '/v1/sites/ana-e-marcos' ? respond() : apiError({ status: 404, body: { error: 'X' } }),
  );
}

describe('Site do casal › endereço e estados (Site público RN01, RN04, RN12)', () => {
  it('lê o slug e o link do grupo do caminho', () => {
    expect(parseSiteRoute('/Ana-e-Marcos')).toEqual({ kind: 'site', slug: 'ana-e-marcos' });
    expect(parseSiteRoute('/ana-e-marcos/grupo/abc123')).toEqual({
      kind: 'party',
      slug: 'ana-e-marcos',
      token: 'abc123',
    });
    expect(parseSiteRoute('/')).toEqual({ kind: 'none' });
    expect(parseSiteRoute('/ana-e-marcos/outra')).toEqual({ kind: 'none' });
    // Um "%" malformado não derruba a página: vira o endereço que não existe.
    expect(parseSiteRoute('/ana%E0%A4%A')).toEqual({ kind: 'none' });
  });

  it('rascunho: a página do Kore, sem nome do casal (RN04)', async () => {
    mockSite(() => apiError({ status: 404, body: { error: 'SITE_DRAFT' } }));
    render(<SiteApp pathname="/ana-e-marcos" />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Este site ainda não foi publicado.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Quando o casal publicar, ele aparece neste endereço.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Feito com Kore' })).toHaveAttribute(
      'href',
      'https://kore.com.br/',
    );
    expect(screen.queryByText(/Ana/)).not.toBeInTheDocument();
  });

  it('endereço que não existe, também sem chamar a API para a raiz (RN04)', async () => {
    mockSite(() => apiError({ status: 404, body: { error: 'SITE_NOT_FOUND' } }));
    const { unmount } = render(<SiteApp pathname="/ana-e-marcos" />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Não encontramos este endereço.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Confira o link que você recebeu.')).toBeInTheDocument();
    unmount();
    const fetchMock = mockSite(() => Response.json(site));
    render(<SiteApp pathname="/" />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Não encontramos este endereço.' }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('erro ao carregar: a página com Tentar de novo, que chama de novo (RN12)', async () => {
    const user = userEvent.setup();
    let fail = true;
    mockSite(() => (fail ? apiError({ status: 503, body: { error: 'X' } }) : Response.json(site)));
    render(<SiteApp pathname="/ana-e-marcos" />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Não foi possível carregar o site.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Confira sua conexão e tente de novo.')).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ana & Marcos' }),
    ).toBeInTheDocument();
  });
});

describe('Site do casal › layout (Site público RN10, RN11)', () => {
  it('a Topbar com os nomes, o menu pelo título das seções (sem a contagem) e o Hero', async () => {
    mockSite(() => Response.json(site));
    render(<SiteApp pathname="/ana-e-marcos" />);
    const menu = await screen.findByRole('navigation', { name: 'Menu principal' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Como tudo começou', '#nossa-historia'],
      ['Cerimônia & Recepção', '#cerimonia-e-recepcao'],
      ['Perguntas frequentes', '#faq'],
    ]);
    expect(screen.getByRole('link', { name: 'Ana & Marcos' })).toHaveAttribute('href', '#topo');
    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute(
      'href',
      '#conteudo',
    );
    expect(screen.getByText('Vamos nos casar')).toBeInTheDocument();
    expect(screen.getByText('sábado, 14 de novembro de 2026 · Campinas (SP)')).toBeInTheDocument();
    expect(screen.getByText(/^(Faltam \d+ dias|Falta 1 dia|É hoje)$/)).toBeInTheDocument();
  });

  it('o botão do menu abre e fecha a lista, e o Esc fecha', async () => {
    const user = userEvent.setup();
    mockSite(() => Response.json(site));
    render(<SiteApp pathname="/ana-e-marcos" />);
    const button = await screen.findByRole('button', { name: 'Abrir menu' });
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAccessibleName('Fechar menu');
    expect(menu).toHaveAttribute('data-open', 'true');
    await user.click(within(menu).getByRole('link', { name: 'Perguntas frequentes' }));
    expect(menu).toHaveAttribute('data-open', 'false');
    await user.click(button);
    await user.keyboard('{Escape}');
    expect(menu).toHaveAttribute('data-open', 'false');
  });

  it('o rodapé: os nomes, a data e a cidade, Feito com Kore, Termos e Privacidade (RN10)', async () => {
    mockSite(() => Response.json(site));
    render(<SiteApp pathname="/ana-e-marcos" />);
    const footer = await screen.findByRole('contentinfo');
    expect(
      within(footer).getByText('sábado, 14 de novembro de 2026 · Campinas'),
    ).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: 'Termos' })).toHaveAttribute(
      'href',
      'https://kore.com.br/termos',
    );
    expect(within(footer).getByRole('link', { name: 'Privacidade' })).toHaveAttribute(
      'href',
      'https://kore.com.br/privacidade',
    );
    expect(within(footer).getByRole('link', { name: 'Feito com Kore' })).toHaveAttribute(
      'href',
      'https://kore.com.br/',
    );
  });

  it('sem data e sem a contagem: o Hero com a cidade e a UF, sem contagem', async () => {
    mockSite(() =>
      Response.json({
        ...site,
        eventDate: null,
        sections: site.sections.filter((s) => s.type !== 'countdown'),
      }),
    );
    render(<SiteApp pathname="/ana-e-marcos" />);
    expect(await screen.findByText('Campinas (SP)')).toBeInTheDocument();
    expect(screen.queryByText(/Faltam|Falta 1|É hoje/)).not.toBeInTheDocument();
  });

  it('com capa: a foto com o alt dos nomes (Imagens RN09)', async () => {
    mockSite(() =>
      Response.json({ ...site, cover: { url: 'https://cdn/capa.jpg', width: 2560, height: 1707 } }),
    );
    render(<SiteApp pathname="/ana-e-marcos" />);
    expect(await screen.findByRole('img', { name: 'Ana & Marcos' })).toHaveAttribute(
      'src',
      'https://cdn/capa.jpg',
    );
  });

  it('a Aparência vai para o documento: fontes, fundo e as cores do casal (Aparência RN09)', async () => {
    mockSite(() => Response.json(site));
    render(<SiteApp pathname="/ana-e-marcos" />);
    await screen.findByRole('navigation', { name: 'Menu principal' });
    const root = document.documentElement;
    expect(root).toHaveAttribute('data-site-fonts', 'classico');
    expect(root).toHaveAttribute('data-site-background', 'light');
    expect(root.style.getPropertyValue('--site-primary')).toBe('#2F4B6E');
    expect(root.style.getPropertyValue('--site-primary-foreground')).toBe('#FFFFFF');
    expect(root.style.getPropertyValue('--site-accent')).toBe('#C9A66B');
  });

  it('é acessível', async () => {
    mockSite(() => Response.json(site));
    const { container } = render(<SiteApp pathname="/ana-e-marcos" />);
    await screen.findByRole('navigation', { name: 'Menu principal' });
    await expectNoA11yViolations({ container });
  });
});

const partySite = {
  ...site,
  viewer: { kind: 'party', party: { name: 'Família Moreira' }, preview: null },
  contact: { whatsapp: '+5519987654521', email: 'ana@exemplo.com' },
  sections: [
    { type: 'countdown', content: {} },
    {
      type: 'ceremony',
      title: 'Cerimônia & Recepção',
      locked: false,
      content: {
        venues: [
          {
            title: 'Cerimônia',
            placeName: 'Capela Nossa Senhora das Graças',
            date: '2026-11-14',
            time: '16:30',
            address: 'Rua Barão de Jaguara, 1200, Centro, Campinas, SP',
          },
          {
            title: 'Recepção',
            placeName: 'Espaço Villa Toscana',
            date: '2026-11-14',
            time: '18:30',
            address: 'Rua A & B, 10 #2',
          },
        ],
      },
    },
  ],
} as unknown as PublicSiteResponse;

type Call = { method: string; path: string; body: unknown };

function mockParty(session: () => Response, get: () => Response = () => Response.json(partySite)) {
  const calls: Call[] = [];
  mockApi(({ method, path, body }) => {
    calls.push({ method, path, body });
    if (path.endsWith('/party-session') && method === 'POST') return session();
    if (path.startsWith('/v1/sites/') && method === 'GET') return get();
    return apiError({ status: 404, body: { error: 'X' } });
  });
  return calls;
}

describe('Site do casal › o link do grupo (Site público RN06)', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('troca o token pelo cookie, tira o token do endereço e abre o site do grupo', async () => {
    window.history.replaceState(null, '', '/ana-e-marcos/grupo/q3Xv8LmN2pRtY7wK1cZb4A');
    const calls = mockParty(() =>
      Response.json({ slug: 'ana-e-marcos', party: { name: 'Família Moreira' } }),
    );
    render(<SiteApp pathname="/ana-e-marcos/grupo/q3Xv8LmN2pRtY7wK1cZb4A" />);
    expect(await screen.findByText('Convite para Família Moreira')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/ana-e-marcos');
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /v1/sites/ana-e-marcos/party-session',
      'GET /v1/sites/ana-e-marcos',
    ]);
    expect(calls[0]?.body).toEqual({ token: 'q3Xv8LmN2pRtY7wK1cZb4A' });
  });

  it('o slug errado vai ao endereço certo do casamento do token', async () => {
    const calls = mockParty(() =>
      Response.json({ slug: 'ana-e-marcos', party: { name: 'Família Moreira' } }),
    );
    render(<SiteApp pathname="/outro-endereco/grupo/q3Xv8LmN2pRtY7wK1cZb4A" />);
    expect(await screen.findByText('Convite para Família Moreira')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/ana-e-marcos');
    expect(calls[1]?.path).toBe('/v1/sites/ana-e-marcos');
  });

  it('o link que não funciona mais, também no limite de tentativas; o token sai do endereço', async () => {
    mockParty(() => apiError({ status: 404, body: { error: 'LINK_INVALID' } }));
    const { unmount } = render(<SiteApp pathname="/ana-e-marcos/grupo/q3Xv8LmN2pRtY7wK1cZb4A" />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Este link não funciona mais.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Peça um novo link ao casal.')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/ana-e-marcos');
    unmount();
    mockParty(() => apiError({ status: 429, body: { error: 'RATE_LIMITED' } }));
    render(<SiteApp pathname="/ana-e-marcos/grupo/q3Xv8LmN2pRtY7wK1cZb4A" />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Este link não funciona mais.' }),
    ).toBeInTheDocument();
  });

  it('rascunho pelo link: a mesma página do rascunho, sem chamar o site', async () => {
    const calls = mockParty(() => apiError({ status: 404, body: { error: 'SITE_DRAFT' } }));
    render(<SiteApp pathname="/ana-e-marcos/grupo/q3Xv8LmN2pRtY7wK1cZb4A" />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Este site ainda não foi publicado.' }),
    ).toBeInTheDocument();
    expect(calls).toHaveLength(1);
  });

  it('o grupo vê os locais com a data, a hora, o endereço e as rotas em nova aba, e o contato (RN05, RN10)', async () => {
    mockParty(() => Response.json({ slug: 'ana-e-marcos', party: { name: 'Família Moreira' } }));
    render(<SiteApp pathname="/ana-e-marcos/grupo/q3Xv8LmN2pRtY7wK1cZb4A" />);
    const place = await screen.findByRole('heading', {
      level: 3,
      name: 'Capela Nossa Senhora das Graças',
    });
    const card = place.closest('li') as HTMLElement;
    expect(within(card).getByText('Cerimônia')).toBeInTheDocument();
    expect(within(card).getByText('Sáb., 14 de nov. de 2026 · 16h30')).toBeInTheDocument();
    const maps = within(card).getByRole('link', {
      name: 'Abrir no Google Maps (abre em nova aba)',
    });
    expect(maps).toHaveAttribute(
      'href',
      expect.stringContaining('query=Rua%20Bar%C3%A3o%20de%20Jaguara'),
    );
    expect(maps).toHaveAttribute('target', '_blank');
    expect(maps).toHaveAttribute('rel', 'noopener noreferrer');
    expect(
      within(card).getByRole('link', { name: 'Abrir no Waze (abre em nova aba)' }),
    ).toHaveAttribute('href', expect.stringContaining('&navigate=yes'));
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('Dúvidas? Fale com o casal pelo WhatsApp (19) 98765-4521');
    expect(within(footer).getByRole('link', { name: '(19) 98765-4521' })).toHaveAttribute(
      'href',
      'https://wa.me/5519987654521',
    );
  });

  it('sem WhatsApp, o e-mail do casal', async () => {
    mockParty(
      () => Response.json({ slug: 'ana-e-marcos', party: { name: 'Família Moreira' } }),
      () => Response.json({ ...partySite, contact: { whatsapp: null, email: 'ana@exemplo.com' } }),
    );
    render(<SiteApp pathname="/ana-e-marcos/grupo/q3Xv8LmN2pRtY7wK1cZb4A" />);
    const footer = await screen.findByRole('contentinfo');
    expect(footer).toHaveTextContent('Dúvidas? Escreva para o casal: ana@exemplo.com');
    expect(within(footer).getByRole('link', { name: 'ana@exemplo.com' })).toHaveAttribute(
      'href',
      'mailto:ana@exemplo.com',
    );
  });

  it('é acessível com o grupo', async () => {
    mockParty(() => Response.json({ slug: 'ana-e-marcos', party: { name: 'Família Moreira' } }));
    const { container } = render(<SiteApp pathname="/ana-e-marcos/grupo/q3Xv8LmN2pRtY7wK1cZb4A" />);
    await screen.findByText('Convite para Família Moreira');
    await expectNoA11yViolations({ container });
  });
});

describe('Site do casal › peças', () => {
  it('a linha da empresa junta o que houver; vazia, some', () => {
    expect(
      companyLine({
        VITE_COMPANY_NAME: 'Kore Tecnologia Ltda.',
        VITE_COMPANY_CNPJ: '00.000.000/0001-00',
        VITE_COMPANY_ADDRESS: 'Av. Paulista, 1000',
      }),
    ).toBe('Kore Tecnologia Ltda. · CNPJ 00.000.000/0001-00 · Av. Paulista, 1000');
    expect(companyLine({})).toBeNull();
  });

  it('applySiteTheme num elemento qualquer', () => {
    const root = document.createElement('div');
    applySiteTheme({ appearance: site.appearance, root });
    expect(root.getAttribute('data-site-fonts')).toBe('classico');
  });
});
