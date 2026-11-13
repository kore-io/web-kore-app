import { describe, expect, it } from 'vitest';
import { fileNameFromDisposition } from './download-file';

describe('nome do arquivo da exportação (RN09)', () => {
  it.each([
    [
      'attachment; filename="convidados-ana-e-marcos-2026-11-06.pdf"; filename*=UTF-8\'\'convidados-ana-e-marcos-2026-11-06.pdf',
      'convidados-ana-e-marcos-2026-11-06.pdf',
    ],
    [
      "attachment; filename*=UTF-8''convidados-jo%C3%A3o-2026-11-06.xlsx",
      'convidados-joão-2026-11-06.xlsx',
    ],
    ['attachment; filename="convidados-ana-2026-11-06.xlsx"', 'convidados-ana-2026-11-06.xlsx'],
    ['attachment', null],
    [null, null],
  ])('%s → %s', (header, name) => {
    expect(fileNameFromDisposition(header)).toBe(name);
  });
});
