/**
 * A Content-Security-Policy do site do casal (Site público RN01). Sem `unsafe-inline` nem
 * `unsafe-eval`: o bundle só tem o script e as folhas de estilo do próprio site, e as
 * fontes vão como arquivo (o build do site não as embute como `data:`).
 *
 * - `connect-src`: o próprio site e a API (o site, a prévia, o RSVP e as métricas do Simule).
 * - `img-src`: o próprio site, as imagens do casal (o CDN) e o `blob:` da foto do Simule, que
 *   fica no aparelho.
 * - `frame-ancestors 'none'`: o site não abre dentro de outra página.
 */
export function siteCsp({
  apiUrl,
  imagesOrigin,
}: {
  /** O endereço da API (API_URL); sem ele, só o próprio site. */
  apiUrl?: string | undefined;
  /** A origem pública das imagens (IMAGES_ORIGIN); sem ela, só o próprio site. */
  imagesOrigin?: string | undefined;
} = {}): string {
  const api = originOf(apiUrl);
  const images = originOf(imagesOrigin);
  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    ['script-src', ["'self'"]],
    ['style-src', ["'self'"]],
    ['img-src', ["'self'", ...(images ? [images] : []), 'blob:']],
    ['font-src', ["'self'"]],
    ['connect-src', ["'self'", ...(api ? [api] : [])]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'none'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
  ];
  return directives.map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');
}

/** Só a origem (esquema, host e porta); um valor que não é URL fica de fora. */
function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const { origin } = new URL(value);
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}
