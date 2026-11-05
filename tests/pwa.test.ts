import { coreColors } from '@kore-io/design';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pwaManifest } from '../config/pwa-manifest';

describe('PWA (decisão 148)', () => {
  it('cores do token color.paper e entrada em /app', () => {
    expect(pwaManifest.theme_color).toBe(coreColors.paper);
    expect(pwaManifest.background_color).toBe(coreColors.paper);
    expect(pwaManifest.start_url).toBe('/app');
    expect(pwaManifest.lang).toBe('pt-BR');
  });

  it('os ícones do manifesto existem em public/', () => {
    for (const icon of pwaManifest.icons) {
      expect(existsSync(`public${icon.src}`), icon.src).toBe(true);
    }
    expect(pwaManifest.icons.map((icon) => icon.sizes)).toEqual(['any', '192x192', '512x512']);
  });

  it('o index.html liga o ícone SVG e o apple-touch de 180 px', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('<link rel="icon" href="/kore-icon.svg" type="image/svg+xml" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/kore-apple-touch-180.png" />');
    expect(existsSync('public/kore-apple-touch-180.png')).toBe(true);
  });
});
