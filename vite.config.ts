import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaManifest } from './config/pwa-manifest';

/** Decisão 139: o token das rotas de e-mail não vaza no Referer (também no dev). */
export const securityHeaders = { 'Referrer-Policy': 'no-referrer' };

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['kore-icon.svg', 'kore-apple-touch-180.png'],
      manifest: { ...pwaManifest, icons: [...pwaManifest.icons] },
    }),
  ],
  server: { headers: securityHeaders },
  preview: { headers: securityHeaders },
});
