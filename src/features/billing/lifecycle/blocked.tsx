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
import { useActiveWedding } from '../../guests/hooks/use-active-wedding';

/** O `403 WEDDING_BLOCKED` de uma escrita no casamento bloqueado (Bloqueado RN02). */
export function isWeddingBlocked(error: unknown): boolean {
  return apiErrorCode({ error }) === 'WEDDING_BLOCKED';
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

/**
 * A trava de escrita do casamento aberto (Bloqueado RN02 a RN04), pelo `lifecycle` do vínculo
 * no /me (RN07): `reason` é o motivo dos botões de escrita desabilitados, ou nulo quando a
 * escrita está liberada.
 */
export function useWriteLock(): { locked: boolean; reason: string | null } {
  const { t } = useTranslation('billing');
  const { weddingId } = useActiveWedding();
  const { data: me } = useMeControllerMeV1();
  const membership = me?.memberships.find((item) => item.weddingId === weddingId);
  const locked = membership?.lifecycle?.blocked === true;
  return { locked, reason: locked ? t('lifecycle.blocked.reason') : null };
}

/**
 * O `403 WEDDING_BLOCKED` que chega em corrida (Bloqueado RN04): o Toast com o motivo dos
 * botões, no lugar do erro genérico. O /me é relido pela moldura (`useWeddingBlockedRefetch`), e a
 * tela fecha a escrita. Devolve se tratou o erro.
 */
export function useBlockedToast() {
  const { t } = useTranslation('billing');
  const { showToast } = useToast();
  return (error: unknown): boolean => {
    if (!isWeddingBlocked(error)) return false;
    showToast({ tone: 'danger', message: t('lifecycle.blocked.reason') });
    return true;
  };
}

/**
 * Relê o /me a cada `403 WEDDING_BLOCKED`, também nas chamadas diretas, fora dos hooks de
 * mutação (que o `MutationCache` do cliente já cobre; Bloqueado RN07). Fica nas molduras das
 * áreas do casamento.
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
