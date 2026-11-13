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
