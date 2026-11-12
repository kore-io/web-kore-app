import { coreColors } from '@kore-io/design';

/**
 * Manifesto do PWA (decisão 148): cores do token color.paper (o fundo da splash na
 * página de Motion do DS), entrada em /app e os ícones oficiais do vault (🎨 Assets).
 */
export const pwaManifest = {
  name: 'Kore',
  short_name: 'Kore',
  lang: 'pt-BR',
  start_url: '/app',
  scope: '/',
  display: 'standalone',
  theme_color: coreColors.paper,
  background_color: coreColors.paper,
  icons: [
    { src: '/kore-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: '/kore-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/kore-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  ],
} as const;
