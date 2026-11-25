import { useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAreaPaths } from '../../../app/area';
import {
  paymentsControllerPayV1,
  usePaymentsControllerBillingV1,
} from '../../../shared/api/generated/billing/billing';
import { getMeControllerMeV1QueryKey } from '../../../shared/api/generated/me/me';
import type { CreatePaymentBody } from '../../../shared/api/generated/model';
import { apiErrorCode } from '../../../shared/api/http-client';
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
 * O pagar do Publicar (Publicar e pagar RN03 a RN07): o POST com a `Idempotency-Key` por
 * intenção (o alvo é o casamento, o corpo é o pedido), o cartão recusado na hora, a espera
 * da confirmação do cartão (o site só vai ao ar na confirmação, RN04), o Pix, que segue
 * para a tela do Pix (E4), e os erros com os textos da Voz.
 */
export function usePublishPayment({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('billing');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const paths = useAreaPaths();
  const keys = useIdempotencyKeys();
  const [state, setState] = useState<PayState>({ kind: 'idle' });
  const confirmingId = state.kind === 'confirming' ? state.paymentId : null;
  /** O pagamento de que já chegou uma resposta do billing pedida depois do POST. */
  const [freshFor, setFreshFor] = useState<string | null>(null);

  const billing = usePaymentsControllerBillingV1(weddingId, {
    query: { refetchInterval: confirmingId !== null ? CONFIRM_POLL_MS : false },
  });

  function confirmed() {
    keys.reset();
    void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
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
    if (payment?.status === 'paid' || billing.data.status === 'published') confirmed();
    else if (freshFor === confirmingId && pendingId !== confirmingId) {
      keys.reset();
      setState({ kind: 'declined' });
    }
    // confirmed muda a cada render; o que importa é a resposta nova do billing.
  }, [billing.data, freshFor, confirmingId]);

  /** Reabrir com o cartão pendente: o Confirmando de novo (cobrança do Crivo no E3; 324). */
  function resume({ paymentId }: { paymentId: string }) {
    setState({ kind: 'confirming', paymentId });
    // Só a resposta pedida agora conta: a de antes do POST ainda não tem o pendente.
    void billing.refetch().then(() => setFreshFor(paymentId));
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
        confirmed();
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
        void navigate(paths.billingPix, { state: { endDate: body.endDate } });
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
          void navigate(paths.dashboard);
          return 'handled';
        case 'NOT_DRAFT':
          showToast({ tone: 'success', message: t('publish.toast.alreadyPublished') });
          void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
          void navigate(paths.dashboard);
          return 'handled';
        default:
          toastError(
            `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
          );
          return 'generic';
      }
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
