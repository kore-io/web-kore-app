import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { meFor } from '../../../../tests/profile';
import {
  apiError,
  isLayoutRead,
  layoutReadNotFound,
  mockApi,
  renderRoute,
} from '../../../../tests/render-route';
import { me } from '../../site/sections/section-test-fixtures';

afterEach(() => vi.unstubAllGlobals());

type Call = { method: string; path: string; body: unknown };

function mockPreferences({
  save = 'ok',
  push = { vapidPublicKey: 'AQID', subscribed: false },
}: {
  save?: 'ok' | 'fail';
  push?: { vapidPublicKey: string | null; subscribed: boolean };
} = {}) {
  const calls: Call[] = [];
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(meFor(me));
    if (isLayoutRead({ method, path })) return layoutReadNotFound();
    if (path.startsWith('/v1/me/notification-preferences') && method === 'GET') {
      return Response.json({
        items: [{ type: 'rsvp', email: 'daily', inApp: true, push: false }],
        push,
      });
    }
    if (path.startsWith('/v1/me/notification-preferences') && method === 'PUT') {
      calls.push({ method, path, body });
      return save === 'ok'
        ? Response.json({ ...(body as object), inApp: true, push: false })
        : apiError({ status: 500, body: { error: 'INTERNAL' } });
    }
    if (path === '/v1/me/push-subscriptions') {
      calls.push({ method, path, body });
      return method === 'POST'
        ? Response.json({}, { status: 201 })
        : new Response(null, { status: 204 });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}

/** Um navegador com push: o service worker, a assinatura e a permissão. */
function stubPush({
  permission = 'default',
  request = 'granted',
  existing = false,
}: {
  permission?: NotificationPermission;
  request?: NotificationPermission;
  existing?: boolean;
} = {}) {
  const unsubscribe = vi.fn(() => Promise.resolve(true));
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    toJSON: () => ({ keys: { p256dh: 'p256', auth: 'auth' } }),
    unsubscribe,
  };
  const subscribe = vi.fn(() => Promise.resolve(subscription));
  const pushManager = {
    getSubscription: vi.fn(() => Promise.resolve(existing ? subscription : null)),
    subscribe,
  };
  vi.stubGlobal('navigator', {
    ...navigator,
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130',
    maxTouchPoints: 0,
    serviceWorker: { ready: Promise.resolve({ pushManager }) },
  });
  vi.stubGlobal('PushManager', function PushManager() {});
  vi.stubGlobal('Notification', {
    permission,
    requestPermission: vi.fn(() => Promise.resolve(request)),
  });
  return { subscribe, unsubscribe };
}

const PUSH = 'Push no celular (app instalado)';

