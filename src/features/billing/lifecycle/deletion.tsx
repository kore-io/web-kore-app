import { Alert, Button, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useWeddingDeletionControllerCancelV1 } from '../../../shared/api/generated/billing/billing';
import { getMeControllerMeV1QueryKey } from '../../../shared/api/generated/me/me';
import type { MeLifecycleResponse } from '../../../shared/api/generated/model';
import { oneDot, shortDayMonth } from '../../../shared/date-texts';
import type { Audience } from '../../guests/hooks/use-active-wedding';
import { useErrorMessage } from './blocked';

/** O site está no ar depois de cancelar a exclusão (Retenção RN05; Data de saída RN08). */
const LIVE = ['published', 'post_event', 'grace'];

/**
 * Cancelar a exclusão (Retenção RN05): qualquer dono, até o expurgo. Depois, o /me e o resto
 * relidos (a faixa some e a escrita volta) e o Toast: "Exclusão cancelada. O site voltou ao
 * ar." quando ele volta, e "Exclusão cancelada." em rascunho ou expirado (Pena).
 */
export function useCancelDeletion({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('billing');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const cancel = useWeddingDeletionControllerCancelV1();
  return {
    pending: cancel.isPending,
    cancel: () =>
      cancel.mutate(
        { weddingId },
        {
          onSuccess: ({ lifecycle }) => {
            void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
            void queryClient.invalidateQueries({
              predicate: (query) =>
                query.queryKey.some(
                  (part) => typeof part === 'string' && part.includes(`/weddings/${weddingId}`),
                ),
            });
            showToast({
              tone: 'success',
              message: LIVE.includes(lifecycle.status)
                ? t('lifecycle.deletion.canceledBackOnline')
                : t('lifecycle.deletion.canceled'),
            });
          },
          // A exclusão já cancelada em outra aba (NO_DELETION_SCHEDULED) e os outros erros: o
          // Toast e o /me relido.
          onError: (error) => {
            void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
            showToast({ tone: 'danger', message: errorMessage(error) });
          },
        },
      ),
  };
}

/**
 * A faixa da exclusão agendada (Retenção RN05; textos-f3 B8): Atenção, em todas as telas do
 * casamento. O casal tem o Cancelar a exclusão, a única saída; a colaboradora lê que só o
 * casal pode cancelar. Ela substitui as faixas do ciclo de vida (316(8)); o bloqueio a
 * substitui (Bloqueado RN04).
 */
export function DeletionBanner({
  weddingId,
  lifecycle,
  audience,
}: {
  weddingId: string;
  lifecycle: Pick<MeLifecycleResponse, 'blocked' | 'deletionScheduledFor'>;
  audience: Audience;
}) {
  const { t } = useTranslation('billing');
  const { cancel, pending } = useCancelDeletion({ weddingId });
  if (lifecycle.blocked || !lifecycle.deletionScheduledFor) return null;
  const date = shortDayMonth({ day: lifecycle.deletionScheduledFor, now: new Date() });
  return (
    <Alert
      tone="warning"
      title={oneDot(t(`lifecycle.deletion.banner.${audience}`, { date }))}
      className="kore-lifecycle-banner"
    >
      {audience === 'couple' && (
        <Button
          variant="secondary"
          className="kore-lifecycle-banner__action"
          disabled={pending}
          onClick={cancel}
        >
          {t('lifecycle.deletion.cancel')}
        </Button>
      )}
    </Alert>
  );
}
