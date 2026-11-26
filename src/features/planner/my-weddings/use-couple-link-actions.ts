import { useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  useAccessInvitationsControllerCancelV1,
  useAccessInvitationsControllerSendV1,
} from '../../../shared/api/generated/access-invitations/access-invitations';
import { getMyWeddingsControllerDetailV1QueryKey } from '../../../shared/api/generated/planner/planner';
import { useErrorMessage } from '../../billing/lifecycle/blocked';

/**
 * Gerar novo link e Cancelar link do bloco Link para o casal (Meus casamentos RN09; Novo
 * casamento RN06), no detalhe e no Pronto do Novo casamento: o POST sem e-mail troca o link,
 * o DELETE o cancela, e o detalhe é relido.
 */
export function useCoupleLinkActions({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('planner');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const send = useAccessInvitationsControllerSendV1();
  const cancel = useAccessInvitationsControllerCancelV1();

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getMyWeddingsControllerDetailV1QueryKey(weddingId) });
  // O bloqueio em corrida (Bloqueado RN04; 344): o motivo, no lugar do genérico.
  const errorMessage = useErrorMessage();
  const genericError = (error?: unknown) =>
    showToast({
      tone: 'danger',
      message: errorMessage(error),
    });

  function regenerate() {
    send.mutate(
      { weddingId, data: { kind: 'couple' } },
      {
        onSuccess: () => {
          void refresh();
          showToast({ tone: 'success', message: t('myWeddings.detail.link.regenerated') });
        },
        onError: genericError,
      },
    );
  }

  function cancelLink({ id, onCanceled }: { id: string; onCanceled?: () => void }) {
    cancel.mutate(
      { weddingId, id },
      {
        onSuccess: () => {
          void refresh();
          onCanceled?.();
          showToast({ tone: 'success', message: t('myWeddings.detail.link.canceled') });
        },
        onError: genericError,
      },
    );
  }

  return { regenerate, cancelLink, busy: send.isPending || cancel.isPending };
}
