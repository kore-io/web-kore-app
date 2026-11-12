import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';
import { redirectTo } from '../../../shared/browser/redirect';
import {
  APP_DRAFT_KEY,
  emptyDraft,
  encodeDraft,
  type SimulatorDraft,
} from '../../../shared/simulator/draft';
import { destinationAfterLogin } from '../login-navigation';
import { captureSimulatorDraft } from '../simulator-draft';

vi.mock('../../../shared/browser/redirect', () => ({ redirectTo: vi.fn(), reloadPage: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

function draft(overrides: Partial<SimulatorDraft> = {}): SimulatorDraft {
  return {
    ...emptyDraft({ now: new Date(), origin: 'made_with_kore', utm: { source: 'instagram' } }),
    names: ['Ana', 'Marcos'],
    eventDate: '2026-11-14',
    city: 'Campinas',
    step: 'done',
    ...overrides,
  };
}

function store(value: SimulatorDraft) {
  window.localStorage.setItem(APP_DRAFT_KEY, JSON.stringify(value));
}

const meBody = (memberships: { role: string; weddingId: string }[] = []) => ({
  user: { id: 'u1', name: null, email: 'ana@exemplo.com', platformRole: 'none' },
  activeProfile: null,
  authenticatedAt: '2026-11-05T12:00:00Z',
  memberships,
});

const noSession = () => apiError({ status: 401, body: { error: 'SESSION_EXPIRED' } });

const available = ({ path }: { path: string }) =>
  path.startsWith('/v1/weddings/slug-availability')
    ? Response.json({
        slug: new URLSearchParams(path.split('?')[1]).get('slug'),
        available: true,
        reason: null,
        suggestion: null,
      })
    : undefined;

describe('Cadastro com o rascunho do Simule (Cadastro RN12; Simule RN08 a RN10)', () => {
  it('o fragmento #simule= é validado, guardado e sai da URL; o inválido é ignorado', () => {
    const encoded = encodeDraft(draft()) ?? '';
    window.history.replaceState(null, '', `/cadastro?google=1#simule=${encoded}`);
    expect(captureSimulatorDraft()).toBe(true);
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?google=1');
    expect(JSON.parse(window.localStorage.getItem(APP_DRAFT_KEY) ?? '{}')).toMatchObject({
      names: ['Ana', 'Marcos'],
    });
    window.localStorage.clear();
    window.history.replaceState(null, '', '/cadastro#simule=estragado');
    expect(captureSimulatorDraft()).toBe(true);
    expect(window.location.hash).toBe('');
    expect(window.localStorage.getItem(APP_DRAFT_KEY)).toBeNull();
    expect(captureSimulatorDraft()).toBe(false);
  });

  it('o Início com rascunho: "Falta só criar a conta.", a prévia e o Entrar que volta ao cadastro', async () => {
    store(draft());
    mockApi(({ path }) => (path === '/v1/me' ? noSession() : noSession()));
    renderRoute({ url: '/cadastro' });
    expect(
      await screen.findByRole('heading', { name: 'Falta só criar a conta.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'O site de vocês está guardado só neste navegador. Ele vira o casamento quando criarem a conta.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Ana & Marcos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('14 de novembro de 2026 · Campinas').length).toBeGreaterThan(0);
    expect(screen.getByText(/Já têm conta\?/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      '/entrar?next=couple_signup',
    );
  });

  it('?google=1 começa o login com o Google sozinho, com a origem do cadastro', async () => {
    store(draft());
    mockApi(() => noSession());
    renderRoute({ url: '/cadastro?google=1' });
    await waitFor(() => expect(redirectTo).toHaveBeenCalledOnce());
    expect(vi.mocked(redirectTo).mock.calls[0]?.[0].url).toContain('origin=couple_signup');
  });

  it('os Dados do casamento preenchidos, sem noivo ou noiva nem UF, com a Aparência do simulador; o POST leva a aparência e a origem, e o rascunho sai', async () => {
    const user = userEvent.setup();
    store(
      draft({
        starterPaletteKey: 'salvia',
        primaryColor: '#566C4B',
        accentColor: '#C9A66B',
        backgroundMode: 'light',
        fontPairKey: 'classico',
      }),
    );
    let created: unknown;
    mockApi((request) => {
      if (request.path === '/v1/me') return Response.json(meBody());
      if (request.method === 'POST' && request.path === '/v1/weddings') {
        created = request.body;
        return Response.json(
          {
            weddingId: 'w1',
            slug: 'ana-e-marcos',
            status: 'draft',
            timezone: 'America/Sao_Paulo',
            referrer: null,
          },
          { status: 201 },
        );
      }
      return available(request) ?? apiError({ status: 404, body: { error: 'X' } });
    });
    renderRoute({ url: '/cadastro' });
    const myName = await screen.findByRole('textbox', { name: 'Seu nome' });
    expect(myName).toHaveValue('Ana');
    expect(myName).toHaveAccessibleDescription('Veio do simulador. Confira se é o seu.');
    expect(screen.getByRole('textbox', { name: 'Com quem você vai casar?' })).toHaveValue('Marcos');
    expect(screen.getByLabelText('Data do casamento')).toHaveValue('2026-11-14');
    expect(screen.getByRole('textbox', { name: 'Cidade' })).toHaveValue('Campinas');
    expect(screen.getByRole('combobox', { name: 'UF' })).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Noiva' })).not.toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Endereço do site' })).toHaveValue('ana-e-marcos');
    const appearance = screen.getByRole('group', { name: 'Aparência do simulador' });
    expect(within(appearance).getByText('Sálvia · Clássico')).toBeInTheDocument();
    expect(appearance).toHaveAccessibleDescription('Dá para mudar depois no Editor do site.');
    await user.click(screen.getByRole('radio', { name: 'Noiva' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'UF' }), 'SP');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Criar nosso site' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Criar nosso site' }));
    await screen.findByRole('heading', { level: 1, name: 'Convide Marcos' });
    expect(created).toMatchObject({
      myName: 'Ana',
      partnerName: 'Marcos',
      eventDate: '2026-11-14',
      city: 'Campinas',
      state: 'SP',
      signupSource: 'made_with_kore',
      utmSource: 'instagram',
      appearance: {
        fontPairKey: 'classico',
        starterPaletteKey: 'salvia',
        primaryColor: '#566C4B',
        accentColor: '#C9A66B',
        backgroundMode: 'light',
      },
    });
    expect(window.localStorage.getItem(APP_DRAFT_KEY)).toBeNull();
  });

  it('cor própria: "Cor própria · Romântico" (226(6)); "Ainda não sabemos a data" deixa a data em branco', async () => {
    store(
      draft({ starterPaletteKey: null, primaryColor: '#3E5C8A', noDate: true, eventDate: null }),
    );
    mockApi((request) =>
      request.path === '/v1/me' ? Response.json(meBody()) : (available(request) ?? noSession()),
    );
    renderRoute({ url: '/cadastro' });
    const appearance = await screen.findByRole('group', { name: 'Aparência do simulador' });
    expect(within(appearance).getByText('Cor própria · Romântico')).toBeInTheDocument();
    expect(screen.getByLabelText('Data do casamento')).toHaveValue('');
  });

  it('quem já é dono vê "Você já tem um casamento no Kore." e o rascunho fica (RN06)', async () => {
    store(draft());
    mockApi((request) =>
      request.path === '/v1/me'
        ? Response.json(meBody([{ role: 'owner', weddingId: 'w9' }]))
        : noSession(),
    );
    renderRoute({ url: '/cadastro' });
    expect(
      await screen.findByRole('heading', { name: 'Você já tem um casamento no Kore.' }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(APP_DRAFT_KEY)).not.toBeNull();
  });

  it('o Entrar com next=couple_signup volta ao cadastro, também para quem tem outros perfis', () => {
    expect(destinationAfterLogin({ next: 'choose_profile', returnPath: '/cadastro' })).toEqual({
      kind: 'route',
      path: '/cadastro',
    });
    expect(destinationAfterLogin({ next: 'home', returnPath: '/cadastro' })).toEqual({
      kind: 'route',
      path: '/cadastro',
    });
    expect(destinationAfterLogin({ next: 'choose_profile' })).toEqual({
      kind: 'route',
      path: '/perfis',
    });
  });
});
