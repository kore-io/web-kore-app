import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * O bundle público do site do casal (Site público RN01; decisão 205): uma entrada
 * separada do app, leve e sem PWA, em `kore.com.br/<slug>`. No local, na porta 5174
 * (RN08), para o E2E exercitar o CORS e a origem por rota da API.
 */
export const siteHeaders = {
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
};

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('./site', import.meta.url)),
  envDir: projectRoot,
  publicDir: fileURLToPath(new URL('./site/public', import.meta.url)),
  plugins: [react(), tailwindcss()],
  server: { port: 5174, strictPort: true, headers: siteHeaders },
  preview: { port: 5174, strictPort: true, headers: siteHeaders },
  build: {
    outDir: fileURLToPath(new URL('./dist-site', import.meta.url)),
    emptyOutDir: true,
  },
});
