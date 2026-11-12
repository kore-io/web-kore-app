import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../tests/a11y';
import { mockApi } from '../../../tests/render-route';
import { decodeDraft, SITE_DRAFT_KEY, emptyDraft } from '../../shared/simulator/draft';
import { parseSiteRoute } from '../route';
import { SimulatorPage } from './simulator-page';

vi.mock('../fonts', () => ({ loadSiteFonts: vi.fn(async () => undefined) }));
vi.mock('../../features/site/site-fonts', () => ({
  loadEditorFonts: vi.fn(async () => undefined),
}));
vi.mock('../../features/site/images/compress-image', async (original) => ({
  ...(await original<typeof import('../../features/site/images/compress-image')>()),
  compressImage: vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' })),
}));

const events: string[] = [];
const assign = vi.fn();

beforeEach(() => {
  events.length = 0;
  window.localStorage.clear();
  window.sessionStorage.clear();
  mockApi(({ path, body }) => {
    if (path === '/v1/product-events/simulator') events.push((body as { name: string }).name);
    return new Response(null, { status: 204 });
  });
  vi.stubGlobal('location', { ...window.location, assign });
  URL.createObjectURL = vi.fn(() => 'blob:foto');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  assign.mockReset();
});

async function fillToStyle(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: 'Seu nome' }), 'Ana');
  await user.type(screen.getByRole('textbox', { name: 'Nome do seu amor' }), 'Marcos');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
  await user.type(screen.getByLabelText('Data do casamento'), '2026-11-14');
  await user.type(screen.getByRole('textbox', { name: 'Cidade' }), 'Campinas (SP)');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
}

