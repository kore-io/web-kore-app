import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
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
import type { SiteEditorResponse } from '../../../shared/api/generated/model';
import { compressImage } from '../images/compress-image';
import { basicsErrorText } from './basics-section';
import { putFile } from '../images/put-file';

vi.mock('../images/compress-image', async (original) => ({
  ...(await original<typeof import('../images/compress-image')>()),
  compressImage: vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' })),
}));
vi.mock('../images/put-file', () => ({ putFile: vi.fn(async () => undefined) }));

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

function site(overrides: Partial<SiteEditorResponse> = {}): SiteEditorResponse {
  return {
    publishedAt: null,
    siteUpdatedAt: '2026-11-11T13:31:00Z',
    songQuestion: { enabled: false, text: 'Que música não pode faltar na festa?' },
    partners: [
      { id: 'pa', title: 'bride', name: 'Ana Beatriz Moreira' },
      { id: 'pm', title: 'groom', name: 'Marcos Vinícius Rocha' },
    ],
    eventDate: '2026-11-14',
    city: 'Campinas',
    state: 'SP',
    timezone: 'America/Sao_Paulo',
    slug: 'ana-e-marcos',
    contactWhatsapp: '+5519998764521',
    contactEmail: 'ana.moreira@gmail.com',
    cover: null,
    appearance: {
      starterPaletteKey: 'terracota',
      fontPairKey: 'romantico',
      primaryColor: '#A94F37',
      accentColor: '#7A8B69',
      backgroundMode: 'cream',
    },
    sections: [],
    editable: { names: true, eventDate: true, state: true, slug: true },
    status: 'draft',
    ...overrides,
  } as SiteEditorResponse;
}

type Call = { method: string; path: string; body: unknown };
const gets = { count: 0 };

