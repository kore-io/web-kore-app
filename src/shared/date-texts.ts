const SHORT = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const SHORT_YEAR = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** A data por extenso curto, sem o ano corrente: "15 de out." (R2 e R3 das F4 e F5). */
export function shortDayMonth({ day, now }: { day: string; now: Date }): string {
  const date = new Date(`${day}T12:00:00Z`);
  return (date.getUTCFullYear() === now.getFullYear() ? SHORT : SHORT_YEAR).format(date);
}

/** A abreviação do mês já termina em ponto ("15 de out."): um ponto só na frase. */
export function oneDot(text: string): string {
  return text.replace(/\.\./g, '.');
}

/** "14 de nov. de 2027", sempre com o ano (a ajuda dos limites da data de saída do ar). */
export function shortDate(day: string): string {
  return SHORT_YEAR.format(new Date(`${day}T12:00:00Z`));
}

/** O fuso de quando o casamento não tem um (o padrão das telas e do .xlsx). */
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/**
 * A data curta e a hora de um instante no fuso do casamento, como no .xlsx (decisão 246):
 * "12/09" e "20h14"; na hora cheia, "20h" (Voz).
 */
export function dayAndTimeIn({ at, timezone }: { at: string; timezone: string | null }) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone ?? DEFAULT_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(at));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  const hour = Number(part('hour'));
  const minute = part('minute');
  return {
    date: `${part('day')}/${part('month')}`,
    time: minute === '00' ? `${hour}h` : `${hour}h${minute}`,
  };
}