describe('Simule (Simule RN01 a RN12; decisão 226)', () => {
  it('/simule só existe com a variável ligada (RN01)', () => {
    expect(parseSiteRoute('/simule', true)).toEqual({ kind: 'simulator' });
    expect(parseSiteRoute('/simule', false)).toEqual({ kind: 'none' });
  });

  it('começa no Passo 1, sem nomes de exemplo na prévia, e o Continuar pede os dois nomes (RN02, RN12)', async () => {
    const user = userEvent.setup();
    const { container } = render(<SimulatorPage search="" />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Como vocês se chamam?' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Passo 1 de 4')).toBeInTheDocument();
    expect(container.querySelector('.kore-simule-preview__names')).toBeNull();
    expect(container.querySelector('.kore-simule-preview__blank--names')).not.toBeNull();
    const next = screen.getByRole('button', { name: 'Continuar' });
    expect(next).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Seu nome' }), 'Ana');
    await user.type(screen.getByRole('textbox', { name: 'Nome do seu amor' }), 'Marcos');
    expect(container.querySelector('.kore-simule-preview__names')).toHaveTextContent(
      'Ana & Marcos',
    );
    expect(next).toBeEnabled();
    await waitFor(() => expect(events).toContain('simule_iniciado'));
  });

  it('o Passo 2 aceita "Ainda não sabemos a data" e pede a cidade; o Voltar volta sem perder nada (RN02, RN07)', async () => {
    const user = userEvent.setup();
    render(<SimulatorPage search="" />);
    await user.type(screen.getByRole('textbox', { name: 'Seu nome' }), 'Ana');
    await user.type(screen.getByRole('textbox', { name: 'Nome do seu amor' }), 'Marcos');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('heading', { name: 'Quando e onde vai ser?' })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Ainda não sabemos a data' }));
    expect(screen.getByLabelText('Data do casamento')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Cidade' }), 'Campinas');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('textbox', { name: 'Seu nome' })).toHaveValue('Ana');
    await waitFor(() => expect(events).toContain('simule_nomes'));
  });

  it('a paleta troca as três cores; o Outra cor troca só a principal, com a paleta nula; a bloqueada trava (RN03)', async () => {
    const user = userEvent.setup();
    const { container } = render(<SimulatorPage search="" />);
    await fillToStyle(user);
    await user.click(screen.getByRole('radio', { name: 'Noite' }));
    const card = container.querySelector('.kore-simule-preview__card') as HTMLElement;
    await waitFor(() => expect(card.style.getPropertyValue('--site-primary')).toBe('#E7D3B0'));
    expect(card).toHaveAttribute('data-site-background', 'escuro');
    await user.click(screen.getByRole('button', { name: 'Outra cor' }));
    const sheet = screen.getByRole('dialog', { name: 'Escolham a cor' });
    const hex = within(sheet).getByRole('textbox', { name: 'Cor' });
    await user.clear(hex);
    await user.type(hex, '15171C');
    expect(within(sheet).getByRole('alert')).toHaveTextContent(
      'Essa cor fica pouco visível neste fundo. Escolham um tom mais escuro ou mais claro.',
    );
    expect(within(sheet).getByRole('button', { name: 'Usar esta cor' })).toBeDisabled();
    // A prévia fica na última cor boa.
    expect(card.style.getPropertyValue('--site-primary')).toBe('#E7D3B0');
    await user.clear(hex);
    await user.type(hex, 'F2F0EC');
    expect(
      within(sheet).getByText('Boa leitura: o texto dos botões fica preto.'),
    ).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Usar esta cor' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem(SITE_DRAFT_KEY) ?? '{}') as Record<
      string,
      unknown
    >;
    expect(saved).toMatchObject({
      primaryColor: '#F2F0EC',
      accentColor: '#9A8C7A',
      backgroundMode: 'dark',
      starterPaletteKey: null,
    });
    expect(screen.getByRole('button', { name: 'Outra cor' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Outra cor' }));
    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() =>
      expect(events).toEqual(
        expect.arrayContaining(['simule_outra_cor_aberta', 'simule_outra_cor_desistiu']),
      ),
    );
  });

  it('a foto fica só na aba e não vai ao rascunho; o tipo errado avisa (RN04)', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(<SimulatorPage search="" />);
    await fillToStyle(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      screen.getByText(
        'A foto aparece só nesta prévia e não fica guardada. Quando criarem a conta, escolham a foto de novo no Editor do site.',
      ),
    ).toBeInTheDocument();
    const drop = screen.getByLabelText(/Escolher uma foto/);
    await user.upload(drop, new File(['x'], 'a.gif', { type: 'image/gif' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível usar esta foto. Escolham uma foto JPG ou PNG.',
    );
    await user.upload(drop, new File(['x'], 'capa.jpg', { type: 'image/jpeg' }));
    await waitFor(() =>
      expect(container.querySelector('.kore-simule-preview__photo')).toHaveAttribute(
        'src',
        'blob:foto',
      ),
    );
    expect(window.localStorage.getItem(SITE_DRAFT_KEY)).not.toContain('blob');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      screen.getByText('A foto não vai para a conta. Vocês a escolhem de novo no Editor do site.'),
    ).toBeInTheDocument();
  });

  it('o Pronto leva o rascunho no fragmento aos três caminhos do app (RN08)', async () => {
    const user = userEvent.setup();
    render(<SimulatorPage search="?origem=site&utm_source=instagram" />);
    await fillToStyle(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(screen.getByRole('button', { name: 'Pular este passo' }));
    expect(
      screen.getByRole('heading', { name: 'O site de vocês já tem cara de casamento' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'O que vocês montarem fica guardado só neste navegador, por 7 dias, até criarem a conta.',
      ),
    ).toBeInTheDocument();
    const signIn =
      screen.getByRole('link', { name: 'Já têm conta? Entrar' }).getAttribute('href') ?? '';
    expect(signIn).toMatch(/^http:\/\/app\.test\/entrar\?next=couple_signup#simule=/);
    const draft = decodeDraft(signIn.split('#simule=')[1] ?? '');
    expect(draft).toMatchObject({
      names: ['Ana', 'Marcos'],
      eventDate: '2026-11-14',
      city: 'Campinas (SP)',
      origin: 'made_with_kore',
      utm: { source: 'instagram' },
      step: 'done',
    });
    await user.click(screen.getByRole('button', { name: /^Criar com e\W*mail$/ }));
    expect(assign).toHaveBeenLastCalledWith(
      expect.stringMatching(/^http:\/\/app\.test\/cadastro#simule=/),
    );
    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }));
    expect(assign).toHaveBeenLastCalledWith(
      expect.stringMatching(/^http:\/\/app\.test\/cadastro\?google=1#simule=/),
    );
    await waitFor(() => expect(events).toContain('simule_pronto'));
  });

  it('com rascunho guardado, o Retomar: continuar no passo em que parou, ou começar de novo (RN06)', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      SITE_DRAFT_KEY,
      JSON.stringify({
        ...emptyDraft({ now: new Date() }),
        names: ['Ana', 'Marcos'],
        step: 'when',
      }),
    );
    const { unmount } = render(<SimulatorPage search="" />);
    expect(screen.getByRole('heading', { name: 'Continuar de onde pararam?' })).toBeInTheDocument();
    expect(screen.getByText('Rascunho guardado')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar de onde pararam' }));
    expect(screen.getByRole('heading', { name: 'Quando e onde vai ser?' })).toBeInTheDocument();
    unmount();
    render(<SimulatorPage search="" />);
    await user.click(screen.getByRole('button', { name: 'Começar de novo' }));
    expect(screen.getByRole('textbox', { name: 'Seu nome' })).toHaveValue('');
  });

  it('o Retomar também aparece com o rascunho guardado no Pronto, e leva de volta ao Pronto', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      SITE_DRAFT_KEY,
      JSON.stringify({
        ...emptyDraft({ now: new Date() }),
        names: ['Ana', 'Marcos'],
        city: 'Campinas',
        noDate: true,
        step: 'done',
      }),
    );
    render(<SimulatorPage search="" />);
    await user.click(screen.getByRole('button', { name: 'Continuar de onde pararam' }));
    expect(
      screen.getByRole('heading', { name: 'O site de vocês já tem cara de casamento' }),
    ).toBeInTheDocument();
  });

  it('cada evento vai uma vez por aba (RN11)', async () => {
    const { unmount } = render(<SimulatorPage search="" />);
    await waitFor(() => expect(events).toEqual(['simule_iniciado']));
    unmount();
    render(<SimulatorPage search="" />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(events).toEqual(['simule_iniciado']);
  });

  it('é acessível', async () => {
    const { container } = render(<SimulatorPage search="" />);
    await expectNoA11yViolations({ container });
  });
});
