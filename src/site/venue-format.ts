/**
 * A data e a hora do cartão do local (Seções RN07; textos-f2): "Sáb., 14 de nov. de 2026 ·
 * 16h30", no horário local do casamento, sem conversão. Hora cheia sai "16h".
 */
const WEEKDAY = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function venueDateLine({
  date,
  time,
}: {
  date: string | null;
  time: string | null;
}): string {
  const parts: string[] = [];
  if (date) {
    const day = new Date(`${date}T12:00:00Z`);
    const weekday = WEEKDAY.format(day);
    parts.push(
      `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${DAY_MONTH_YEAR.format(day)}`,
    );
  }
  if (time) {
    const [hour = '0', minute = '00'] = time.split(':');
    parts.push(`${Number(hour)}h${minute === '00' ? '' : minute}`);
  }
  return parts.join(' · ');
}

/** Os botões de rota (RN07): a busca pelo endereço inteiro, com `encodeURIComponent`. */
export function routeLinks(address: string) {
  const query = encodeURIComponent(address);
  return {
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${query}`,
    waze: `https://waze.com/ul?q=${query}&navigate=yes`,
  };
}
