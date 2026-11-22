import type { TFunction } from 'i18next';
import { dayAndTimeIn } from '../../shared/date-texts';

export type DeliveryKind = 'invite' | 'save_the_date' | 'reminder';
export type DeliveryChannel = 'whatsapp' | 'email' | 'link' | 'qr';

/**
 * O status no cartão da fila (Envios RN07): "Enviado às 10h42 pelo WhatsApp" (hoje) ·
 * "Enviado em 02/09 às 10h42 pelo WhatsApp" (outro dia) · "… por e-mail" · "Mensagem
 * copiada às 10h42". O QR tem o próprio Toast (RN09); sem envio, nulo. A hora e o "hoje" no
 * fuso do casamento (decisão 248).
 */
export function deliveryStatusText({
  t,
  at,
  channel,
  now,
  timezone,
}: {
  t: TFunction<'deliveries'>;
  at: string | null;
  channel: DeliveryChannel | null;
  now: Date;
  timezone: string | null;
}): string | null {
  if (!at || !channel || channel === 'qr') return null;
  const sent = dayAndTimeIn({ at, timezone });
  const today = sent.day === dayAndTimeIn({ at: now.toISOString(), timezone }).day;
  const { date, time } = sent;
  if (channel === 'link') {
    return today
      ? t('queue.status.copiedToday', { time })
      : t('queue.status.copiedOn', { date, time });
  }
  const by = channel === 'whatsapp' ? t('queue.status.byWhatsapp') : t('queue.status.byEmail');
  return today
    ? t('queue.status.sentToday', { time, channel: by })
    : t('queue.status.sentOn', { date, time, channel: by });
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
