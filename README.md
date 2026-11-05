# web-kore-app

App do Kore (PWA): casal, cerimonialista e backoffice, com os componentes do `@kore-io/design`. Ver `docs-kore-hub` (ADR "Frontend em React + Vite, um app PWA para todos os perfis" e "Atomic Design leve + pastas por feature").

## Requisitos

Node.js 24 (`.nvmrc`) e pnpm 10 (`packageManager`).

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
