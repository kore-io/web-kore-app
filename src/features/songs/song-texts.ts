/**
 * A data da sugestão na lista (Música RN05; textos-f4 R5): "12/09 às 20h14", a data curta
 * de tabela da Voz; na hora cheia, "20h".
 */
export function suggestedAtText({ at }: { at: string }): string {
  const date = new Date(at);
  const two = (value: number) => String(value).padStart(2, '0');
  const day = `${two(date.getDate())}/${two(date.getMonth() + 1)}`;
  const time =
    date.getMinutes() === 0
      ? `${date.getHours()}h`
      : `${date.getHours()}h${two(date.getMinutes())}`;
  return `${day} às ${time}`;
}
