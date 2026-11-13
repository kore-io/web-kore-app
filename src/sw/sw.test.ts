// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('workbox-core', () => ({ clientsClaim: vi.fn() }));
vi.mock('workbox-precaching', () => ({
  cleanupOutdatedCaches: vi.fn(),
  createHandlerBoundToURL: vi.fn(() => 'handler'),
  precacheAndRoute: vi.fn(),
}));
vi.mock('workbox-routing', () => ({
  NavigationRoute: vi.fn(),
  registerRoute: vi.fn(),
}));

type Listener = (event: unknown) => void;

/** O `self` do service worker, simulado: os listeners, o showNotification e os clients. */
const listeners: Record<string, Listener> = {};
const showNotification = vi.fn(() => Promise.resolve());
const matchAll = vi.fn<() => Promise<unknown[]>>(() => Promise.resolve([]));
const openWindow = vi.fn(() => Promise.resolve(null));

beforeAll(async () => {
  Object.assign(globalThis, {
    self: {
      __WB_MANIFEST: [],
      location: { origin: 'https://app.kore.com.br' },
      skipWaiting: vi.fn(() => Promise.resolve()),
      addEventListener: (type: string, listener: Listener) => {
        listeners[type] = listener;
      },
      registration: { showNotification },
      clients: { matchAll, openWindow },
    },
  });
  await import('./sw');
});

/** Dispara o evento e espera o que ele passou ao `waitUntil`. */
async function dispatch(type: string, event: object) {
  let work: Promise<unknown> = Promise.resolve();
  listeners[type]?.({ ...event, waitUntil: (promise: Promise<unknown>) => (work = promise) });
  await work;
}

describe('o service worker (Notificações e push RN07; R8-5)', () => {
  it('o push mostra o aviso com o título, o texto, a tag e o renotify', async () => {
    await dispatch('push', {
      data: {
        json: () => ({
          title: 'Kore',
          body: 'Família Moreira respondeu o convite',
          tag: 'rsvp:w1',
          url: 'https://app.kore.com.br/app/notificacoes',
        }),
      },
    });
    expect(showNotification).toHaveBeenCalledWith(
      'Kore',
      expect.objectContaining({
        body: 'Família Moreira respondeu o convite',
        tag: 'rsvp:w1',
        renotify: true,
        data: { url: 'https://app.kore.com.br/app/notificacoes' },
      }),
    );
  });

  it('o push sem dados ou com JSON quebrado mostra o aviso padrão, sem tag', async () => {
    showNotification.mockClear();
    await dispatch('push', {
      data: {
        json: () => {
          throw new SyntaxError('x');
        },
      },
    });
    const [title, options] = showNotification.mock.calls[0] as unknown as [string, object];
    expect(title).toBe('Kore');
    expect(options).toMatchObject({ body: '', data: { url: '/app/notificacoes' } });
    expect(options).not.toHaveProperty('tag');
  });

  it('tocar com a aba do app aberta foca e navega', async () => {
    const focus = vi.fn(() => Promise.resolve());
    const navigate = vi.fn(() => Promise.resolve());
    matchAll.mockResolvedValueOnce([{ url: 'https://app.kore.com.br/app', focus, navigate }]);
    const close = vi.fn();
    await dispatch('notificationclick', {
      notification: { close, data: { url: 'https://app.kore.com.br/app/notificacoes' } },
    });
    expect(close).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('https://app.kore.com.br/app/notificacoes');
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('a aba fora do service worker (o navigate lança) abre uma janela nova', async () => {
    const navigate = vi.fn(() => Promise.reject(new TypeError('not controlled')));
    matchAll.mockResolvedValueOnce([
      { url: 'https://app.kore.com.br/app', focus: () => Promise.resolve(), navigate },
    ]);
    await dispatch('notificationclick', { notification: { close: vi.fn(), data: null } });
    expect(openWindow).toHaveBeenCalledWith('https://app.kore.com.br/app/notificacoes');
  });

  it('sem aba do app, abre as Notificações', async () => {
    openWindow.mockClear();
    matchAll.mockResolvedValueOnce([]);
    await dispatch('notificationclick', {
      notification: { close: vi.fn(), data: { url: '/app/notificacoes' } },
    });
    expect(openWindow).toHaveBeenCalledWith('https://app.kore.com.br/app/notificacoes');
  });
});
