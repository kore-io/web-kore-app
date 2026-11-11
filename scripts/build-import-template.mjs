// Gera o modelo da planilha de convidados (Importação RN02; decisão 209), um arquivo
// estático em public/: só a 1ª linha com os 7 títulos, que o matchesTemplate do
// api-kore-api compara (src/modules/guests/domain/spreadsheet-import.ts). Rodar de novo
// só se os títulos mudarem: pnpm import-template.
import ExcelJS from 'exceljs';
import { IMPORT_TEMPLATE_HEADERS, IMPORT_TEMPLATE_PATH } from './import-template.mjs';

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Convidados');
sheet.addRow([...IMPORT_TEMPLATE_HEADERS]);
sheet.getRow(1).font = { bold: true };
sheet.columns.forEach((column) => {
  column.width = 22;
});
// Sem data de criação nem autor: o arquivo fica igual a cada geração.
workbook.created = new Date(0);
workbook.modified = new Date(0);
workbook.creator = 'Kore';
await workbook.xlsx.writeFile(IMPORT_TEMPLATE_PATH);
console.log(`modelo gerado em ${IMPORT_TEMPLATE_PATH}`);
