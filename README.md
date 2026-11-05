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
| `pnpm typecheck`                    | checagem de tipos                                 |
| `pnpm lint`                         | ESLint                                            |
| `pnpm format` / `pnpm format:check` | Prettier                                          |

Commits em Conventional Commits (commitlint no `commit-msg`); lint-staged no `pre-commit`.

## CI

`.github/workflows/ci.yml`, completo no próprio repositório (decisão 145): roda em todo push, em qualquer branch, com o commitlint e, em seguida, `install --frozen-lockfile`, `format:check`, `lint`, `typecheck`, `test` e `build`. Um push novo cancela o anterior na mesma branch, menos em `homolog` e `production`. Actions fixadas pelo SHA do commit. O deploy (Cloudflare Pages) entra com a infra, no fim (decisão 81).
