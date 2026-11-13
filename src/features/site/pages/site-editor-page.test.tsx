import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';
import type { SiteEditorResponse } from '../../../shared/api/generated/model';

afterEach(() => {
  vi.useRealTimers();
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

function site(overrides: Partial<SiteEditorResponse> = {}): SiteEditorResponse {
  return {
    publishedAt: '2026-10-01T12:00:00Z',
    siteUpdatedAt: '2026-11-11T13:31:00Z',
    songQuestion: { enabled: false, text: 'Que música não pode faltar na festa?' },
    partners: [
      { id: 'pa', title: 'bride', name: 'Ana Beatriz Moreira' },
      { id: 'pm', title: 'groom', name: 'Marcos Vinícius Rocha' },
    ],
    eventDate: '2026-12-31',
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
    sections: [
      { type: 'story', title: 'Nossa história', content: {}, enabled: true, empty: false },
      { type: 'countdown', title: null, content: {}, enabled: true, empty: false },
      { type: 'ceremony', title: 'Cerimônia & Recepção', content: {}, enabled: true, empty: true },
      {
        type: 'lodging',
        title: 'Hospedagem e transporte',
        content: {},
        enabled: false,
        empty: false,
      },
      { type: 'dress_code', title: 'Dress code', content: {}, enabled: true, empty: false },
      { type: 'faq', title: 'Perguntas frequentes', content: {}, enabled: true, empty: false },
    ],
    editable: { names: true, eventDate: true, state: true, slug: false },
    status: 'published',
    publication: { courtesyEnabled: true, endDateMin: '2027-01-01', endDateMax: '2027-12-31' },
    ...overrides,
  } as SiteEditorResponse;
}

function mockSite(respond: () => Response = () => Response.json(site())) {
  mockApi(({ path }) => {
    if (path === '/v1/me') return Response.json(me);
    if (path === '/v1/weddings/w1/site') return respond();
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
}

describe('Site › Editor (Dados básicos RN01, RN10, RN11; decisão 214)', () => {
  it('/app/site abre os Dados básicos; seção que não existe também', async () => {
    mockSite();
    const { router } = renderRoute({ url: '/app/site' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/site/dados-basicos'));
    await router.navigate('/app/site/nao-existe');
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/site/dados-basicos'));
  });

  it('o cabeçalho, a Sidebar e a lista de seções com o estado de cada uma', async () => {
    mockSite();
    renderRoute({ url: '/app/site/dados-basicos' });
    expect(await screen.findByRole('heading', { name: 'Site', level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText('kore.com.br/ana-e-marcos · Publicado · salvo às 10h31'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Site' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    const list = screen.getByRole('navigation', { name: 'Seções' });
    expect(
      within(list)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Dados básicosligada',
      'Aparêncialigada',
      'Nossa histórialigada',
      'Contagem regressivaligada',
      'Cerimônia & Recepçãovazia',
      'Hospedagem e transportedesligada',
      'Dress codeligada',
      'FAQligada',
      'Pergunta de músicadesligada',
    ]);
    expect(within(list).getByRole('link', { name: /Dados básicos/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('heading', { name: 'Dados básicos', level: 2 })).toBeInTheDocument();
  });

  it('publicado: o cabeçalho sem o Publicar (228(5))', async () => {
    mockSite();
    renderRoute({ url: '/app/site/dados-basicos' });
    await screen.findByRole('heading', { name: 'Site', level: 1 });
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument();
  });

  it('rascunho: o Publicar secundário entre Pré-visualizar e Salvar abre a tela de publicar (Publicação RN07; 228(5))', async () => {
    const user = userEvent.setup();
    mockSite(() => Response.json(site({ status: 'draft', publishedAt: null })));
    const { router } = renderRoute({ url: '/app/site/dados-basicos' });
    await screen.findByRole('heading', { name: 'Site', level: 1 });
    const header = screen.getByRole('button', { name: 'Salvar' }).parentElement as HTMLElement;
    expect(
      within(header)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Pré-visualizar', 'Publicar', 'Salvar']);
    await user.click(within(header).getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/cobranca/publicar'));
    expect(await screen.findByRole('heading', { name: 'Publicar o site' })).toBeInTheDocument();
  });

  it('rascunho sem endereço: só o status; sem gravação, sem o "salvo às"', async () => {
    mockSite(() => Response.json(site({ slug: null, status: 'draft', siteUpdatedAt: null })));
    renderRoute({ url: '/app/site/dados-basicos' });
    expect(await screen.findByText('Rascunho')).toBeInTheDocument();
  });

  it('a lista e o Select levam à seção pelo caminho dela', async () => {
    const user = userEvent.setup();
    mockSite();
    const { router } = renderRoute({ url: '/app/site/dados-basicos' });
    const list = await screen.findByRole('navigation', { name: 'Seções' });
    await user.click(within(list).getByRole('link', { name: /FAQ/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/site/faq'));
    expect(screen.getByRole('heading', { name: 'FAQ', level: 2 })).toBeInTheDocument();
    const select = screen.getByRole('combobox', { name: 'Seção' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toContain('Seção: Cerimônia & Recepção');
    await user.selectOptions(select, 'Seção: Aparência');
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/site/aparencia'));
  });

  it('no tablet e no celular, as abas Seções · Editar · Prévia trocam o que aparece', async () => {
    const user = userEvent.setup();
    mockSite();
    const { container } = renderRoute({ url: '/app/site/dados-basicos' });
    const tabs = await screen.findByRole('navigation', { name: 'Editor do site' });
    const body = container.querySelector('.kore-site-editor__body') as HTMLElement;
    expect(body).toHaveAttribute('data-tab', 'edit');
    await user.click(within(tabs).getByRole('button', { name: 'Prévia' }));
    expect(body).toHaveAttribute('data-tab', 'preview');
    await user.click(within(tabs).getByRole('button', { name: 'Seções' }));
    expect(body).toHaveAttribute('data-tab', 'sections');
    // Escolher uma seção na lista volta para a aba Editar.
    await user.click(
      within(screen.getByRole('navigation', { name: 'Seções' })).getByRole('link', { name: /FAQ/ }),
    );
    expect(body).toHaveAttribute('data-tab', 'edit');
  });

  it('a prévia-resumo: nomes, data e cidade, contagem e as seções ligadas e com conteúdo (214(2))', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-12T15:00:00Z'), toFake: ['Date'] });
    mockSite();
    renderRoute({ url: '/app/site/dados-basicos' });
    const preview = (await screen.findByText('Prévia do site')).closest('figure') as HTMLElement;
    expect(within(preview).getByText('Ana & Marcos')).toBeInTheDocument();
    expect(
      within(preview).getByText('quinta-feira, 31 de dezembro de 2026 · Campinas'),
    ).toBeInTheDocument();
    expect(within(preview).getByText('Faltam 49 dias')).toBeInTheDocument();
    expect(
      within(preview)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Nossa história', 'Dress code', 'Perguntas frequentes']);
    expect(within(preview).getByText('Visão de visitante')).toBeInTheDocument();
    expect(within(preview).queryByText(/Confirmar presença/)).toBeNull();
  });

  it('com a contagem desligada ou sem data, a prévia não mostra a contagem', async () => {
    mockSite(() =>
      Response.json(
        site({
          eventDate: null,
          sections: site().sections.map((section) =>
            section.type === 'countdown' ? { ...section, enabled: true } : section,
          ),
        }),
      ),
    );
    renderRoute({ url: '/app/site/dados-basicos' });
    const preview = (await screen.findByText('Prévia do site')).closest('figure') as HTMLElement;
    expect(within(preview).getByText('Campinas')).toBeInTheDocument();
    expect(within(preview).queryByText(/Falta|É hoje/)).toBeNull();
  });

  it('se o site não carrega, o aviso com o Tentar de novo', async () => {
    mockSite(() => apiError({ status: 500, body: { error: 'INTERNAL' } }));
    renderRoute({ url: '/app/site/dados-basicos' });
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('é acessível', async () => {
    mockSite();
    const { container } = renderRoute({ url: '/app/site/dados-basicos' });
    await screen.findByRole('heading', { name: 'Site', level: 1 });
    await expectNoA11yViolations({ container });
  });
});
