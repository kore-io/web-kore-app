import type { TFunction } from 'i18next';

export type DeliveryKind = 'invite' | 'save_the_date' | 'reminder';
export type DeliveryChannel = 'whatsapp' | 'email' | 'link' | 'qr';

const two = (value: number) => String(value).padStart(2, '0');
const time = (at: Date) =>
  at.getMinutes() === 0 ? `${at.getHours()}h` : `${at.getHours()}h${two(at.getMinutes())}`;
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * O status no cartão da fila (Envios RN07): "Enviado às 10h42 pelo WhatsApp" (hoje) ·
 * "Enviado em 02/09 às 10h42 pelo WhatsApp" (outro dia) · "… por e-mail" · "Mensagem
 * copiada às 10h42". O QR tem o próprio Toast (RN09); sem envio, nulo.
 */
export function deliveryStatusText({
  t,
  at,
  channel,
  now,
}: {
  t: TFunction<'deliveries'>;
  at: string | null;
  channel: DeliveryChannel | null;
  now: Date;
}): string | null {
  if (!at || !channel || channel === 'qr') return null;
  const date = new Date(at);
  const today = sameDay(date, now);
  const day = `${two(date.getDate())}/${two(date.getMonth() + 1)}`;
  if (channel === 'link') {
    return today
      ? t('queue.status.copiedToday', { time: time(date) })
      : t('queue.status.copiedOn', { date: day, time: time(date) });
  }
  const by = channel === 'whatsapp' ? t('queue.status.byWhatsapp') : t('queue.status.byEmail');
  return today
    ? t('queue.status.sentToday', { time: time(date), channel: by })
    : t('queue.status.sentOn', { date: day, time: time(date), channel: by });
}

/** Quando o grupo recebeu este tipo de envio, pelo que a fila devolve (RN03). */
export function sentAtOf({
  kind,
  item,
}: {
  kind: DeliveryKind;
  item: {
    sentAt: string | null;
    saveTheDateSentAt?: string | null;
    lastReminderAt?: string | null;
  };
}): string | null {
  if (kind === 'save_the_date') return item.saveTheDateSentAt ?? null;
  if (kind === 'reminder') return item.lastReminderAt ?? null;
  return item.sentAt;
}

/** O convite e o lembrete precisam do {link} (RN06; 422 LINK_PLACEHOLDER_MISSING). */
export function needsLink(kind: DeliveryKind): boolean {
  return kind !== 'save_the_date';
}

export function hasLinkPlaceholder(body: string): boolean {
  return body.includes('{link}');
}
