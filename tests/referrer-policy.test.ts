import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import viteConfig, { securityHeaders } from '../vite.config';

describe('Referrer-Policy: no-referrer (decisão 139)', () => {
  it('na meta do index.html', () => {
    expect(readFileSync('index.html', 'utf8')).toContain(
      '<meta name="referrer" content="no-referrer" />',
    );
  });

  it('no cabeçalho do Cloudflare Pages (_headers), para todas as rotas', () => {
    expect(readFileSync('public/_headers', 'utf8')).toMatch(
      /^\/\*\n {2}Referrer-Policy: no-referrer$/m,
    );
  });

  it('no servidor de desenvolvimento e no preview do Vite', () => {
    expect(securityHeaders).toEqual({ 'Referrer-Policy': 'no-referrer' });
    expect(viteConfig).toMatchObject({
      server: { headers: securityHeaders },
      preview: { headers: securityHeaders },
    });
  });
});
