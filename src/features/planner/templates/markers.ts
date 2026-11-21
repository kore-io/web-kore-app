/** A data por extenso, "14 de novembro de 2026", da data sem hora (sem passar por fuso). */
const LONG = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export interface MarkerData {
  /** Os nomes do casal como estão no site; vale o primeiro nome de cada um. */
  partnerNames: readonly string[];
  /** aaaa-mm-dd, ou nulo quando o casal ainda não tem data. */
  eventDate: string | null;
  city: string | null;
}

/** "Ana e Marcos": os primeiros nomes do casal (RN07). */
export function coupleFirstNames(partnerNames: readonly string[]): string {
  return partnerNames
    .map((name) => name.trim().split(/\s+/)[0] ?? '')
    .filter(Boolean)
    .join(' e ');
}

export function longDate(day: string): string {
  return LONG.format(new Date(`${day.slice(0, 10)}T12:00:00Z`));
}

/**
 * Troca {casal}, {data} e {cidade} pelos dados do casal (Modelos RN07): numa passada só (o
 * valor que traz um marcador não é trocado de novo), como texto simples, e o marcador sem
 * dado fica no texto, à vista. Outros textos entre chaves ficam como estão.
 */
export function applyMarkers({ text, data }: { text: string; data: MarkerData }): {
  text: string;
  missingDate: boolean;
} {
  const values: Record<string, string | null> = {
    casal: coupleFirstNames(data.partnerNames) || null,
    data: data.eventDate ? longDate(data.eventDate) : null,
    cidade: data.city?.trim() || null,
  };
  let missingDate = false;
  const result = text.replace(/\{(casal|data|cidade)\}/g, (marker, name: string) => {
    const value = values[name];
    if (value) return value;
    if (name === 'data') missingDate = true;
    return marker;
  });
  return { text: result, missingDate };
}
