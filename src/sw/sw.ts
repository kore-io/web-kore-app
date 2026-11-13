/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | { url: string; revision: string | null })[];
};

/**
 * O service worker do app (Notificações por e-mail e push RN07; revisão técnica R8-5):
 * o precache do Workbox, como o `generateSW` de antes (autoUpdate, a navegação cai no
 * index.html), mais o `push` e o `notificationclick`. O site do casal não tem service
 * worker (S5 RN01).
 */
void self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

/** O que a API manda (o worker de push): só o nome do grupo, sem dado sensível. */
interface PushPayload {
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
}

const APP_NOTIFICATIONS = '/app/notificacoes';

function readPayload(event: PushEvent): PushPayload {
  try {
    return (event.data?.json() ?? {}) as PushPayload;
  } catch {
    return {};
  }
}

/** Mostra o aviso; a `tag` (o groupKey) troca o aviso do casamento, sem empilhar. */
self.addEventListener('push', (event) => {
  const payload = readPayload(event);
  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Kore', {
      body: payload.body ?? '',
      icon: '/kore-icon-192.png',
      badge: '/kore-icon-192.png',
      data: { url: payload.url ?? APP_NOTIFICATIONS },
      ...(payload.tag && { tag: payload.tag, renotify: true }),
    }),
  );
});

/** Tocar abre as Notificações no app (ou foca a aba do app que já estiver aberta). */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: string } | null;
  const target = new URL(data?.url ?? APP_NOTIFICATIONS, self.location.origin);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === target.origin);
      if (open) {
        try {
          await open.focus();
          await open.navigate(target.href);
          return;
        } catch {
          // A aba pode não estar sob este service worker (includeUncontrolled): o navigate()
          // lança; abre uma janela nova (sugestão do Crivo no C9).
        }
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
