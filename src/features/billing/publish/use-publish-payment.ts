import { useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAreaPaths } from '../../../app/area';
import {
  getPaymentsControllerBillingV1QueryKey,
  paymentsControllerPayV1,
  usePaymentsControllerBillingV1,
} from '../../../shared/api/generated/billing/billing';
import { getMeControllerMeV1QueryKey } from '../../../shared/api/generated/me/me';
import type { CreatePaymentBody } from '../../../shared/api/generated/model';
import { apiErrorCode } from '../../../shared/api/http-client';
import { oneDot, shortDayMonth } from '../../../shared/date-texts';
import { useIdempotencyKeys } from '../../../shared/idempotency';

/** O polling da confirmação do cartão: o mesmo do Pix, a cada 5 s, sem limite (316(4)). */
export const CONFIRM_POLL_MS = 5000;

export type PayState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  /** O cartão em análise: espera a confirmação pelo GET …/billing (RN04). */
  | { kind: 'confirming'; paymentId: string }
  | { kind: 'declined' };

/** O que a tela faz em cada erro que o app conhece (os outros: o aviso genérico, 157(3)). */
export type PayFailure = 'priceChanged' | 'payerNotFound' | 'quoteStale' | 'handled' | 'generic';

/**
 * O pagar do Publicar e da extensão (Publicar e pagar RN03 a RN07; Data de saída RN04): o
 * POST com a `Idempotency-Key` por intenção (o alvo é o casamento, o corpo é o pedido), o
 * cartão recusado na hora, a espera da confirmação do cartão (o site só vai ao ar, ou a data
 * só muda, na confirmação), o Pix, que segue para a tela do Pix, e os erros com os textos
 * da Voz. Na extensão, a confirmação é o pagamento pago (o site já estava no ar), com o Toast
 * da nova data e a volta a Pagamentos (E11).
 */
