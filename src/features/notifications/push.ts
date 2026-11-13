import {
  pushSubscriptionsControllerSubscribeV1,
  pushSubscriptionsControllerUnsubscribeV1,
} from '../../shared/api/generated/notifications/notifications';

/**
 * O push neste aparelho (Notificações por e-mail e push RN07; decisão 217(8)): o Web Push
 * com a chave VAPID que vem da API, pelo service worker do app.
 *
 * - `install`: o aparelho não recebe push sem instalar o Kore (iPhone e iPad fora da tela
 *   de início) ou o navegador não tem push;
 * - `denied`: o navegador bloqueou as notificações;
 * - `ready`: dá para ligar.
 */
export type PushAvailability = 'install' | 'denied' | 'ready';

function isAppleMobile(): boolean {
  const { userAgent, maxTouchPoints } = navigator;
  // O iPadOS se apresenta como Mac; o toque denuncia.
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

function isInstalled(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || window.matchMedia('(display-mode: standalone)').matches;
}

export function pushAvailability(): PushAvailability {
  const supported =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!supported || (isAppleMobile() && !isInstalled())) return 'install';
  if (Notification.permission === 'denied') return 'denied';
  return 'ready';
}

/** A chave VAPID em base64url vira os bytes que o PushManager pede. */
export function vapidKeyBytes(key: string): Uint8Array<ArrayBuffer> {
  const padded = `${key}${'='.repeat((4 - (key.length % 4)) % 4)}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = window.atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/**
 * Liga o push neste aparelho: pede a permissão, assina pelo service worker e registra a
 * assinatura na API (presa à sessão atual). Devolve `denied` se a pessoa não aceitou.
 */
export async function enablePush({
  vapidPublicKey,
}: {
  vapidPublicKey: string;
}): Promise<'enabled' | 'denied'> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyBytes(vapidPublicKey),
    }));
  const json = subscription.toJSON();
  try {
    await pushSubscriptionsControllerSubscribeV1({
      endpoint: subscription.endpoint,
      keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
    });
  } catch (error) {
    // Recusada (ex.: 400 PUSH_ENDPOINT_NOT_ALLOWED): o aparelho não fica assinado à toa.
    await subscription.unsubscribe().catch(() => undefined);
    throw error;
  }
  return 'enabled';
}

/** Desliga o push neste aparelho: apaga a assinatura na API e no navegador. */
export async function disablePush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await pushSubscriptionsControllerUnsubscribeV1({ endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}

/**
 * No Sair: a API já apaga as assinaturas da sessão (RN08); aqui só o navegador esquece a
 * dele, sem esperar e sem falhar o Sair.
 */
export async function forgetPushOnSignOut(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();
  } catch {
    // Sem service worker ou sem push: nada a esquecer.
  }
}
