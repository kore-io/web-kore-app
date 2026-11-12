import type { TFunction } from 'i18next';

/** Data do casamento como na Voz: "sáb., 20 de mar. de 2027" (a data é um dia, sem hora). */
export function formatWeddingDate({ isoDate }: { isoDate: string }) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

/**
 * Linha de apoio do cartão do casamento (Voz; decisão 152): data e cidade; sem data, só a
 * cidade; sem as duas, "Data a definir".
 */
export function weddingProfileDescription({
  t,
  isoDate,
  city,
  state,
}: {
  t: TFunction<'access'>;
  isoDate?: string;
  city?: string;
  state?: string;
}) {
  const place = city && state ? t('profiles.weddingPlace', { city, state }) : city;
  const date = isoDate ? formatWeddingDate({ isoDate }) : undefined;
  const parts = [date, place].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : t('profiles.dateToBeDefined');
}

/** Linha de apoio do cartão do cerimonialista (decisão 152: com 0, "Nenhum casamento ainda"). */
export function plannerProfileDescription({
  t,
  organization,
  weddingCount,
}: {
  t: TFunction<'access'>;
  organization: string;
  weddingCount: number;
}) {
  return t('profiles.plannerWeddings', { organization, count: weddingCount });
}

/** Data por extenso na prévia do site: "14 de novembro de 2026". */
export function formatLongDate({ isoDate }: { isoDate: string }) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T12:00:00Z`));
}
