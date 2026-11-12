/** O que o endereço do site pede (Site público RN01 e RN06). */
export type SiteRoute =
  | { kind: 'site'; slug: string }
  | { kind: 'party'; slug: string; token: string }
  | { kind: 'none' };

/**
 * Lê o caminho: `/<slug>` e `/<slug>/grupo/<token>`. Qualquer outra forma (a raiz, mais
 * partes) não é um site, e a página diz que o endereço não existe.
 */
export function parseSiteRoute(pathname: string): SiteRoute {
  let parts: string[];
  try {
    parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    // Um "%" malformado no endereço (URIError): é um endereço que não existe.
    return { kind: 'none' };
  }
  const [slug, second, token] = parts;
  if (!slug) return { kind: 'none' };
  if (parts.length === 1) return { kind: 'site', slug: slug.toLowerCase() };
  if (parts.length === 3 && second === 'grupo' && token) {
    return { kind: 'party', slug: slug.toLowerCase(), token };
  }
  return { kind: 'none' };
}
