// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { IMPORT_TEMPLATE_HEADERS, IMPORT_TEMPLATE_PATH } from '../scripts/import-template.mjs';

/** O contrato da API no repositório (conferido pelo api:check): o enum guarda a ordem das colunas. */
const OPENAPI = resolve('api/openapi.json');

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

  it('os títulos batem, letra por letra e na ordem, com o SpreadsheetTemplateHeaders do OpenAPI', () => {
    const spec = JSON.parse(readFileSync(OPENAPI, 'utf8')) as {
      components: { schemas: { SpreadsheetTemplateHeaders?: { enum?: string[] } } };
    };
    const apiHeaders = spec.components.schemas.SpreadsheetTemplateHeaders?.enum;
    expect(apiHeaders).toHaveLength(7);
    expect(IMPORT_TEMPLATE_HEADERS).toEqual(apiHeaders);
  });
});
