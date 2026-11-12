import { defineConfig, devices } from '@playwright/test';

/**
 * E2E do DoD (Playwright), contra a API local de verdade: o api-kore-api (API e worker)
 * em http://localhost:3000, com GOOGLE_PROVIDER=dev, ALLOWED_ORIGINS com a origem do app
 * e o Mailpit do compose em http://localhost:8025 (os e-mails de código chegam lá).
 * O app sobe sozinho (ou reaproveita o que já estiver na 5173).
 */
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    // O celular é o uso principal do casal; o computador já é coberto pelos prints.
    ...devices['Pixel 7'],
  },
  webServer: {
    command: 'pnpm dev --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
