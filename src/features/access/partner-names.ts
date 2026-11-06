/** O primeiro nome ("Ana Beatriz Moreira" → "Ana"). */
function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * Os nomes do Quem é você? (decisão 182): o primeiro nome de cada noivo, como no Penpot e
 * no wedding.names (168(7)); se os dois primeiros nomes forem iguais, os nomes completos,
 * para a pessoa saber qual é ela.
 */
export function whoAreYouNames({ names }: { names: [string, string] }): [string, string] {
  const [first, second] = names;
  const short: [string, string] = [firstName(first), firstName(second)];
  return short[0].localeCompare(short[1], 'pt-BR', { sensitivity: 'base' }) === 0
    ? [first.trim(), second.trim()]
    : short;
}
