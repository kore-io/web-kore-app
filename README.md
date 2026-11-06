# web-kore-app

App do Kore (PWA): casal, cerimonialista e backoffice, com os componentes do `@kore-io/design`. Ver `docs-kore-hub` (ADR "Frontend em React + Vite, um app PWA para todos os perfis" e "Atomic Design leve + pastas por feature").

## Requisitos

Node.js 24 (`.nvmrc`) e pnpm 10 (`packageManager`).

O `@kore-io/design` vem do GitHub Packages da org (`.npmrc`). O token precisa do escopo
`read:packages` e não fica gravado em arquivo: passe-o só no comando, por exemplo

```sh
env "npm_config_//npm.pkg.github.com/:_authToken=$(gh auth token)" pnpm install
```

## Comandos

| Comando                             | O que faz                                         |
| ----------------------------------- | ------------------------------------------------- |
| `pnpm install`                      | instala as dependências e os hooks do Git (Husky) |
| `pnpm dev`                          | servidor de desenvolvimento (Vite)                |
| `pnpm build`                        | checa os tipos e gera `dist/`                     |
| `pnpm test`                         | testes (Vitest + Testing Library, jsdom)          |
| `pnpm test:e2e`                     | E2E (Playwright) contra a API local; ver abaixo   |
| `pnpm typecheck`                    | checagem de tipos                                 |
| `pnpm lint`                         | ESLint                                            |
| `pnpm format` / `pnpm format:check` | Prettier                                          |

## E2E (Playwright)

`pnpm test:e2e` roda os testes de `e2e/` contra a API local de verdade, no tamanho de
celular. Antes, deixe de pé:

- o `api-kore-api` (API e worker) em `http://localhost:3000`, com `GOOGLE_PROVIDER=dev`,
  `ALLOWED_ORIGINS=http://localhost:5173` e os limites por IP altos o bastante para a
  suíte (ex.: `RATE_LIMIT_AUTH_PER_MINUTE=200` e `RATE_LIMIT_GENERAL_PER_MINUTE=1000`; os
  padrões, 10 e 100 por minuto, barram a suíte com 429);
- o Mailpit do compose da API em `http://localhost:8025`, de onde os testes leem o código.

Os convites do casal e do cerimonialista e a Seleção com dois perfis montam os próprios
dados (casamento, indicador e convite, únicos por rodada) pela conexão do backoffice da
API, como os e2e do `api-kore-api`. Passe a URL dela no ambiente, sem gravar em arquivo:

```sh
E2E_DATABASE_BACKOFFICE_URL="$(grep '^DATABASE_BACKOFFICE_URL=' ../api-kore-api/.env | cut -d= -f2-)" pnpm test:e2e
```

O app sobe sozinho na 5173 (ou o teste reaproveita o que já estiver rodando). Na primeira
vez, instale o navegador com `pnpm exec playwright install chromium`.

Commits em Conventional Commits (commitlint no `commit-msg`); lint-staged no `pre-commit`.

## CI

`.github/workflows/ci.yml`, completo no próprio repositório (decisão 145): roda em todo push, em qualquer branch, com o commitlint e, em seguida, `install --frozen-lockfile`, `format:check`, `lint`, `typecheck`, `test` e `build`. Um push novo cancela o anterior na mesma branch, menos em `homolog` e `production`. Actions fixadas pelo SHA do commit. O deploy (Cloudflare Pages) entra com a infra, no fim (decisão 81).
