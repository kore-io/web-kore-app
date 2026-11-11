import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

/**
 * Telefone mascarado do Painel do grupo (RN13; decisão 186, item 11), com a mesma regra do
 * `maskPhone` do api-kore-api (a lista já recebe o `phoneMasked` do servidor; o painel
 * recebe o E.164, que o formulário de edição precisa, e mascara aqui).
 * Brasil: DDD, o 1º dígito e os 4 últimos ("(19) 9****-3310"; fixo "(19) 3***-3310").
 * Internacional: o código do país, o 1º dígito e os 3 últimos, em blocos de 3 a partir do
 * fim ("+351 9** *** 678").
 */
export function maskPhone({ e164 }: { e164: string }): string {
  const parsed = parsePhoneNumberFromString(e164);
  const countryCode = parsed?.countryCallingCode ?? '';
  const national = parsed?.nationalNumber ?? e164.replace(/\D/g, '');

  if (countryCode === '55') {
    const ddd = national.slice(0, 2);
    const local = national.slice(2);
    const hidden = '*'.repeat(Math.max(local.length - 5, 0));
    return `(${ddd}) ${local[0] ?? ''}${hidden}-${local.slice(-4)}`;
  }

  const masked =
    national.length <= 4
      ? national
      : `${national[0] ?? ''}${'*'.repeat(national.length - 4)}${national.slice(-3)}`;
  const blocks: string[] = [];
  for (let end = masked.length; end > 0; end -= 3) {
    blocks.unshift(masked.slice(Math.max(end - 3, 0), end));
  }
  return `+${countryCode} ${blocks.join(' ')}`;
}
