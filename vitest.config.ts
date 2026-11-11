import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    env: { VITE_API_URL: 'http://api.test' },
    // O padrão é 5 s. Com a máquina ocupada (o WSL de 8 GB e 2 workers), os testes de tela
    // mais longos passaram disso: a lista de 201 grupos e o Novo grupo com muito
    // user.type (achados do Crivo). 15 s dá folga sem esconder um teste travado.
    testTimeout: 15_000,
  },
});
