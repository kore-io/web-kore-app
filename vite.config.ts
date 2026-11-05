import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Decisão 139: o token das rotas de e-mail não vaza no Referer (também no dev). */
export const securityHeaders = { 'Referrer-Policy': 'no-referrer' };

export default defineConfig({
  plugins: [react()],
  server: { headers: securityHeaders },
  preview: { headers: securityHeaders },
});
