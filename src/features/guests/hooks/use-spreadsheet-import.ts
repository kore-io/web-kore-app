import { useToast } from '@kore-io/design';
import { useQueryClient, type Query } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  useGuestImportsControllerSpreadsheetPreviewV1,
  useGuestImportsControllerSpreadsheetV1,
} from '../../../shared/api/generated/guest-imports/guest-imports';
import type { SpreadsheetPreviewResponse } from '../../../shared/api/generated/model';
import { getTagsControllerListV1QueryKey } from '../../../shared/api/generated/tags/tags';
import { apiErrorCode } from '../../../shared/api/http-client';
import type { Audience } from './use-active-wedding';
import { useAreaPaths } from '../../../app/area';

/** Recusas do arquivo inteiro, com o texto na Importação RN03 e na decisão 209. */
const REFUSALS = ['TEMPLATE_MISMATCH', 'TOO_MANY_ROWS', 'NOT_XLSX', 'FILE_TOO_LARGE'] as const;
type Refusal = (typeof REFUSALS)[number];

/**
 * Importar a planilha (Importação RN01 a RN09): manda o arquivo para a prévia (nada é
 * gravado), mostra a prévia e, no Importar, reenvia o mesmo arquivo, que a API valida de
 * novo e grava numa transação só. O botão Importar fica desabilitado desde o primeiro
 * clique (sem Idempotency-Key, 186(1)). Ao importar, volta a Grupos e convidados com o
 * Toast "{n} grupos importados" (RN09).
 */
export function useSpreadsheetImport({
  weddingId,
  audience,
}: {
  weddingId: string;
  audience: Audience;
}) {
  const area = useAreaPaths();
  const { t } = useTranslation('guests');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const preview = useGuestImportsControllerSpreadsheetPreviewV1();
  const confirm = useGuestImportsControllerSpreadsheetV1();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<SpreadsheetPreviewResponse | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  function genericError() {
    showToast({
      tone: 'danger',
      message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
    });
  }

  return {
    file,
    preview: result,
    refusal,
    isReading: preview.isPending,
    isImporting: confirm.isPending || confirm.isSuccess,
    send: (chosen: File) => {
      setRefusal(null);
      setResult(null);
      preview.mutate(
        { weddingId, data: { file: chosen } },
        {
          onSuccess: (data) => {
            setFile(chosen);
            setResult(data);
          },
          onError: (error) => {
            const code = apiErrorCode({ error });
            if (REFUSALS.includes(code as Refusal)) {
              setRefusal(t(`importSheet.refused.${code as Refusal}.${audience}`));
            } else {
              genericError();
            }
          },
        },
      );
    },
    reset: () => {
      setFile(null);
      setResult(null);
      setRefusal(null);
    },
    importAll: () => {
      if (!file) return;
      confirm.mutate(
        { weddingId, data: { file } },
        {
          onSuccess: ({ parties }) => {
            void queryClient.invalidateQueries({
              predicate: (query: Query) =>
                query.queryKey.some(
                  (part) =>
                    typeof part === 'string' && part.startsWith(`/v1/weddings/${weddingId}/`),
                ),
            });
            void queryClient.invalidateQueries({
              queryKey: getTagsControllerListV1QueryKey(weddingId),
            });
            showToast({ tone: 'success', message: t('importSheet.imported', { count: parties }) });
            void navigate(area.guests);
          },
          onError: (error) => {
            const code = apiErrorCode({ error });
            if (REFUSALS.includes(code as Refusal)) {
              setRefusal(t(`importSheet.refused.${code as Refusal}.${audience}`));
              setResult(null);
            } else {
              genericError();
            }
          },
        },
      );
    },
  };
}
