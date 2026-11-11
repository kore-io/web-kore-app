import { useToast } from '@kore-io/design';
import { useQueryClient, type Query } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiError, apiErrorCode } from '../../../shared/api/http-client';
import { serverFieldErrors, type FieldErrors, type PartyDraft } from '../party-form';

/** Atualiza tudo do casamento depois de gravar um grupo (lista, resumo, painel e tags). */
export function useRefreshWedding({ weddingId }: { weddingId: string }) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (query: Query) =>
        query.queryKey.some(
          (part) => typeof part === 'string' && part.startsWith(`/v1/weddings/${weddingId}/`),
        ),
    });
}

/**
 * O erro de salvar um grupo: o 400 marca os campos (RN04), o 409 das vagas vira o
 * texto embaixo das vagas (RN07), e o resto é o aviso genérico.
 */
export function useSaveErrors() {
  const { t } = useTranslation('guests');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  return ({
    error,
    draft,
  }: {
    error: unknown;
    draft: PartyDraft;
  }): { fields: FieldErrors; plusOnes?: string } => {
    if (error instanceof ApiError && error.status === 400) {
      const body = error.body as {
        errors?: { path: string; code: string; params: Record<string, unknown> }[];
      };
      const fields = serverFieldErrors({ draft, errors: body.errors ?? [] });
      if (Object.keys(fields).length > 0) return { fields };
    }
    if (apiErrorCode({ error }) === 'PLUS_ONES_IN_USE' && error instanceof ApiError) {
      const inUse = (error.body as { inUse?: number }).inUse ?? 0;
      return { fields: {}, plusOnes: t('partyForm.errors.plusOnesInUse', { count: inUse }) };
    }
    showToast({
      tone: 'danger',
      message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
    });
    return { fields: {} };
  };
}
