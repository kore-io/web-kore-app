import { useToast } from '@kore-io/design';
import { useQueryClient, type Query } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  useGuestImportsControllerPastePreviewV1,
  useGuestImportsControllerPasteV1,
} from '../../../shared/api/generated/guest-imports/guest-imports';
import { apiErrorCode } from '../../../shared/api/http-client';
import { draftFromPreview, draftToBody, removeGuest, type PasteDraft } from '../paste-draft';
import type { Audience } from './use-active-wedding';
import { useAreaPaths } from '../../../app/area';

/**
 * Colar a lista (Importação RN10 a RN12): o texto vai para a prévia (nada é gravado), o
 * casal completa e corrige os nomes, e o Importar manda os grupos já resolvidos com o
 * removedInPreview (RN14). O Voltar da prévia volta ao texto sem perdê-lo. O Importar
 * fica desabilitado desde o primeiro clique (186(1)); ao importar, volta à lista com
 * "{n} grupos importados" (RN12).
 */
export function usePasteImport({ weddingId, audience }: { weddingId: string; audience: Audience }) {
  const area = useAreaPaths();
  const { t } = useTranslation('guests');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const preview = useGuestImportsControllerPastePreviewV1();
  const confirm = useGuestImportsControllerPasteV1();
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<PasteDraft | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  function onError(error: unknown) {
    if (apiErrorCode({ error }) === 'TOO_MANY_GUESTS') {
      setRefusal(t(`pasteList.tooMany.${audience}`));
      setDraft(null);
      return;
    }
    showToast({
      tone: 'danger',
      message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
    });
  }

  return {
    text,
    setText,
    draft,
    refusal,
    isReading: preview.isPending,
    isImporting: confirm.isPending || confirm.isSuccess,
    send: () => {
      setRefusal(null);
      preview.mutate(
        { weddingId, data: { text } },
        { onSuccess: (data) => setDraft(draftFromPreview(data)), onError },
      );
    },
    back: () => setDraft(null),
    setGuestName: ({
      groupKey,
      guestKey,
      name,
    }: {
      groupKey: string;
      guestKey: string;
      name: string;
    }) =>
      setDraft(
        (current) =>
          current && {
            ...current,
            groups: current.groups.map((group) =>
              group.key === groupKey
                ? {
                    ...group,
                    guests: group.guests.map((guest) =>
                      guest.key === guestKey ? { ...guest, name } : guest,
                    ),
                  }
                : group,
            ),
          },
      ),
    setGroupName: ({ groupKey, name }: { groupKey: string; name: string }) =>
      setDraft(
        (current) =>
          current && {
            ...current,
            groups: current.groups.map((group) =>
              group.key === groupKey ? { ...group, name } : group,
            ),
          },
      ),
    removeGuest: ({ groupKey, guestKey }: { groupKey: string; guestKey: string }) =>
      setDraft((current) => current && removeGuest({ draft: current, groupKey, guestKey })),
    importAll: () => {
      if (!draft) return;
      confirm.mutate(
        { weddingId, data: draftToBody(draft) },
        {
          onSuccess: ({ parties }) => {
            void queryClient.invalidateQueries({
              predicate: (query: Query) =>
                query.queryKey.some(
                  (part) =>
                    typeof part === 'string' && part.startsWith(`/v1/weddings/${weddingId}/`),
                ),
            });
            showToast({ tone: 'success', message: t('importSheet.imported', { count: parties }) });
            void navigate(area.guests);
          },
          onError,
        },
      );
    },
  };
}
