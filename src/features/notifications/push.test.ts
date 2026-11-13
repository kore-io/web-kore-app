import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetPushOnSignOut, pushAvailability, vapidKeyBytes } from './push';

afterEach(() => vi.unstubAllGlobals());

function stubBrowser({
  userAgent = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130',
  permission = 'default',
  standalone = false,
}: { userAgent?: string; permission?: NotificationPermission; standalone?: boolean } = {}) {
  vi.stubGlobal('navigator', {
    ...navigator,
    userAgent,
    maxTouchPoints: 0,
    serviceWorker: {},
    standalone,
  });
  vi.stubGlobal('PushManager', function PushManager() {});
  vi.stubGlobal('Notification', { permission });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  );
}

describe('o push neste aparelho (Notificações e push RN07)', () => {
  it('sem push no navegador: instalar', () => {
    expect(pushAvailability()).toBe('install');
  });

  it('com push: pronto; bloqueado: negado', () => {
    stubBrowser();
    expect(pushAvailability()).toBe('ready');
    stubBrowser({ permission: 'denied' });
    expect(pushAvailability()).toBe('denied');
  });

  it('no iPhone, só com o app instalado na tela de início', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Safari/604.1';
    stubBrowser({ userAgent: iphone });
    expect(pushAvailability()).toBe('install');
    stubBrowser({ userAgent: iphone, standalone: true });
    expect(pushAvailability()).toBe('ready');
  });

  it('a chave VAPID em base64url vira os bytes', () => {
    expect(Array.from(vapidKeyBytes('AQID-_8'))).toEqual([1, 2, 3, 251, 255]);
  });

  it('no Sair, o navegador esquece a assinatura; sem service worker, não falha (RN08)', async () => {
    const unsubscribe = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: {
        getRegistration: () =>
          Promise.resolve({
            pushManager: { getSubscription: () => Promise.resolve({ unsubscribe }) },
          }),
      },
    });
    await forgetPushOnSignOut();
    expect(unsubscribe).toHaveBeenCalled();
    vi.unstubAllGlobals();
    await expect(forgetPushOnSignOut()).resolves.toBeUndefined();
  });
});