export function usePublishPayment({
  weddingId,
  kind = 'publication',
}: {
  weddingId: string;
  kind?: 'publication' | 'extension';
}) {
  const { t } = useTranslation('billing');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const paths = useAreaPaths();
  const keys = useIdempotencyKeys();
  const [state, setState] = useState<PayState>({ kind: 'idle' });
  const confirmingId = state.kind === 'confirming' ? state.paymentId : null;
  /**
   * Quantas respostas do billing já tinham chegado quando a espera começou: só conta uma
   * resposta que chegou de fato depois (o `dataUpdateCount` sobe só no sucesso). Na falha de
   * rede, a do cache, de antes do POST, não conta (achado do Crivo no E4).
   */
  const [updatesBefore, setUpdatesBefore] = useState<number | null>(null);

  // Quantas respostas do billing chegaram (sobe só no sucesso; lido do estado da query).
  const billingUpdates = (): number =>
    queryClient.getQueryState(getPaymentsControllerBillingV1QueryKey(weddingId))?.dataUpdateCount ??
    0;
  const billing = usePaymentsControllerBillingV1(weddingId, {
    query: { refetchInterval: confirmingId !== null ? CONFIRM_POLL_MS : false },
  });

  function confirmed({ endDate }: { endDate?: string | null | undefined } = {}) {
    keys.reset();
    void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
    if (kind === 'extension') {
      // "O site fica no ar até 14 de mai. de 2027." (Data de saída RN04; Penpot 21, A9).
      setState({ kind: 'idle' });
      showToast({
        tone: 'success',
        message: oneDot(
          t('endDate.toast.until', {
            date: endDate ? shortDayMonth({ day: endDate, now: new Date() }) : '',
          }),
        ),
      });
      void queryClient.invalidateQueries({
        queryKey: getPaymentsControllerBillingV1QueryKey(weddingId),
      });
      void navigate(paths.billing);
      return;
    }
    showToast({ tone: 'success', message: t('publish.toast.confirmed') });
    void navigate(paths.dashboard);
  }

  // A confirmação do cartão em análise chega pelo GET …/billing (RN04, RN09 e RN11). A lista
  // traz só os pagamentos aplicados: o pendente que some sem o site publicado não foi
  // aprovado (o cartão que falha depois do "Confirmando…").
  const payment = billing.data?.payments?.find((item) => item.id === confirmingId);
  const pendingId = billing.data?.pendingPayment?.paymentId ?? null;
  useEffect(() => {
    if (confirmingId === null || !billing.data) return;
    const done =
      payment?.status === 'paid' || (kind === 'publication' && billing.data.status === 'published');
    if (done) confirmed({ endDate: billing.data.endDate });
    else if (
      updatesBefore !== null &&
      billingUpdates() > updatesBefore &&
      pendingId !== confirmingId
    ) {
      keys.reset();
      setState({ kind: 'declined' });
    }
    // confirmed muda a cada render; o que importa é a resposta nova do billing.
  }, [billing.data, billing.dataUpdatedAt, updatesBefore, confirmingId]);

  /** Reabrir com o cartão pendente: o Confirmando de novo (cobrança do Crivo no E3; 324). */
  function resume({ paymentId }: { paymentId: string }) {
    setState({ kind: 'confirming', paymentId });
    setUpdatesBefore(billingUpdates());
    // A 1ª consulta já; a falha segue no Confirmando, com o polling de 5 s.
    void billing.refetch();
  }

  function toastError(message: string) {
    showToast({ tone: 'danger', message });
  }

  /** Manda o pagamento; devolve o que a tela precisa fazer quando falha. */
  async function pay({ body }: { body: CreatePaymentBody }): Promise<PayFailure | null> {
    setState({ kind: 'sending' });
    try {
      const created = await paymentsControllerPayV1(weddingId, body, {
        headers: keys.headersFor({ target: weddingId, body }),
      });
      if (created.status === 'paid') {
        confirmed({ endDate: body.endDate });
        return null;
      }
      if (created.status === 'failed') {
        keys.reset();
        setState({ kind: 'declined' });
        return null;
      }
      if (created.method === 'pix') {
        // O Pix segue na tela dele (A3), com o copia e cola do GET …/billing.
        keys.reset();
        setState({ kind: 'idle' });
        void navigate(paths.billingPix, { state: { endDate: body.endDate, kind } });
        return null;
      }
      // A 1ª consulta já, sem esperar os 5 s: o cartão local confirma rápido.
      resume({ paymentId: created.paymentId });
      return null;
    } catch (error) {
      setState({ kind: 'idle' });
      const code = apiErrorCode({ error });
      // A falha de rede e o 503 guardam a chave: o retry é a mesma intenção (B2-10).
      if (code !== undefined && code !== 'GATEWAY_UNAVAILABLE') keys.reset();
      switch (code) {
        case 'PRICE_CHANGED':
          toastError(t('publish.toast.priceChanged'));
          return 'priceChanged';
        case 'PAYER_NOT_FOUND':
          return 'payerNotFound';
        case 'END_DATE_OUT_OF_RANGE':
        case 'INSTALLMENTS_OUT_OF_RANGE':
          return 'quoteStale';
        case 'PAYMENT_PENDING':
          toastError(t('publish.toast.paymentPending'));
          return 'handled';
        case 'REFUND_IN_PROGRESS':
          toastError(t('publish.toast.refundInProgress'));
          return 'handled';
        case 'GATEWAY_UNAVAILABLE':
          toastError(t('publish.toast.gatewayUnavailable'));
          return 'handled';
        case 'WEDDING_BLOCKED':
          // O pagar não passa pelo MutationCache do E1: refaz o /me aqui (Bloqueado RN07),
          // e o /me novo mostra o motivo ao lado do botão e desabilita a tela.
          void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
          toastError(t('publish.reason.blocked'));
          return 'handled';
        case 'PAYMENT_ALREADY_PAID':
          // O Pix trocado já tinha sido pago: o Kore aplicou o pagamento (RN07; Pena, item 2).
          void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
          showToast({ tone: 'success', message: t('publish.toast.alreadyPaid') });
          void navigate(kind === 'extension' ? paths.billing : paths.dashboard);
          return 'handled';
        case 'NOT_DRAFT':
          if (kind === 'extension') break;
          showToast({ tone: 'success', message: t('publish.toast.alreadyPublished') });
          void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
          void navigate(paths.dashboard);
          return 'handled';
        case 'NOT_PUBLISHED':
          // A extensão de quem saiu de publicado no meio (ex.: desistiu): a tela relê.
          void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
          break;
      }
      toastError(`${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`);
      return 'generic';
    }
  }

  return {
    state,
    pay,
    resume,
    billing: billing.data,
    previousPayer: billing.data?.payer ?? null,
    dismissDeclined: () => setState({ kind: 'idle' }),
  };
}
