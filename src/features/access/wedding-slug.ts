/**
 * Endereço do site (RN04 do Cadastro): sugerido dos primeiros nomes, em minúsculas e sem
 * acento, no formato {nome1}-e-{nome2}; 3 a 40 caracteres, só a-z, 0-9 e hífen, sem hífen
 * no início, no fim ou repetido.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug({ slug }: { slug: string }) {
  return slug.length >= 3 && slug.length <= 40 && SLUG_PATTERN.test(slug);
}

function firstNameSlug({ name }: { name: string }) {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return first
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** A sugestão a partir dos nomes; vazia enquanto faltar um dos dois. */
export function suggestSlug({ myName, partnerName }: { myName: string; partnerName: string }) {
  const first = firstNameSlug({ name: myName });
  const second = firstNameSlug({ name: partnerName });
  if (!first || !second) return '';
  return `${first}-e-${second}`.slice(0, 40).replace(/-+$/, '');
}
