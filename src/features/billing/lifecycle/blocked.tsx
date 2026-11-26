import { Alert, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  getMeControllerMeV1QueryKey,
  useMeControllerMeV1,
} from '../../../shared/api/generated/me/me';
import { apiErrorCode, onWeddingBlocked } from '../../../shared/api/http-client';
import { SUPPORT_EMAIL } from '../../access/components/sign-in-alert';
import { useArea } from '../../../app/area';
import { useActiveWedding } from '../../guests/hooks/use-active-wedding';

/** O `403 WEDDING_BLOCKED` de uma escrita no casamento bloqueado (Bloqueado RN02). */
export function isWeddingBlocked(error: unknown): boolean {
  return apiErrorCode({ error }) === 'WEDDING_BLOCKED';
}

/** O `409 WEDDING_DELETION_SCHEDULED` de uma escrita com a exclusão agendada (Retenção RN05). */
export function isDeletionScheduled(error: unknown): boolean {
  return apiErrorCode({ error }) === 'WEDDING_DELETION_SCHEDULED';
}

/** A escrita recusada pela trava: o bloqueio ou a exclusão agendada (o motivo vem da trava). */
export function isWriteLocked(error: unknown): boolean {
  return isWeddingBlocked(error) || isDeletionScheduled(error);
}

/**
 * A faixa fixa do casamento bloqueado (Bloqueado RN04; textos-f3 B5, P5): tom Erro, sem
 * fechar e sem o motivo, com o e-mail do suporte como link dentro da frase. Ela substitui
 * as faixas do ciclo de vida (329(4)) e serve ao casal e à colaboradora.
 */
export function BlockedBanner() {
  const { t } = useTranslation('billing');
  return (
    <Alert
      tone="danger"
      className="kore-lifecycle-banner"
      title={
        <Trans
          t={t}
          i18nKey="lifecycle.blocked.banner"
          values={{ supportEmail: SUPPORT_EMAIL }}
          components={{
            // O texto do link vem do catálogo, pelo Trans.
            supportLink: (
              <a className="kore-lifecycle-banner__link" href={`mailto:${SUPPORT_EMAIL}`} />
            ),
          }}
        />
      }
    />
  );
}

/** Por que a escrita do casamento está fechada: o bloqueio vem à frente da exclusão. */
export type WriteLockKind = 'blocked' | 'deletion' | null;

/**
 * A trava de escrita do casamento aberto, pelo `lifecycle` do vínculo no /me (Bloqueado RN07):
 * o bloqueio (Bloqueado RN02 a RN04) e a exclusão agendada (Retenção RN05; 318(11)), com o
 * motivo do bloqueio quando há os dois. `reason` é o motivo dos botões de escrita
 * desabilitados, ou nulo quando a escrita está liberada.
 */
export function useWriteLock(): { locked: boolean; kind: WriteLockKind; reason: string | null } {
  const { t } = useTranslation('billing');
  const { weddingId } = useActiveWedding();
  const { data: me } = useMeControllerMeV1();
  const membership = me?.memberships.find((item) => item.weddingId === weddingId);
  const kind: WriteLockKind = membership?.lifecycle?.blocked
    ? 'blocked'
    : membership?.lifecycle?.deletionScheduledFor
      ? 'deletion'
      : null;
  return {
    locked: kind !== null,
    kind,
    reason:
      kind === 'blocked'
        ? t('lifecycle.blocked.reason')
        : kind === 'deletion'
          ? t('lifecycle.deletion.reason')
          : null,
  };
}

/**
 * O `403 WEDDING_BLOCKED` ou o `409 WEDDING_DELETION_SCHEDULED` que chega em corrida (Bloqueado
 * RN04; Retenção RN05, 318(12)): o Toast com o motivo, no lugar do erro genérico. O /me é
 * relido pela moldura (`useWeddingBlockedRefetch`), e a tela fecha a escrita. Devolve se
 * tratou o erro.
 */
export function useBlockedToast() {
  const { showToast } = useToast();
  const lockedMessage = useLockedMessage();
  return (error: unknown): boolean => {
    const message = lockedMessage(error);
    if (!message) return false;
    showToast({ tone: 'danger', message });
    return true;
  };
}

/**
 * O texto do Toast de uma escrita recusada pela trava, ou nulo: o motivo do bloqueio, ou o da
 * exclusão agendada na versão do perfil (casal: "Cancelem a exclusão…"; colaboradora: "Só o
 * casal pode cancelar a exclusão.").
 */
function useLockedMessage() {
  const { t } = useTranslation('billing');
  // A versão segue a área (Colaboradora RN09), sem ler o /me: na do casal, o casal.
  const audience = useArea().kind === 'planner' ? 'planner' : 'couple';
  return (error: unknown): string | null => {
    if (isWeddingBlocked(error)) return t('lifecycle.blocked.reason');
    if (isDeletionScheduled(error)) return t(`lifecycle.deletion.toast.${audience}`);
    return null;
  };
}

/**
 * Relê o /me a cada `403 WEDDING_BLOCKED` e `409 WEDDING_DELETION_SCHEDULED`, também nas
 * chamadas diretas, fora dos hooks de mutação (Bloqueado RN07; Retenção RN05). Fica nas
 * molduras das áreas do casamento.
 */
export function useWeddingBlockedRefetch() {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      onWeddingBlocked(() => {
        void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
      }),
    [queryClient],
  );
}

/**
 * As props de um botão de escrita com a trava (Bloqueado RN04): desabilitado e descrito pelo
 * motivo (`WriteLockReason` com o mesmo `id`). Sem a trava, nada muda; vem depois das outras
 * props do botão, porque o bloqueio passa à frente dos outros motivos.
 */
export function lockedProps({
  locked,
  id,
  describedBy,
}: {
  locked: boolean;
  id: string;
  /** A descrição que o botão já tinha (ex.: o nome do item da linha), mantida antes do motivo. */
  describedBy?: string;
}) {
  if (!locked) return {};
  return { disabled: true, 'aria-describedby': describedBy ? `${describedBy} ${id}` : id };
}

/** O motivo dos botões de escrita travados (Bloqueado RN04), com o `id` que eles citam. */
export function WriteLockReason({ id, className }: { id: string; className?: string }) {
  const { reason } = useWriteLock();
  if (!reason) return null;
  return (
    <p id={id} className={className ? `kore-write-lock ${className}` : 'kore-write-lock'}>
      {reason}
    </p>
  );
}

/**
 * O texto do Toast de erro de uma escrita: o motivo da trava em corrida (o bloqueio, Bloqueado
 * RN04; a exclusão agendada, Retenção RN05) e, nos outros, o erro genérico.
 */
export function useErrorMessage() {
  const { t: tAccess } = useTranslation('access');
  const lockedMessage = useLockedMessage();
  return (error?: unknown): string =>
    lockedMessage(error) ??
    `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`;
}
