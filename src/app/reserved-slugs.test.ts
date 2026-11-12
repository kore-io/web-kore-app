// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSiteRoute } from '../site/route';
import { paths } from './paths';

/**
 * Um endereço de site (kore.com.br/<slug>) não pode colidir com uma rota da raiz do app
 * (Dados básicos RN07). Cada primeiro segmento das rotas tem de estar no ReservedSlugs
 * que a API publica no OpenAPI. As rotas do bundle público entram com ele (Fase B).
 */
describe('palavras reservadas do endereço do site (Dados básicos RN07)', () => {
  it('cada rota da raiz do app está no ReservedSlugs do OpenAPI', () => {
    const spec = JSON.parse(readFileSync(resolve('api/openapi.json'), 'utf8')) as {
      components: { schemas: { ReservedSlugs?: { enum?: string[] } } };
    };
    const reserved = spec.components.schemas.ReservedSlugs?.enum ?? [];
    const roots = [
      ...new Set(
        Object.values(paths)
          .map((path) => path.split('/')[1])
          .filter(
            (segment): segment is string =>
              segment !== undefined && segment !== '' && !segment.startsWith(':'),
          ),
      ),
    ];
    expect(roots).toEqual(
      expect.arrayContaining(['entrar', 'convite', 'perfis', 'cadastro', 'sessao-expirada', 'app']),
    );
    expect(roots.filter((root) => !reserved.includes(root))).toEqual([]);
  });

  it('as rotas de raiz do bundle público e da Pages Function também (RN07; 205, D19)', () => {
    const spec = JSON.parse(readFileSync(resolve('api/openapi.json'), 'utf8')) as {
      components: { schemas: { ReservedSlugs?: { enum?: string[] } } };
    };
    const reserved = spec.components.schemas.ReservedSlugs?.enum ?? [];
    // O Simule (src/site/route.ts) e os arquivos que o Pages serve fora da função.
    const routes = JSON.parse(readFileSync(resolve('site/public/_routes.json'), 'utf8')) as {
      exclude: string[];
    };
    const staticRoots = routes.exclude
      .map((path) => path.split('/')[1] ?? '')
      .filter((segment) => segment !== '' && !segment.includes('.') && !segment.startsWith('_'));
    expect(staticRoots).toEqual(['assets']);
    expect(parseSiteRoute('/simule', true)).toEqual({ kind: 'simulator' });
    expect(['simule', ...staticRoots].filter((root) => !reserved.includes(root))).toEqual([]);
  });
});
