import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { apiError, mockApi, renderRoute } from '../../../../tests/render-route';

afterEach(() => vi.unstubAllGlobals());

const PAGE = '/cerimonialista/configuracoes/notificacoes';

const me = {
  user: { id: 'u1', name: 'Juliana Prado', email: 'juliana@prado.com.br', platformRole: 'none' },
  activeProfile: 'planner',
  authenticatedAt: '2026-11-21T12:00:00Z',
  memberships: [],
  profiles: ['planner'],
  lastProfileOnDevice: 'planner',
  planner: { organization: 'Prado Assessoria', weddingsCount: 1 },
  referrer: null,
  plannerSignupEnabled: true,
  identities: [{ provider: 'email' }],
};

type Call = { method: string; path: string; body: unknown };

function api({ save = 'ok' }: { save?: 'ok' | 'fail' } = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(me);
    if (path.startsWith('/v1/me/notifications/unread-count')) {
      return Response.json({ unreadCount: 0 });
    }
    if (path.startsWith('/v1/me/notification-preferences') && method === 'GET') {
      calls.push({ method, path, body });
      return Response.json({
        items: [
          { type: 'rsvp', email: 'daily', inApp: true, emailEditable: true, push: false },
          {
            type: 'wedding_published',
            email: 'daily',
            inApp: true,
            emailEditable: false,
            push: false,
          },
          {
            type: 'membership_removed',
            email: 'off',
            inApp: true,
            emailEditable: false,
            push: false,
          },
        ],
        push: { vapidPublicKey: 'AQID', subscribed: false },
      });
    }
    if (path.startsWith('/v1/me/notification-preferences') && method === 'PUT') {
      calls.push({ method, path, body });
      return save === 'ok'
        ? Response.json({ ...(body as object), inApp: true, push: false })
        : apiError({ status: 500, body: { error: 'INTERNAL' } });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

/** Um navegador com push pronto (permissão ainda não pedida). */
function stubPush() {
  vi.stubGlobal('navigator', {
    ...navigator,
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130',
    maxTouchPoints: 0,
    serviceWorker: { ready: new Promise(() => undefined) },
  });
  vi.stubGlobal('PushManager', function PushManager() {});
  vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() });
}

const row = (name: string) => screen.getByRole('group', { name });

describe('Configurações › Notificações da cerimonialista (RN06; decisões 274(4) e 300)', () => {
  it('as preferências gerais: as 3 linhas, a central sempre ligada e a matriz com os motivos', async () => {
    stubPush();
    const calls = api();
    const { container } = renderRoute({ url: PAGE });
    expect(
      await screen.findByText('Escolha como você quer receber cada aviso.'),
    ).toBeInTheDocument();
    // Sem weddingId: a preferência geral.
    expect(calls[0]?.path).toBe('/v1/me/notification-preferences');

    const rsvp = row('Novas respostas');
    expect(within(rsvp).getByRole('switch', { name: 'Novas respostas, Central' })).toBeChecked();
    expect(within(rsvp).getByRole('switch', { name: 'Novas respostas, Central' })).toBeDisabled();
    // O motivo da Central, só para o leitor de tela (decisão 302(1)).
    expect(
      within(rsvp).getByRole('switch', { name: 'Novas respostas, Central' }),
    ).toHaveAccessibleDescription('A central sempre recebe este aviso.');
    const rsvpEmail = within(rsvp).getByRole('combobox', { name: 'Novas respostas, E-⁠mail' });
    expect(rsvpEmail).toBeEnabled();
    expect(rsvpEmail).toHaveDisplayValue('Resumo diário às 20h');
    expect(within(rsvp).getByRole('switch', { name: 'Novas respostas, Push' })).toBeEnabled();

    const published = row('Casamento publicado');
    const publishedEmail = within(published).getByRole('combobox', {
      name: 'Casamento publicado, E-⁠mail',
    });
    expect(publishedEmail).toBeDisabled();
    expect(publishedEmail).toHaveDisplayValue('Resumo diário às 20h');
    expect(publishedEmail).toHaveAccessibleDescription('Este aviso chega só no resumo diário.');
    const publishedPush = within(published).getByRole('switch', {
      name: 'Casamento publicado, Push',
    });
    expect(publishedPush).toBeDisabled();
    expect(publishedPush).toHaveAccessibleDescription('Este aviso não chega por push.');

    const removed = row('Colaboração encerrada');
    const removedEmail = within(removed).getByRole('combobox', {
      name: 'Colaboração encerrada, E-⁠mail',
    });
    expect(removedEmail).toBeDisabled();
    expect(removedEmail).toHaveDisplayValue('Desligado');
    expect(removedEmail).toHaveAccessibleDescription('Este aviso aparece só na central.');
    const removedPush = within(removed).getByRole('switch', {
      name: 'Colaboração encerrada, Push',
    });
    expect(removedPush).toBeDisabled();
    expect(removedPush).toHaveAccessibleDescription('Este aviso aparece só na central.');
    // O motivo comum aparece uma vez.
    expect(within(removed).getAllByText('Este aviso aparece só na central.')).toHaveLength(1);

    // Com push no navegador, sem o aviso de instalar.
    expect(screen.queryByText('Para receber push, instale o Kore no seu celular.')).toBeNull();
    await expectNoA11yViolations({ container });
  });

  it('o e-mail de Novas respostas grava a preferência geral, sem weddingId, com o Toast', async () => {
    stubPush();
    const user = userEvent.setup();
    const calls = api();
    renderRoute({ url: PAGE });
    await screen.findByText('Escolha como você quer receber cada aviso.');
    await user.selectOptions(
      within(row('Novas respostas')).getByRole('combobox', { name: 'Novas respostas, E-⁠mail' }),
      'immediate',
    );
    expect(await screen.findByText('Preferências salvas.')).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'PUT')).toEqual([
      {
        method: 'PUT',
        path: '/v1/me/notification-preferences',
        body: { type: 'rsvp', email: 'immediate' },
      },
    ]);
  });

  it('a falha ao gravar volta o e-mail ao que estava, com o aviso', async () => {
    stubPush();
    const user = userEvent.setup();
    api({ save: 'fail' });
    renderRoute({ url: PAGE });
    await screen.findByText('Escolha como você quer receber cada aviso.');
    const email = within(row('Novas respostas')).getByRole('combobox', {
      name: 'Novas respostas, E-⁠mail',
    });
    await user.selectOptions(email, 'off');
    expect(await screen.findByText(/Não foi possível continuar/)).toBeInTheDocument();
    await waitFor(() => expect(email).toHaveDisplayValue('Resumo diário às 20h'));
  });

  it('o navegador bloqueando: o aviso de liberar embaixo, como o do casal (decisão 302(1))', async () => {
    stubPush();
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() });
    api();
    renderRoute({ url: PAGE });
    expect(
      await screen.findByText(
        'O navegador bloqueou as notificações do Kore. Libere nas configurações do navegador ou do aparelho.',
      ),
    ).toBeInTheDocument();
    expect(
      within(row('Novas respostas')).getByRole('switch', { name: 'Novas respostas, Push' }),
    ).toBeDisabled();
  });

  it('sem push no navegador: o Push desabilitado e o aviso de instalar embaixo (Penpot 15)', async () => {
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: undefined });
    api();
    renderRoute({ url: PAGE });
    expect(
      await screen.findByText('Para receber push, instale o Kore no seu celular.'),
    ).toBeInTheDocument();
    expect(
      within(row('Novas respostas')).getByRole('switch', { name: 'Novas respostas, Push' }),
    ).toBeDisabled();
  });
});
