// Copia o openapi.json do api-kore-api vizinho (decisão 149) e gera o client com o Orval.
// Uso: pnpm api:sync [caminho do openapi.json]; padrão ../api-kore-api/openapi.json.
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve(process.argv[2] ?? '../api-kore-api/openapi.json');
if (!existsSync(source)) {
  console.error(`openapi.json não encontrado em ${source}`);
  process.exit(1);
}
copyFileSync(source, resolve('api/openapi.json'));
console.log(`api/openapi.json atualizado a partir de ${source}`);
