// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { siteCsp } from './csp';

describe('CSP do site do casal (Site público RN01)', () => {
  it('libera só o próprio site, a API e o CDN das imagens, sem nada inline', () => {
    const csp = siteCsp({
      apiUrl: 'https://api.kore.com.br/',
      imagesOrigin: 'https://img.kore.com.br/kore-public',
    });
    expect(csp).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self'; " +
        "img-src 'self' https://img.kore.com.br blob:; font-src 'self'; " +
        "connect-src 'self' https://api.kore.com.br; object-src 'none'; base-uri 'none'; " +
        "form-action 'self'; frame-ancestors 'none'",
    );
    expect(csp).not.toMatch(/unsafe-(inline|eval)/);
  });

  it('um valor que não é URL fica de fora', () => {
    const csp = siteCsp({ apiUrl: 'nao é url', imagesOrigin: '' });
    expect(csp).toContain("connect-src 'self';");
    expect(csp).toContain("img-src 'self' blob:;");
  });

  it('o _headers da raiz e dos arquivos tem a mesma política, sem as origens', () => {
    const headers = readFileSync('site/public/_headers', 'utf8');
    const line = headers.split('\n').find((item) => item.includes('Content-Security-Policy:'));
    expect(line?.split('Content-Security-Policy:')[1]?.trim()).toBe(siteCsp());
    expect(headers).toContain('X-Content-Type-Options: nosniff');
  });
});
