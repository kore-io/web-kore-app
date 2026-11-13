import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor, profileUnderTest } from '../../../../tests/profile';
import { apiError, mockApi, renderAreaScreen, renderRoute } from '../../../../tests/render-route';
import type { SiteEditorResponse } from '../../../shared/api/generated/model';

vi.mock('../site-fonts', () => ({ loadEditorFonts: vi.fn(async () => undefined) }));

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

const site = {
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
  sections: [],
  editable: { names: true, eventDate: true, state: true, slug: true },
  status: 'draft',
} as unknown as SiteEditorResponse;

type Call = { method: string; path: string; body: unknown };

function mockAppearance({ put }: { put?: (body: Record<string, unknown>) => Response } = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(meFor(me));
    if (path === '/v1/weddings/w1/site' && method === 'GET') return Response.json(site);
    calls.push({ method, path, body });
    if (path === '/v1/weddings/w1/site/appearance') {
      const data = body as Record<string, unknown>;
      return put
        ? put(data)
        : Response.json({ ...data, primaryForeground: '#FFFFFF', warnings: [] });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

const primary = () => screen.getByRole('textbox', { name: 'Cor principal (botões)' });
const accent = () => screen.getByRole('textbox', { name: 'Destaque (detalhes e ícones)' });
const previewButton = () => screen.getByText('Abrir no Google Maps');

async function typeHex(user: ReturnType<typeof userEvent.setup>, field: HTMLElement, hex: string) {
  await user.clear(field);
  await user.type(field, hex);
}

describe('Site › Aparência (S2; decisão 218)', () => {
  it('as fontes, as paletas, as cores com o contraste e o fundo do Penpot (RN01, RN06)', async () => {
    mockAppearance();
    renderRoute({ url: '/app/site/aparencia' });
    const fonts = await screen.findByRole('group', { name: 'Tipografia' });
    expect(within(fonts).getAllByRole('radio')).toHaveLength(4);
    expect(within(fonts).getByRole('radio', { name: /Romântico/ })).toBeChecked();
    expect(within(fonts).getByText('Em uso')).toBeInTheDocument();
    expect(within(fonts).getByText('Playfair Display · Source Sans 3')).toBeInTheDocument();
    const palettes = screen.getByRole('radiogroup', { name: 'Paleta de partida' });
    expect(
      within(palettes)
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent),
    ).toEqual([
      'Terracota',
      'Sálvia',
      'Rosé',
      'Marfim',
      'Marinho',
      'Areia',
      'Pôr do sol',
      'Grafite',
      'Noite',
    ]);
    expect(within(palettes).getByRole('radio', { name: 'Terracota' })).toBeChecked();
    expect(
      screen.getByText(
        'Comecem por uma paleta e, se quiserem, troquem a cor principal e o destaque.',
      ),
    ).toBeInTheDocument();
    expect(primary()).toHaveValue('#A94F37');
    expect(primary()).toHaveAccessibleDescription(
      'Texto dos botões em branco · contraste 5,4:1 · sobre o fundo 5,0:1',
    );
    expect(accent()).toHaveAccessibleDescription('Sobre o fundo: 3,4:1');
    expect(screen.getByRole('radio', { name: 'Creme' })).toBeChecked();
    expect(screen.getByText('Trocar a aparência não apaga textos nem fotos.')).toBeInTheDocument();
    expect(previewButton()).toHaveStyle({ backgroundColor: '#A94F37', color: '#FFFFFF' });
  });

  it('escolher uma paleta troca a cor principal, o destaque e o fundo, e a prévia acompanha (RN03, RN08)', async () => {
    const user = userEvent.setup();
    mockAppearance();
    renderRoute({ url: '/app/site/aparencia' });
    await user.click(await screen.findByRole('radio', { name: 'Marinho' }));
    expect(primary()).toHaveValue('#1F2A44');
    expect(accent()).toHaveValue('#B08D57');
    expect(screen.getByRole('radio', { name: 'Claro' })).toBeChecked();
    expect(previewButton()).toHaveStyle({ backgroundColor: '#1F2A44' });
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });

  it('cor própria: a paleta sai e o PUT leva starterPaletteKey nulo, em maiúsculas (RN06, RN07)', async () => {
    const user = userEvent.setup();
    const calls = mockAppearance();
    renderRoute({ url: '/app/site/aparencia' });
    await typeHex(
      user,
      await screen.findByRole('textbox', { name: 'Cor principal (botões)' }),
      '#8b3a2e',
    );
    expect(screen.getByRole('radio', { name: 'Terracota' })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: 'PUT',
        path: '/v1/weddings/w1/site/appearance',
        body: {
          fontPairKey: 'romantico',
          starterPaletteKey: null,
          primaryColor: '#8B3A2E',
          accentColor: '#7A8B69',
          backgroundMode: 'cream',
        },
      },
    ]);
  });

  it('cor que deixa o botão ilegível: o aviso, o campo em erro, o Salvar travado e a prévia na última cor válida (RN04, RN05)', async () => {
    const user = userEvent.setup();
    mockAppearance();
    renderRoute({ url: '/app/site/aparencia' });
    await user.click(await screen.findByRole('radio', { name: 'Claro' }));
    await typeHex(user, primary(), '#777777');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Essa cor deixa o texto dos botões difícil de ler. Escolham um tom mais escuro ou mais claro.',
    );
    expect(primary()).toHaveAttribute('aria-invalid', 'true');
    expect(primary()).toHaveAccessibleDescription(
      'Texto dos botões em branco · contraste 4,4:1 · sobre o fundo 4,4:1',
    );
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    expect(previewButton()).toHaveStyle({ backgroundColor: '#A94F37' });
  });

  it('cor que some no fundo: o outro aviso; trocar o fundo também confere (RN04; D21)', async () => {
    const user = userEvent.setup();
    mockAppearance();
    renderRoute({ url: '/app/site/aparencia' });
    await typeHex(
      user,
      await screen.findByRole('textbox', { name: 'Cor principal (botões)' }),
      '#E7D3B0',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Essa cor fica pouco visível neste fundo. Escolham um tom mais escuro ou mais claro, ou outro fundo.',
    );
    await user.click(screen.getByRole('radio', { name: 'Escuro' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });

  it('o destaque pouco visível só avisa, sem travar (RN04)', async () => {
    const user = userEvent.setup();
    mockAppearance();
    renderRoute({ url: '/app/site/aparencia' });
    await typeHex(
      user,
      await screen.findByRole('textbox', { name: 'Destaque (detalhes e ícones)' }),
      '#E8DFD4',
    );
    expect(accent()).toHaveAccessibleDescription(/O destaque fica pouco visível neste fundo\.$/);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });

  it('o 422 CONTRAST_TOO_LOW do servidor cai no mesmo aviso (RN05)', async () => {
    const user = userEvent.setup();
    mockAppearance({
      put: () =>
        apiError({
          status: 422,
          body: { error: 'CONTRAST_TOO_LOW', check: 'primary_background', ratio: 2.9 },
        }),
    });
    renderRoute({ url: '/app/site/aparencia' });
    await user.click(await screen.findByRole('radio', { name: 'Sálvia' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Essa cor fica pouco visível neste fundo.',
    );
  });

  it('trocar o par de fontes move o "Em uso" e manda a chave nova', async () => {
    const user = userEvent.setup();
    const calls = mockAppearance();
    renderRoute({ url: '/app/site/aparencia' });
    const fonts = await screen.findByRole('group', { name: 'Tipografia' });
    await user.click(within(fonts).getByRole('radio', { name: /Moderno/ }));
    expect(
      within(
        within(fonts)
          .getByRole('radio', { name: /Moderno/ })
          .closest('label') as HTMLElement,
      ).getByText('Em uso'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect((calls[0]?.body as { fontPairKey: string }).fontPairKey).toBe('moderno'),
    );
  });

  it('cerimonialista: o apoio e o bloqueio no singular (218)', async () => {
    profileUnderTest.current = 'planner';
    const user = userEvent.setup();
    mockAppearance();
    renderAreaScreen({ url: '/app/site/aparencia' });
    expect(
      await screen.findByText(
        'Comece por uma paleta e, se quiser, troque a cor principal e o destaque.',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Claro' }));
    await typeHex(user, primary(), '#777777');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Escolha um tom mais escuro ou mais claro.',
    );
  });

  it('cerimonialista: a cor que some no fundo, no singular (RN04; 198(2))', async () => {
    profileUnderTest.current = 'planner';
    const user = userEvent.setup();
    mockAppearance();
    renderAreaScreen({ url: '/app/site/aparencia' });
    await typeHex(
      user,
      await screen.findByRole('textbox', { name: 'Cor principal (botões)' }),
      '#EFE6DA',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Essa cor fica pouco visível neste fundo. Escolha um tom mais escuro ou mais claro, ou outro fundo.',
    );
  });

  it('trocar de Escuro para Claro com uma cor que some no Claro bloqueia (RN04)', async () => {
    const user = userEvent.setup();
    mockAppearance();
    renderRoute({ url: '/app/site/aparencia' });
    await user.click(await screen.findByRole('radio', { name: 'Escuro' }));
    await typeHex(user, primary(), '#E7D3B0');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
    await user.click(screen.getByRole('radio', { name: 'Claro' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Essa cor fica pouco visível neste fundo. Escolham um tom mais escuro ou mais claro, ou outro fundo.',
    );
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('a prévia troca de fonte com o par: Moderno em DM Serif Display e Inter (RN08)', async () => {
    const user = userEvent.setup();
    mockAppearance();
    const { container } = renderRoute({ url: '/app/site/aparencia' });
    const fonts = await screen.findByRole('group', { name: 'Tipografia' });
    await user.click(within(fonts).getByRole('radio', { name: /Moderno/ }));
    const card = container.querySelector<HTMLElement>('.kore-editor-preview__card');
    expect(card?.style.fontFamily).toContain('Inter');
    expect(
      card?.querySelector<HTMLElement>('.kore-editor-preview__names')?.style.fontFamily,
    ).toContain('DM Serif Display');
  });

  it('trocar só o destaque também tira a paleta: o PUT leva starterPaletteKey nulo (RN07)', async () => {
    const user = userEvent.setup();
    const calls = mockAppearance();
    renderRoute({ url: '/app/site/aparencia' });
    await typeHex(
      user,
      await screen.findByRole('textbox', { name: 'Destaque (detalhes e ícones)' }),
      '#1F2A44',
    );
    const palettes = screen.getByRole('radiogroup', { name: 'Paleta de partida' });
    expect(within(palettes).queryByRole('radio', { checked: true })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(calls[0]?.body).toMatchObject({
        starterPaletteKey: null,
        primaryColor: '#A94F37',
        accentColor: '#1F2A44',
      }),
    );
  });

  it('a Noite: o texto dos botões em preto na legenda (RN06)', async () => {
    const user = userEvent.setup();
    mockAppearance();
    renderRoute({ url: '/app/site/aparencia' });
    await user.click(await screen.findByRole('radio', { name: 'Noite' }));
    expect(primary()).toHaveAccessibleDescription(
      'Texto dos botões em preto · contraste 11,2:1 · sobre o fundo 12,2:1',
    );
  });

  it('é acessível', async () => {
    mockAppearance();
    const { container } = renderRoute({ url: '/app/site/aparencia' });
    await screen.findByRole('group', { name: 'Tipografia' });
    await expectNoA11yViolations({ container });
  });
});
