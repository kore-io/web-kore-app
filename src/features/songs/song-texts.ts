import { dayAndTimeIn } from '../../shared/date-texts';

/**
 * A data da sugestão na lista (Música RN05; textos-f4 R5): "12/09 às 20h14", a data curta
 * de tabela da Voz; na hora cheia, "20h". No fuso do casamento, como o .xlsx (decisão 246).
 */
export function suggestedAtText({ at, timezone }: { at: string; timezone: string | null }): string {
  const { date, time } = dayAndTimeIn({ at, timezone });
  return `${date} às ${time}`;
}
