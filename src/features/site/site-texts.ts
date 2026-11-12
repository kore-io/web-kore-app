import type { TFunction } from 'i18next';

type SiteT = TFunction<'site'>;

/**
 * "salvo às 10h31"; com minuto zero, "salvo às 10h" (Voz; textos-f2), no fuso do
 * casamento (Dados básicos RN10).
 */
export function savedAtText({
  t,
  at,
  timezone,
}: {
  t: SiteT;
  at: string | null;
  timezone: string | null;
}): string | null {
  if (!at) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone ?? 'America/Sao_Paulo',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(at));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return t('savedAt', { time: `${hour}h${minute === '00' ? '' : minute}` });
}

const STATUS = ['awaiting_couple', 'draft', 'published', 'post_event', 'expired'] as const;
export type SiteStatus = (typeof STATUS)[number];

export function siteStatus(status: string): SiteStatus | null {
  return STATUS.find((item) => item === status) ?? null;
}

/** Hoje no fuso do casamento, como aaaa-mm-dd (a contagem conta no fuso dele, Seções RN06). */
export function todayIn({ timezone, now }: { timezone: string | null; now: Date }): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone ?? 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** "Faltam 49 dias" · "Falta 1 dia" · "É hoje"; depois do casamento, nada (Seções RN06). */
export function countdownText({
  t,
  eventDate,
  timezone,
  now,
}: {
  t: SiteT;
  eventDate: string | null;
  timezone: string | null;
  now: Date;
}): string | null {
  if (!eventDate) return null;
  const today = todayIn({ timezone, now });
  const days = Math.round(
    (Date.parse(`${eventDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (days < 0) return null;
  if (days === 0) return t('preview.today');
  return t('preview.countdown', { count: days });
}

const LONG_DATE = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "sábado, 14 de novembro de 2026 · Campinas", sem a parte que falta (Penpot, prévia). */
export function previewDateLine({
  eventDate,
  city,
}: {
  eventDate: string | null;
  city: string | null;
}): string | null {
  const parts = [eventDate && LONG_DATE.format(new Date(`${eventDate}T12:00:00Z`)), city].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(' · ') : null;
}
