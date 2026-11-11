import { defineConfig } from 'orval';

/**
 * Client da API (ADR-15, decisão 149): hooks do TanStack Query gerados da cópia versionada
 * do OpenAPI do api-kore-api. Regerar com `pnpm api:generate` (ou `pnpm api:sync`).
 */
export default defineConfig({
  kore: {
    input: { target: './api/openapi.json' },
    output: {
      mode: 'tags-split',
      target: './src/shared/api/generated',
      schemas: './src/shared/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        // O mutator devolve só o corpo e lança ApiError fora do 2xx (com o corpo tipado).
        fetch: { includeHttpResponseReturnType: false },
        mutator: { path: './src/shared/api/http-client.ts', name: 'httpClient' },
        operations: {
          // Lista de grupos com rolagem infinita pelo cursor (RN13; decisão 197).
          PartiesController_list_v1: {
            query: { useInfinite: true, useInfiniteQueryParam: 'cursor' },
          },
        },
      },
    },
    hooks: { afterAllFilesWrite: 'prettier --write' },
  },
});
