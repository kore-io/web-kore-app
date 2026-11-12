// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { GENERIC_PREVIEW, handleSitePage, slugFromPath, type SitePageEnv } from './site-page';

const HTML = `<!doctype html><html lang="pt-BR"><head>
    <meta name="robots" content="noindex, nofollow" />
    <title>Kore</title>
  </head><body><div id="root"></div></body></html>`;

function env(overrides: Partial<SitePageEnv> = {}): SitePageEnv {
  return {
    API_URL: 'https://api.test',
    ASSETS: { fetch: vi.fn(async () => new Response(HTML)) },
    ...overrides,
  };
}

function api(body: unknown, status = 200) {
  return vi.fn(async () => Response.json(body, { status }));
}

const published = {
  state: 'published',
  title: 'Ana & Marcos',
  description: 'Site do casamento de Ana & Marcos.',
  image: { url: 'https://cdn.test/w1/og.jpg', width: 1200, height: 630 },
};

describe('Pages Function do site do casal (Site público RN01 a RN03, RN09)', () => {
  it('publicado: o título, a descrição e a og.jpg da capa, com os cabeçalhos do site', async () => {
    const fetchImpl = api(published);
    const response = await handleSitePage({
      request: new Request('https://kore.com.br/ana-e-marcos'),
      env: env(),
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.test/v1/public/sites/ana-e-marcos/preview',
      {
        headers: { Accept: 'application/json' },
      },
    );
    expect(response.status).toBe(200);
    expect(Object.fromEntries(response.headers)).toMatchObject({
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
      'content-type': 'text/html; charset=utf-8',
    });
    const html = await response.text();
    expect(html).toContain('<title>Ana &amp; Marcos</title>');
    expect(html).toContain('<meta property="og:title" content="Ana &amp; Marcos" />');
    expect(html).toContain(
      '<meta property="og:description" content="Site do casamento de Ana &amp; Marcos." />',
    );
    expect(html).toContain('<meta property="og:image" content="https://cdn.test/w1/og.jpg" />');
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(html).not.toContain('<title>Kore</title>');
  });

  it('rascunho ou endereço que não existe: a prévia genérica do Kore, sem nome, com a og-kore.jpg do site', async () => {
    const response = await handleSitePage({
      request: new Request('https://kore.com.br/rascunho'),
      env: env(),
      fetchImpl: api({ state: 'generic', title: null, description: null, image: null }),
    });
    const html = await response.text();
    expect(html).toContain(`<meta property="og:title" content="${GENERIC_PREVIEW.title}" />`);
    expect(html).toContain('Lista de convidados, site e confirmações num lugar só.');
    expect(html).not.toContain('Ana');
    expect(html).toContain(
      '<meta property="og:image" content="https://kore.com.br/og-kore.jpg" />',
    );
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
  });

  it('publicado sem capa: os nomes, com a imagem padrão', async () => {
    const response = await handleSitePage({
      request: new Request('https://kore.com.br/ana-e-marcos'),
      env: env(),
      fetchImpl: api({ ...published, image: null }),
    });
    const html = await response.text();
    expect(html).toContain('<title>Ana &amp; Marcos</title>');
    expect(html).toContain(
      '<meta property="og:image" content="https://kore.com.br/og-kore.jpg" />',
    );
  });

  it('a variável sobrescreve a imagem padrão', async () => {
    const response = await handleSitePage({
      request: new Request('https://kore.com.br/rascunho'),
      env: env({ DEFAULT_OG_IMAGE: 'https://kore.com.br/og-kore.jpg' }),
      fetchImpl: api({ state: 'generic', title: null, description: null, image: null }),
    });
    expect(await response.text()).toContain(
      '<meta property="og:image" content="https://kore.com.br/og-kore.jpg" />',
    );
  });

  it('o link do grupo: só o slug vai à API; o token não sai do caminho', async () => {
    const fetchImpl = api(published);
    await handleSitePage({
      request: new Request('https://kore.com.br/ana-e-marcos/grupo/q3Xv8LmN2pRtY7wK1cZb4A'),
      env: env(),
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(JSON.stringify(vi.mocked(fetchImpl).mock.calls)).not.toContain('q3Xv8LmN2pRtY7wK1cZb4A');
  });

  it('a API fora: o HTML sai com a genérica, e o site mostra o erro dele', async () => {
    const response = await handleSitePage({
      request: new Request('https://kore.com.br/ana-e-marcos'),
      env: env(),
      fetchImpl: vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>Kore</title>');
  });

  it('o texto da API é escapado: nada vira HTML', async () => {
    const response = await handleSitePage({
      request: new Request('https://kore.com.br/ana-e-marcos'),
      env: env(),
      fetchImpl: api({ ...published, title: '"><script>alert(1)</script>' }),
    });
    const html = await response.text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
  });

  it('o slug do caminho: minúsculas, o formato do endereço, e o resto não vai à API', () => {
    expect(slugFromPath('/Ana-e-Marcos')).toBe('ana-e-marcos');
    expect(slugFromPath('/ana-e-marcos/grupo/abc')).toBe('ana-e-marcos');
    expect(slugFromPath('/')).toBeNull();
    expect(slugFromPath('/ana%E0%A4%A')).toBeNull();
    expect(slugFromPath('/../etc')).toBeNull();
    expect(slugFromPath('/a.b')).toBeNull();
  });
});
