import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import type { SkippedRowResponse } from '../../shared/api/generated/model';
import { rowErrorText } from './import-texts';

const t = i18next.getFixedT('pt-BR', 'guests');

function row(overrides: Partial<SkippedRowResponse>): SkippedRowResponse {
  return { row: 2, name: 'Rosa', kind: 'error', code: 'NAME_MISSING', params: {}, ...overrides };
}

describe('texto das linhas que ficam de fora (Importação RN05 e RN06)', () => {
  it.each([
    [{ code: 'PARTY_MISSING' }, 'couple', 'Falta o grupo. Preencham a coluna Grupo.'],
    [{ code: 'PARTY_MISSING' }, 'planner', 'Falta o grupo. Preencha a coluna Grupo.'],
    [
      { code: 'PHONE_TOO_LONG', params: { n: 13 } },
      'couple',
      'O telefone tem 13 números. Se for de fora do Brasil, comecem com + e o código do país.',
    ],
    [
      { code: 'PHONE_INVALID', params: { n: 3 } },
      'planner',
      'O telefone tem 3 números. Um número de fora do Brasil tem de 8 a 15, com o código do país.',
    ],
    [{ code: 'EMAIL_INVALID' }, 'couple', 'O e-⁠mail não parece certo. Confiram a coluna E-⁠mail.'],
    [{ code: 'AGE_GROUP_INVALID' }, 'planner', 'Use Adulto, Criança ou Bebê na Faixa etária.'],
    [{ code: 'TOO_LONG', field: 'name' }, 'couple', 'O nome passa de 80 caracteres.'],
    [{ code: 'TOO_LONG', field: 'party' }, 'couple', 'O nome passa de 80 caracteres.'],
    [
      { code: 'TOO_LONG', field: 'dietaryRestriction' },
      'couple',
      'A restrição alimentar passa de 200 caracteres.',
    ],
    [
      {
        code: 'TOO_LONG',
        field: 'tags',
        params: { tag: 'Amigos do clube de vôlei de quarta-feira' },
      },
      'couple',
      'A tag Amigos do clube de vôlei de quarta-feira passa de 40 caracteres.',
    ],
  ] as const)('%o (%s)', (overrides, audience, text) => {
    expect(rowErrorText({ t, row: row(overrides as Partial<SkippedRowResponse>), audience })).toBe(
      text,
    );
  });
});
