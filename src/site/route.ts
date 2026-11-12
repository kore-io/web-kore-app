/** O caminho do Confirmar presença: `/<slug>/confirmar-presenca` (decisão 232(1)). */
export const RSVP_SEGMENT = 'confirmar-presenca';

export function rsvpPath(slug: string): string {
  return `/${slug}/${RSVP_SEGMENT}`;
}

/** O que o endereço do site pede (Site público RN01 e RN06). */
export type SiteRoute =
  | { kind: 'simulator' }
  | { kind: 'site'; slug: string }
  | { kind: 'party'; slug: string; token: string }
  | { kind: 'rsvp'; slug: string }
  | { kind: 'none' };

/**
 * Lê o caminho: `/<slug>` e `/<slug>/grupo/<token>`. Qualquer outra forma (a raiz, mais
 * partes) não é um site, e a página diz que o endereço não existe.
 */
export function parseSiteRoute(
  pathname: string,
  /** O Simule só existe com a variável ligada (Simule RN01); desligado, não é um site. */
  simulatorEnabled: boolean = import.meta.env.VITE_SIMULATOR_ENABLED === 'true',
): SiteRoute {
  let parts: string[];
  try {
    parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    // Um "%" malformado no endereço (URIError): é um endereço que não existe.
    return { kind: 'none' };
  }
  const [slug, second, token] = parts;
  if (!slug) return { kind: 'none' };
  // `simule` é endereço reservado: nunca é o slug de um casamento.
  if (slug.toLowerCase() === 'simule' && parts.length === 1) {
    return simulatorEnabled ? { kind: 'simulator' } : { kind: 'none' };
  }
  if (parts.length === 1) return { kind: 'site', slug: slug.toLowerCase() };
  // Confirmar presença, página própria do grupo (decisão 232(1)).
  if (parts.length === 2 && second === RSVP_SEGMENT)
    return { kind: 'rsvp', slug: slug.toLowerCase() };
  if (parts.length === 3 && second === 'grupo' && token) {
    return { kind: 'party', slug: slug.toLowerCase(), token };
  }
  return { kind: 'none' };
}
