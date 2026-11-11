// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { IMPORT_TEMPLATE_HEADERS, IMPORT_TEMPLATE_PATH } from '../scripts/import-template.mjs';

/** O domínio da importação no api-kore-api vizinho (o mesmo caminho do api:sync). */
const API_SPREADSHEET = resolve('../api-kore-api/src/modules/guests/domain/spreadsheet-import.ts');

describe('modelo da planilha (Importação RN02; decisão 209)', () => {
  it('o arquivo tem uma linha só, com os 7 títulos na ordem', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(IMPORT_TEMPLATE_PATH);
    const sheet = workbook.worksheets[0];
    expect(workbook.worksheets).toHaveLength(1);
    expect(sheet?.rowCount).toBe(1);
    const header = (sheet?.getRow(1).values as unknown[]).slice(1);
    expect(header).toEqual(IMPORT_TEMPLATE_HEADERS);
  });

  it.skipIf(!existsSync(API_SPREADSHEET))(
    'os títulos batem letra por letra com o TEMPLATE_HEADERS que o matchesTemplate da API compara',
    () => {
      const source = readFileSync(API_SPREADSHEET, 'utf8');
      const block = /export const TEMPLATE_HEADERS = \[([\s\S]*?)\]/.exec(source)?.[1] ?? '';
      const apiHeaders = [...block.matchAll(/'([^']*)'/g)].map((match) => match[1]);
      expect(apiHeaders).toHaveLength(7);
      expect(IMPORT_TEMPLATE_HEADERS).toEqual(apiHeaders);
    },
  );
});
