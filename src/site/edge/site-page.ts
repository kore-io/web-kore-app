/**
 * A Pages Function do site do casal (Site público RN01 a RN03 e RN09): responde
 * `/<slug>` e `/<slug>/grupo/<token>` com o HTML do bundle e as metatags da prévia do link.
 *
 * - Só lê o `slug` do caminho; o token do grupo nunca é usado nem registrado (sem
 *   `console.log` do request), porque o link inteiro é o convite (RN06).
 * - A prévia vem do `GET /v1/public/sites/{slug}/preview`: publicado, os nomes e a og.jpg
 *   da capa; rascunho ou endereço que não existe, a prévia genérica do Kore, sem nome.
 * - Sempre `noindex`, `private, no-store` e `no-referrer` (RN02 e RN03).
 * - Se a API falhar ou passar de 2,5 s, sai o HTML com a prévia genérica: o site carrega e
 *   mostra o dele.
 */

export interface SitePageEnv {
  /** O endereço da API (ex.: https://api.kore.com.br). */
  API_URL: string;
  /**
   * Outra imagem padrão do Kore para a prévia genérica e sem capa (1200 × 630, até 300 KB).
   * Sem ela, vale a `og-kore.jpg` servida pelo próprio site (site/public).
   */
  DEFAULT_OG_IMAGE?: string;
  /** Os arquivos estáticos do Pages (o HTML do bundle). */
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export interface LinkPreview {
  state: 'published' | 'generic';
  title: string | null;
  description: string | null;
  image: { url: string; width: number; height: number } | null;
}

/** A prévia genérica do Kore (RN09), sem nenhum nome. */
export const GENERIC_PREVIEW = {
  title: 'Kore',
  description: 'Lista de convidados, site e confirmações num lugar só.',
};

/** A imagem padrão do Kore, servida pelo site (site/public/og-kore.jpg; 1200 × 630). */
export const DEFAULT_OG_PATH = '/og-kore.jpg';
const DEFAULT_OG_SIZE = { width: 1200, height: 630 };

export const SITE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
} as const;

/** A página do convidado não espera uma API lenta (sugestão do Crivo no B6). */
export const PREVIEW_TIMEOUT_MS = 2500;

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** O slug do caminho, em minúsculas; qualquer outra coisa não é um site. */
export function slugFromPath(pathname: string): string | null {
  const [first] = pathname.split('/').filter(Boolean);
  if (!first) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(first).toLowerCase();
  } catch {
    return null;
  }
  return SLUG_PATTERN.test(slug) ? slug : null;
}

async function linkPreview({
  slug,
  env,
  fetchImpl,
  timeoutMs,
}: {
  slug: string | null;
  env: SitePageEnv;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}): Promise<LinkPreview | null> {
  if (!slug) return null;
  try {
    const response = await fetchImpl(
      `${env.API_URL}/v1/public/sites/${encodeURIComponent(slug)}/preview`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) },
    );
    if (!response.ok) return null;
    return (await response.json()) as LinkPreview;
  } catch {
    return null;
  }
}

/** As metatags da prévia do link: as do casamento publicado ou as genéricas do Kore. */
export function previewTags({
  preview,
  defaultImage,
}: {
  preview: LinkPreview | null;
  defaultImage?: string | undefined;
}): string {
  const published = preview?.state === 'published' && Boolean(preview.title);
  const title = published && preview?.title ? preview.title : GENERIC_PREVIEW.title;
  const description =
    published && preview?.description ? preview.description : GENERIC_PREVIEW.description;
  const image = published && preview?.image ? preview.image : null;
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
  ];
  if (image) {
    tags.push(
      `<meta property="og:image" content="${escapeHtml(image.url)}" />`,
      `<meta property="og:image:width" content="${image.width}" />`,
      `<meta property="og:image:height" content="${image.height}" />`,
    );
  } else if (defaultImage) {
    tags.push(
      `<meta property="og:image" content="${escapeHtml(defaultImage)}" />`,
      `<meta property="og:image:width" content="${DEFAULT_OG_SIZE.width}" />`,
      `<meta property="og:image:height" content="${DEFAULT_OG_SIZE.height}" />`,
    );
  }
  return tags.join('\n    ');
}

/** O HTML do bundle com as metatags no lugar do <title> padrão. */
export function injectTags({ html, tags }: { html: string; tags: string }): string {
  return html.replace(/<title>[\s\S]*?<\/title>/, tags);
}

export async function handleSitePage({
  request,
  env,
  fetchImpl = fetch,
  timeoutMs = PREVIEW_TIMEOUT_MS,
}: {
  request: Request;
  env: SitePageEnv;
  fetchImpl?: typeof fetch;
  /** O limite da chamada à API (configurável para o teste). */
  timeoutMs?: number;
}): Promise<Response> {
  const url = new URL(request.url);
  const slug = slugFromPath(url.pathname);
  const [preview, page] = await Promise.all([
    linkPreview({ slug, env, fetchImpl, timeoutMs }),
    env.ASSETS.fetch(new Request(new URL('/', url), { method: 'GET' })),
  ]);
  const html = await page.text();
  const body = injectTags({
    html,
    // O og:image precisa do endereço absoluto: a imagem do próprio site, ou a da variável.
    tags: previewTags({
      preview,
      defaultImage: env.DEFAULT_OG_IMAGE ?? new URL(DEFAULT_OG_PATH, url.origin).toString(),
    }),
  });
  return new Response(body, { status: 200, headers: SITE_HEADERS });
}
