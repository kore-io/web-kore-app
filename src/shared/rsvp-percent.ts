const PERCENT = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });

/**
 * A taxa de resposta em toda tela (decisão 258): o inteiro mais próximo, em pt-BR, sem
 * decimal ("62%"). A API devolve o `WeddingStats.rsvpPercent` com duas casas (66.67). O
 * 100% só aparece com todos respondidos e o 0% só com ninguém: de 0,01 a 0,99 vira 1%, e de
 * 99,01 a 99,99 vira 99%.
 */
export function formatRsvpPercent({ percent }: { percent: number }): string {
  const whole =
    percent <= 0
      ? 0
      : percent >= 100
        ? 100
        : percent < 1
          ? 1
          : percent > 99
            ? 99
            : Math.round(percent);
  return PERCENT.format(whole / 100);
}
