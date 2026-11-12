import type { TFunction } from 'i18next';
import type { SkippedRowResponse } from '../../shared/api/generated/model';
import type { Audience } from './hooks/use-active-wedding';

type GuestsT = TFunction<'guests'>;

/** Códigos que têm uma versão para o casal e outra para a cerimonialista (189(5)). */
const BY_AUDIENCE = new Set([
  'NAME_MISSING',
  'PARTY_MISSING',
  'PHONE_TOO_SHORT',
  'PHONE_TOO_LONG',
  'EMAIL_INVALID',
  'AGE_GROUP_INVALID',
]);

/**
 * O texto de uma linha que fica de fora (Importação RN05 e RN06), montado pelo app a
 * partir do código, do campo e dos parâmetros da API (decisão 189(1)).
 */
export function rowErrorText({
  t,
  row,
  audience,
}: {
  t: GuestsT;
  row: SkippedRowResponse;
  audience: Audience;
}): string {
  const params = row.params as { n?: number; tag?: string };
  if (row.code === 'DUPLICATE') {
    return t('importSheet.rowErrors.DUPLICATE', {
      row: row.duplicateOf?.row ?? '',
      party: row.duplicateOf?.party ?? '',
    });
  }
  if (row.code === 'TOO_LONG') {
    if (row.field === 'dietaryRestriction')
      return t('importSheet.rowErrors.TOO_LONG_dietaryRestriction');
    if (row.field === 'tags')
      return t('importSheet.rowErrors.TOO_LONG_tags', { tag: params.tag ?? '' });
    return t('importSheet.rowErrors.TOO_LONG_name');
  }
  if (row.code === 'PHONE_INVALID')
    return t('importSheet.rowErrors.PHONE_INVALID', { n: params.n ?? 0 });
  if (BY_AUDIENCE.has(row.code)) {
    return t(`importSheet.rowErrors.${row.code as 'NAME_MISSING'}.${audience}`, {
      n: params.n ?? 0,
    });
  }
  return row.code;
}