function mockBasics({
  data = site(),
  patch = (body: unknown) =>
    Response.json({ ...data, ...(body as object), siteUpdatedAt: '2026-11-11T14:00:00Z' }),
  availability = (slug: string) =>
    Response.json({ slug, available: true, reason: null, suggestion: null }),
}: {
  data?: SiteEditorResponse;
  patch?: (body: unknown) => Response;
  availability?: (slug: string) => Response;
} = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(meFor(me));
    if (path === '/v1/weddings/w1/site' && method === 'GET') {
      gets.count += 1;
      return Response.json(data);
    }
    if (path.endsWith('/upload-authorizations')) {
      return Response.json(
        {
          imageId: 'img1',
          uploadUrl: 'http://s3/put',
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1' },
          expiresAt: '2026-11-11T12:05:00Z',
        },
        { status: 201 },
      );
    }
    if (path === '/v1/weddings/w1/site-images') {
      return Response.json({
        id: 'img1',
        status: 'ready',
        url: 'https://cdn/img1/display.jpg',
        thumbUrl: 'https://cdn/img1/thumb.jpg',
        width: 2560,
        height: 1707,
      });
    }
    if (path.startsWith('/v1/weddings/slug-availability')) {
      const query = new URLSearchParams(path.split('?')[1]);
      calls.push({ method, path, body: Object.fromEntries(query) });
      return availability(query.get('slug') ?? '');
    }
    if (path === '/v1/weddings/w1/dashboard') {
      return Response.json({
        site: {
          slug: data.slug,
          publishedAt: data.publishedAt,
          endDate: '2027-02-14',
          status: data.status,
        },
      });
    }
    // O layout lê o contador do sino: não é chamada da tela.
    if (isLayoutRead({ method, path })) return layoutReadNotFound();
    calls.push({ method, path, body });
    if (path === '/v1/weddings/w1/site' && method === 'PATCH') return patch(body);
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const field = (name: string | RegExp) => screen.getByRole('textbox', { name });

describe('Site › Dados básicos (RN02 a RN08, RN10)', () => {
  it('os campos do Penpot, com os rótulos do título e o fuso sem o nome IANA', async () => {
    mockBasics();
    renderRoute({ url: '/app/site/dados-basicos' });
    expect(await screen.findByRole('textbox', { name: 'Noiva' })).toHaveValue(
      'Ana Beatriz Moreira',
    );
    expect(field('Noivo')).toHaveValue('Marcos Vinícius Rocha');
    expect(field('Noiva')).toHaveAttribute('maxlength', '80');
    expect(screen.getByLabelText('Data do casamento')).toHaveAccessibleDescription(
      'Opcional. Se ainda não tiverem a data, deixem em branco.',
    );
    expect(field('Cidade')).toHaveValue('Campinas');
    expect(screen.getByRole('combobox', { name: 'UF' })).toHaveValue('SP');
    const tz = field('Fuso horário');
    expect(tz).toHaveValue('Horário de Brasília');
    expect(tz).toBeDisabled();
    expect(tz).toHaveAccessibleDescription('Vem da UF. Os horários do site usam este fuso.');
    expect(field('Endereço do site')).toHaveAccessibleDescription(
      'O endereço só muda enquanto o site está em rascunho.',
    );
    expect(field('WhatsApp do casal (opcional)')).toHaveValue('(19) 99876-4521');
    expect(field(/^E-.mail do casal \(opcional\)$/)).toHaveAccessibleDescription(
      'O contato aparece no rodapé do site, só para quem entra pelo link do convite.',
    );
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('o fuso acompanha a UF: MT −1 h e AC −2 h (RN02)', async () => {
    const user = userEvent.setup();
    mockBasics();
    renderRoute({ url: '/app/site/dados-basicos' });
    const uf = await screen.findByRole('combobox', { name: 'UF' });
    await user.selectOptions(uf, 'MT');
    expect(field('Fuso horário')).toHaveValue('1 hora a menos que Brasília');
    await user.selectOptions(uf, 'AC');
    expect(field('Fuso horário')).toHaveValue('2 horas a menos que Brasília');
  });

  it('Salvar manda só o que mudou, mostra "Alterações salvas." e o "salvo às" novo (RN10)', async () => {
    const user = userEvent.setup();
    const calls = mockBasics();
    renderRoute({ url: '/app/site/dados-basicos' });
    const city = await screen.findByRole('textbox', { name: 'Cidade' });
    await user.clear(city);
    await user.type(city, 'Valinhos');
    const save = screen.getByRole('button', { name: 'Salvar' });
    expect(save).toBeEnabled();
    await user.click(save);
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
    expect(calls).toEqual([
      { method: 'PATCH', path: '/v1/weddings/w1/site', body: { city: 'Valinhos' } },
    ]);
    expect(
      await screen.findByText('kore.com.br/ana-e-marcos · Rascunho · salvo às 11h'),
    ).toBeInTheDocument();
    expect(save).toBeDisabled();
  });

  it('trocar de seção com mudança pede o Dialog; Continuar editando fica, Descartar sai', async () => {
    const user = userEvent.setup();
    mockBasics();
    const { router } = renderRoute({ url: '/app/site/dados-basicos' });
    await user.type(await screen.findByRole('textbox', { name: 'Cidade' }), ' Centro');
    const list = screen.getByRole('navigation', { name: 'Seções' });
    await user.click(within(list).getByRole('link', { name: /FAQ/ }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Descartar as alterações?' });
    expect(dialog).toHaveAccessibleDescription('O que mudou em Dados básicos ainda não foi salvo.');
    await user.click(within(dialog).getByRole('button', { name: 'Continuar editando' }));
    expect(router.state.location.pathname).toBe('/app/site/dados-basicos');
    expect(field('Cidade')).toHaveValue('Campinas Centro');
    await user.click(within(list).getByRole('link', { name: /FAQ/ }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Descartar alterações',
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/site/faq'));
  });

  it('fechar a aba com mudança não salva pede o aviso do navegador; sem mudança, não (RN10)', async () => {
    const user = userEvent.setup();
    mockBasics();
    renderRoute({ url: '/app/site/dados-basicos' });
    const city = await screen.findByRole('textbox', { name: 'Cidade' });
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);
    await user.type(city, ' Centro');
    expect(unload()).toBe(true);
    await user.clear(city);
    await user.type(city, 'Campinas');
    expect(unload()).toBe(false);
  });

  it('o nome sem título leva o rótulo "Nome" (RN02)', async () => {
    mockBasics({
      data: site({
        partners: [
          { id: 'pa', title: null, name: 'Ana Beatriz Moreira' },
          { id: 'pm', title: 'groom', name: 'Marcos Vinícius Rocha' },
        ] as SiteEditorResponse['partners'],
      }),
    });
    renderRoute({ url: '/app/site/dados-basicos' });
    expect(await screen.findByRole('textbox', { name: 'Nome' })).toHaveValue('Ana Beatriz Moreira');
    expect(field('Noivo')).toHaveValue('Marcos Vinícius Rocha');
  });

  it('o vendedor antes do aceite lê a ajuda da data no singular (RN02)', async () => {
    profileUnderTest.current = 'seller';
    mockBasics();
    renderAreaScreen({ url: '/app/site/dados-basicos' });
    expect(await screen.findByLabelText('Data do casamento')).toHaveAccessibleDescription(
      'Opcional. Se o casal ainda não tiver a data, deixe em branco.',
    );
  });

  it('os erros dos campos nas duas vozes (RN03 e RN06; 198(2))', () => {
    const t = i18next.getFixedT('pt-BR', 'site');
    const tGuests = i18next.getFixedT('pt-BR', 'guests');
    const text = (code: string, audience: 'couple' | 'planner') =>
      basicsErrorText({ t, tGuests, error: { code, params: {} }, audience });
    expect(text('NAME_MISSING', 'planner')).toBe('Informe o nome.');
    expect(text('EMAIL_INVALID', 'planner')).toBe('Informe um e-\u2060mail válido.');
    expect(text('SLUG_MISSING', 'planner')).toBe('Informe o endereço do site.');
    expect(text('SLUG_FORMAT', 'planner')).toBe('Use só letras minúsculas, números e hífen.');
    expect(text('STATE_MISSING', 'couple')).toBe('Escolham a UF.');
    expect(text('STATE_MISSING', 'planner')).toBe('Escolha a UF.');
  });

  it('nome e cidade vazios: os avisos do casal, sem chamar a API (RN03)', async () => {
    const user = userEvent.setup();
    const calls = mockBasics();
    renderRoute({ url: '/app/site/dados-basicos' });
    await user.clear(await screen.findByRole('textbox', { name: 'Noiva' }));
    await user.clear(field('Cidade'));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(field('Noiva')).toHaveAccessibleDescription('Informem o nome.');
    expect(field('Cidade')).toHaveAccessibleDescription('Informem a cidade.');
    expect(calls).toHaveLength(0);
  });

  it('o 400 do WhatsApp e do e-mail volta ao campo, com os textos da F1 (RN03)', async () => {
    const user = userEvent.setup();
    mockBasics({
      patch: () =>
        apiError({
          status: 400,
          body: {
            error: 'Bad Request',
            message: ['x'],
            errors: [
              { path: 'contactWhatsapp', code: 'PHONE_TOO_SHORT', params: { n: 8 } },
              { path: 'contactEmail', code: 'IS_EMAIL', params: {} },
            ],
          },
        }),
    });
    renderRoute({ url: '/app/site/dados-basicos' });
    const whatsapp = await screen.findByRole('textbox', { name: 'WhatsApp do casal (opcional)' });
    await user.clear(whatsapp);
    await user.type(whatsapp, '9876-4521');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(whatsapp).toHaveAccessibleDescription(
        'O telefone tem 8 números. Usem DDD + número, ex.: (19) 99999-9999.',
      ),
    );
    expect(field(/^E-.mail do casal/)).toHaveAccessibleDescription('Informem um e-⁠mail válido.');
  });

  it('o endereço vira minúsculas, confere a disponibilidade com o weddingId e trava o Salvar (RN06)', async () => {
    const user = userEvent.setup();
    const calls = mockBasics({
      availability: (slug) =>
        Response.json(
          slug === 'simule'
            ? { slug, available: false, reason: 'reserved', suggestion: 'ana-e-marcos-2026' }
            : { slug, available: false, reason: 'taken', suggestion: 'ana-e-marcos-2026' },
        ),
    });
    renderRoute({ url: '/app/site/dados-basicos' });
    const slug = await screen.findByRole('textbox', { name: 'Endereço do site' });
    await user.clear(slug);
    await user.type(slug, 'Simule');
    expect(slug).toHaveValue('simule');
    await waitFor(() =>
      expect(slug).toHaveAccessibleDescription(
        'Este endereço é reservado pelo Kore. Que tal ana-e-marcos-2026? Usar ana-e-marcos-2026',
      ),
    );
    expect(calls.at(-1)?.body).toEqual({ slug: 'simule', weddingId: 'w1' });
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    await user.clear(slug);
    await user.type(slug, 'ana-marcos');
    await waitFor(() =>
      expect(slug).toHaveAccessibleDescription(
        'Este endereço já está em uso. Que tal ana-e-marcos-2026? Usar ana-e-marcos-2026',
      ),
    );
    await user.clear(slug);
    await user.type(slug, 'a_b');
    expect(slug).toHaveAccessibleDescription('Usem só letras minúsculas, números e hífen.');
    await user.clear(slug);
    expect(slug).toHaveAccessibleDescription('Informem o endereço do site.');
  });

  it('Usar a sugestão troca o endereço e, livre, o Salvar habilita', async () => {
    const user = userEvent.setup();
    mockBasics({
      availability: (slug) =>
        Response.json(
          slug === 'ana-e-marcos-2026'
            ? { slug, available: true, reason: null, suggestion: null }
            : { slug, available: false, reason: 'taken', suggestion: 'ana-e-marcos-2026' },
        ),
    });
    renderRoute({ url: '/app/site/dados-basicos' });
    const slug = await screen.findByRole('textbox', { name: 'Endereço do site' });
    await user.clear(slug);
    await user.type(slug, 'ana-marcos');
    await user.click(await screen.findByRole('button', { name: 'Usar ana-e-marcos-2026' }));
    expect(slug).toHaveValue('ana-e-marcos-2026');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled());
  });

  it('publicado: o endereço fica desabilitado, com a ajuda (RN05)', async () => {
    mockBasics({ data: site({ publishedAt: '2026-10-01T12:00:00Z', status: 'published' }) });
    renderRoute({ url: '/app/site/dados-basicos' });
    const slug = await screen.findByRole('textbox', { name: 'Endereço do site' });
    expect(slug).toBeDisabled();
    expect(slug).toHaveValue('kore.com.br/ana-e-marcos');
    expect(slug).toHaveAccessibleDescription(
      'O site já foi publicado, então o endereço não muda mais.',
    );
  });

  it('cerimonialista: a data, a UF e o endereço desabilitados, com o motivo; os erros no singular (RN04)', async () => {
    profileUnderTest.current = 'planner';
    const user = userEvent.setup();
    mockBasics({
      data: site({ editable: { names: true, eventDate: false, state: false, slug: false } }),
    });
    renderAreaScreen({ url: '/app/site/dados-basicos' });
    const date = await screen.findByLabelText('Data do casamento');
    expect(date).toBeDisabled();
    expect(date).toHaveAccessibleDescription('Só o casal pode mudar a data, a UF e o endereço.');
    expect(screen.getByRole('combobox', { name: 'UF' })).toBeDisabled();
    expect(field('Endereço do site')).toBeDisabled();
    expect(field('Endereço do site')).toHaveAccessibleDescription(
      'Só o casal pode mudar a data, a UF e o endereço.',
    );
    await user.clear(field('Cidade'));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(field('Cidade')).toHaveAccessibleDescription('Informe a cidade.');
    expect(screen.getByLabelText(/Arraste uma foto ou clique para escolher/)).toBeInTheDocument();
  });

  it('a foto de capa: envia, mostra a miniatura e vai no Salvar; Remover foto tira (RN09)', async () => {
    const user = userEvent.setup();
    const calls = mockBasics();
    renderRoute({ url: '/app/site/dados-basicos' });
    const drop = await screen.findByLabelText(/Arrastem uma foto ou cliquem para escolher/);
    expect(
      screen.getByText(
        'A foto de capa aparece no topo do site e junto do link quando ele é compartilhado no WhatsApp e nas redes. Quem tiver o endereço vê esta foto.',
      ),
    ).toBeInTheDocument();
    await user.upload(drop, new File(['x'], 'capa.jpg', { type: 'image/jpeg' }));
    const thumb = await screen.findByRole('img', { name: 'Ana & Marcos' });
    expect(thumb).toHaveAttribute('src', 'https://cdn/img1/thumb.jpg');
    expect(compressImage).toHaveBeenCalled();
    expect(putFile).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://s3/put' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(calls.at(-1)).toEqual({
        method: 'PATCH',
        path: '/v1/weddings/w1/site',
        body: { coverImageId: 'img1' },
      }),
    );
  });

  it('com capa, Remover foto volta à área de envio e manda o coverImageId nulo', async () => {
    const user = userEvent.setup();
    const calls = mockBasics({
      data: site({
        cover: {
          id: 'c1',
          url: 'https://cdn/c1/display.jpg',
          thumbUrl: 'https://cdn/c1/thumb.jpg',
          width: 1,
          height: 1,
        },
      }),
    });
    renderRoute({ url: '/app/site/dados-basicos' });
    expect(await screen.findByRole('img', { name: 'Ana & Marcos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trocar foto' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remover foto' }));
    expect(screen.getByLabelText(/Arrastem uma foto/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ coverImageId: null }));
  });

  it('na corrida (403 FIELD_NOT_ALLOWED), o Editor recarrega o site (sugestão do Crivo)', async () => {
    const user = userEvent.setup();
    gets.count = 0;
    mockBasics({
      patch: () =>
        apiError({ status: 403, body: { error: 'FIELD_NOT_ALLOWED', fields: ['state'] } }),
    });
    renderRoute({ url: '/app/site/dados-basicos' });
    await user.selectOptions(await screen.findByRole('combobox', { name: 'UF' }), 'RJ');
    const before = gets.count;
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(
      await screen.findByText('Não foi possível continuar. Confira sua conexão e tente de novo.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(gets.count).toBeGreaterThan(before));
  });

  it('publicado: a data do casamento não fica em branco, sem chamar a API (decisão 219)', async () => {
    const user = userEvent.setup();
    const calls = mockBasics({
      data: site({ publishedAt: '2026-11-12T13:00:00Z', status: 'published' }),
    });
    renderRoute({ url: '/app/site/dados-basicos' });
    const date = await screen.findByLabelText('Data do casamento');
    await user.clear(date);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(date).toHaveAccessibleDescription(
      'O site já foi publicado, então a data do casamento não pode ficar em branco.',
    );
    expect(date).toHaveAttribute('aria-invalid', 'true');
    expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(0);
  });

  it('publicado: a data nova que tira a saída do ar da faixa diz até quando o site fica no ar (RN11; 228(1))', async () => {
    const user = userEvent.setup();
    mockBasics({
      data: site({ publishedAt: '2026-11-12T13:00:00Z', status: 'published' }),
      patch: () =>
        apiError({
          status: 422,
          body: {
            statusCode: 422,
            error: 'END_DATE_OUT_OF_RANGE',
            message: 'x',
            endDateMin: '2028-03-02',
            endDateMax: '2029-03-01',
          },
        }),
    });
    renderRoute({ url: '/app/site/dados-basicos' });
    const date = await screen.findByLabelText('Data do casamento');
    await user.clear(date);
    await user.type(date, '2028-03-01');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(date).toHaveAccessibleDescription(
        'A data do casamento precisa ser antes de 14 de fev. de 2027, quando o site sai do ar.',
      ),
    );
  });

  it('é acessível', async () => {
    mockBasics();
    const { container } = renderRoute({ url: '/app/site/dados-basicos' });
    await screen.findByRole('textbox', { name: 'Noiva' });
    await expectNoA11yViolations({ container });
  });
});