describe('Configurações › Notificações (Central RN07; decisão 221)', () => {
  it('o título com a pessoa, a aba, a linha Respostas do convite e a nota da central', async () => {
    mockPreferences();
    renderRoute({ url: '/app/configuracoes/notificacoes' });
    expect(
      await screen.findByRole('heading', { name: 'Configurações', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ana Beatriz Moreira · ana.moreira@gmail.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notificações' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await screen.findByText('Respostas do convite')).toBeInTheDocument();
    expect(screen.getByText('Escolha como você quer receber cada aviso.')).toBeInTheDocument();
    const email = screen.getByRole('combobox', { name: /^E.?-.?mail$/u });
    expect(email).toHaveDisplayValue('Resumo diário às 20h');
    expect(
      Array.from((email as HTMLSelectElement).options).map((option) => option.textContent),
    ).toEqual(['Na hora', 'Resumo diário às 20h', 'Desligado']);
    expect(
      screen.getByText(
        'A central do app sempre recebe tudo. O push mostra só o nome do grupo, sem valores nem o texto do recado.',
      ),
    ).toBeInTheDocument();
  });

  it('mudar o e-mail grava na hora, com o Toast "Preferências salvas."', async () => {
    const user = userEvent.setup();
    const calls = mockPreferences();
    renderRoute({ url: '/app/configuracoes/notificacoes' });
    await user.selectOptions(
      await screen.findByRole('combobox', { name: /^E.?-.?mail$/u }),
      'Na hora',
    );
    expect(await screen.findByText('Preferências salvas.')).toBeInTheDocument();
    expect(calls[0]?.body).toEqual({ weddingId: 'w1', type: 'rsvp', email: 'immediate' });
  });

  it('a falha ao gravar: o Toast de erro e o valor de antes', async () => {
    const user = userEvent.setup();
    mockPreferences({ save: 'fail' });
    renderRoute({ url: '/app/configuracoes/notificacoes' });
    const email = await screen.findByRole('combobox', { name: /^E.?-.?mail$/u });
    await user.selectOptions(email, 'Desligado');
    expect(await screen.findByText(/^Não foi possível continuar/)).toBeInTheDocument();
    await waitFor(() => expect(email).toHaveDisplayValue('Resumo diário às 20h'));
  });

  it('sem push no navegador (ou o iPhone sem o app): desabilitado, com "instale o Kore" (RN07)', async () => {
    mockPreferences();
    renderRoute({ url: '/app/configuracoes/notificacoes' });
    const toggle = await screen.findByRole('switch', { name: PUSH });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAccessibleDescription('Para receber push, instale o Kore no seu celular.');
  });

  it('o navegador bloqueou: desligado, com o aviso de liberar', async () => {
    stubPush({ permission: 'denied' });
    mockPreferences();
    renderRoute({ url: '/app/configuracoes/notificacoes' });
    const toggle = await screen.findByRole('switch', { name: PUSH });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAccessibleDescription(
      'O navegador bloqueou as notificações do Kore. Libere nas configurações do navegador ou do aparelho.',
    );
  });

  it('ligar: pede a permissão, assina e registra o aparelho, com o Toast', async () => {
    const user = userEvent.setup();
    const { subscribe } = stubPush();
    const calls = mockPreferences();
    renderRoute({ url: '/app/configuracoes/notificacoes' });
    await user.click(await screen.findByRole('switch', { name: PUSH }));
    expect(await screen.findByText('Preferências salvas.')).toBeInTheDocument();
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(calls).toContainEqual({
      method: 'POST',
      path: '/v1/me/push-subscriptions',
      body: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        keys: { p256dh: 'p256', auth: 'auth' },
      },
    });
  });

  it('ligar e não aceitar a permissão: fica desligado, com o aviso do navegador', async () => {
    const user = userEvent.setup();
    const { subscribe } = stubPush({ request: 'denied' });
    mockPreferences();
    renderRoute({ url: '/app/configuracoes/notificacoes' });
    const toggle = await screen.findByRole('switch', { name: PUSH });
    await user.click(toggle);
    await waitFor(() =>
      expect(toggle).toHaveAccessibleDescription(/^O navegador bloqueou as notificações do Kore/),
    );
    expect(toggle).not.toBeChecked();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('desligar: apaga a assinatura deste aparelho na API e no navegador', async () => {
    const user = userEvent.setup();
    const { unsubscribe } = stubPush({ permission: 'granted', existing: true });
    const calls = mockPreferences({ push: { vapidPublicKey: 'AQID', subscribed: true } });
    renderRoute({ url: '/app/configuracoes/notificacoes' });
    const toggle = await screen.findByRole('switch', { name: PUSH });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(await screen.findByText('Preferências salvas.')).toBeInTheDocument();
    expect(calls).toContainEqual({
      method: 'DELETE',
      path: '/v1/me/push-subscriptions',
      body: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc' },
    });
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('sem a chave VAPID no ambiente: o push desabilitado, sem aviso', async () => {
    stubPush();
    mockPreferences({ push: { vapidPublicKey: null, subscribed: false } });
    renderRoute({ url: '/app/configuracoes/notificacoes' });
    const toggle = await screen.findByRole('switch', { name: PUSH });
    expect(toggle).toBeDisabled();
    expect(toggle).not.toHaveAccessibleDescription(/./);
  });

  it('é acessível', async () => {
    mockPreferences();
    const { container } = renderRoute({ url: '/app/configuracoes/notificacoes' });
    await screen.findByText('Respostas do convite');
    await expectNoA11yViolations({ container });
  });
});
