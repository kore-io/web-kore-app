import { Alert, Button, Dialog, Label, Textarea, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorCode, ApiError } from '../../../shared/api/http-client';
import {
  getPaymentsControllerBillingV1QueryKey,
  paymentsControllerBillingV1,
  paymentsControllerRefundV1,
} from '../../../shared/api/generated/billing/billing';
import { getMeControllerMeV1QueryKey } from '../../../shared/api/generated/me/me';
import { getSiteControllerGetV1QueryKey } from '../../../shared/api/generated/site/site';
import type { BillingPaymentDto } from '../../../shared/api/generated/model';
import { dayMonthIn, oneDot, shortDayMonth } from '../../../shared/date-texts';
import { formatCents } from '../../../shared/money';

/** De 7x a 12x, o cartão tem os juros do gateway, que voltam junto (322(2); 327(5)). */
const INTEREST_FROM = 7;

/** O reembolso volta pela forma do pagamento: o texto muda com ela (RN02; Pena). */
function methodKey(payment: BillingPaymentDto): 'pix' | 'card' | 'cardInterest' {
  if (payment.method === 'pix') return 'pix';
  return payment.installments >= INTEREST_FROM ? 'cardInterest' : 'card';
}

/** As extensões pagas que voltam junto com a publicação (RN03; decisão 230, risco 3). */
function extensionsPaid(payments: BillingPaymentDto[]) {
  return payments.filter((item) => item.kind === 'extension' && item.status === 'paid');
}

/** O que volta ao desistir: a publicação leva as extensões pagas (RN03; 327(1) e (4)). */
export function refundTotal({
  payment,
  payments,
}: {
  payment: BillingPaymentDto;
  payments: BillingPaymentDto[];
}): number {
  if (payment.kind !== 'publication') return payment.amountCents;
  return extensionsPaid(payments).reduce(
    (sum, item) => sum + item.amountCents,
    payment.amountCents,
  );
}

/**
 * O texto do Dialog (RN02; Pena). A publicação com extensão tem o texto com as partes no
 * caso que a Pena escreveu (tudo no cartão, sem juros, uma extensão); nos outros, o texto
 * da forma com o total, até os textos novos (327(3)).
 */
export function refundDescription({
  payment,
  payments,
  now,
  t,
}: {
  payment: BillingPaymentDto;
  payments: BillingPaymentDto[];
  now: Date;
  t: TFunction<'billing'>;
}): string {
  const amount = formatCents({ cents: refundTotal({ payment, payments }) });
  if (payment.kind === 'extension') {
    // A data de volta: o início da extensão, até o previousEndDate da API (327(2)).
    const date = shortDayMonth({ day: payment.periodStart, now });
    return oneDot(t(`refund.extension.${methodKey(payment)}`, { date, amount }));
  }
  const extensions = extensionsPaid(payments);
  const [extension] = extensions;
  if (
    extension &&
    extensions.length === 1 &&
    [payment, extension].every((item) => methodKey(item) === 'card')
  ) {
    return t('refund.publication.withExtension', {
      total: amount,
      publication: formatCents({ cents: payment.amountCents }),
      extension: formatCents({ cents: extension.amountCents }),
    });
  }
  const interest = [payment, ...extensions].some((item) => methodKey(item) === 'cardInterest');
  const key = payment.method === 'pix' ? 'pix' : interest ? 'cardInterest' : 'card';
  return t(`refund.publication.${key}`, { amount });
}

/** Os pagamentos no prazo de desistir, do mais novo ao mais antigo (RN02; 327(4)). */
export function refundable(payments: BillingPaymentDto[]): BillingPaymentDto[] {
  return payments
    .filter((item) => item.status === 'paid' && item.refundableUntil !== null)
    .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''));
}

/**
 * O bloco Desistir (Penpot 21, A9 "Bloco / Desistir"): por pagamento no prazo, o Alert com a
 * data e o valor e o Desistir e pedir reembolso; com o casamento bloqueado, o botão fica
 * desabilitado com o motivo (RN02; P6). Abaixo, as legendas do reembolso pedido e da
 * contestação (RN05 e RN06).
 */
export function RefundSection({
  weddingId,
  payments,
  timezone,
  blocked,
  now,
}: {
  weddingId: string;
  payments: BillingPaymentDto[];
  timezone: string | null;
  blocked: boolean;
  now: Date;
}) {
  const { t } = useTranslation('billing');
  const [open, setOpen] = useState<BillingPaymentDto | null>(null);
  const blockedId = useId();
  const items = refundable(payments);
  const requested = payments.some((item) => item.status === 'refund_requested');
  const disputed = payments.some((item) => item.status === 'disputed');
  if (items.length === 0 && !requested && !disputed) return null;
  return (
    <div className="kore-payments__refund">
      {items.map((payment) => (
        <div key={payment.id} className="kore-payments__refund-block">
          <Alert tone="info">
            {t(`refund.alert.${payment.kind}`, {
              date: dayMonthIn({ at: payment.refundableUntil ?? '', timezone, now }),
              amount: formatCents({ cents: refundTotal({ payment, payments }) }),
            })}
          </Alert>
          <Button
            variant="secondary"
            className="kore-payments__refund-action"
            disabled={blocked}
            {...(blocked && { 'aria-describedby': `${blockedId}-${payment.id}` })}
            onClick={() => setOpen(payment)}
          >
            {t('refund.action')}
          </Button>
          {blocked && (
            <p id={`${blockedId}-${payment.id}`} className="kore-payments__help">
              {t('refund.blocked')}
            </p>
          )}
        </div>
      ))}
      {requested && <Alert tone="info">{t('refund.requested')}</Alert>}
      {disputed && <Alert tone="info">{t('refund.disputed')}</Alert>}
      {open && (
        <RefundDialog
          weddingId={weddingId}
          payment={open}
          payments={payments}
          timezone={timezone}
          now={now}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

/** O Dialog de desistir, com o Motivo opcional (Penpot 21, "desistir com motivo"). */
function RefundDialog({
  weddingId,
  payment,
  payments,
  timezone,
  now,
  onClose,
}: {
  weddingId: string;
  payment: BillingPaymentDto;
  payments: BillingPaymentDto[];
  timezone: string | null;
  now: Date;
  onClose: () => void;
}) {
  const { t } = useTranslation('billing');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const kind = payment.kind;

  // O site muda no pedido (RN07): o /me, o billing e o site (o selo da Topbar) relidos.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() }),
      queryClient.invalidateQueries({ queryKey: getSiteControllerGetV1QueryKey(weddingId) }),
      queryClient.invalidateQueries({
        queryKey: getPaymentsControllerBillingV1QueryKey(weddingId),
      }),
    ]);
  const toastError = (message: string) => showToast({ tone: 'danger', message });

  async function confirm() {
    setSending(true);
    try {
      const trimmed = reason.trim();
      await paymentsControllerRefundV1(weddingId, payment.id, trimmed ? { reason: trimmed } : {});
      if (kind === 'publication') {
        showToast({ tone: 'success', message: t('refund.toast.publication') });
        await refresh();
      } else {
        // A data já voltou no pedido (RN07): o Toast usa a endDate relida (327(2)).
        const billing = await paymentsControllerBillingV1(weddingId);
        queryClient.setQueryData(getPaymentsControllerBillingV1QueryKey(weddingId), billing);
        void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
        void queryClient.invalidateQueries({ queryKey: getSiteControllerGetV1QueryKey(weddingId) });
        showToast({
          tone: 'success',
          message: oneDot(
            t('refund.toast.extension', {
              date: billing.endDate ? shortDayMonth({ day: billing.endDate, now }) : '',
            }),
          ),
        });
      }
      onClose();
    } catch (error) {
      setSending(false);
      const code = apiErrorCode({ error });
      switch (code) {
        case 'REFUND_WINDOW_CLOSED': {
          const body =
            error instanceof ApiError ? (error.body as { refundableUntil?: string | null }) : {};
          const until = body.refundableUntil ?? payment.refundableUntil;
          toastError(
            oneDot(
              t('refund.toast.windowClosed', {
                date: until ? dayMonthIn({ at: until, timezone, now }) : '',
              }),
            ),
          );
          break;
        }
        case 'REFUND_ALREADY_REQUESTED':
          toastError(t('refund.toast.alreadyRequested'));
          break;
        case 'REFUND_NOT_LAST_EXTENSION':
          toastError(t('refund.toast.notLastExtension'));
          break;
        case 'WEDDING_BLOCKED':
          // O /me novo desabilita o botão com o motivo (RN02; Bloqueado RN07).
          toastError(t('refund.blocked'));
          break;
        default:
          toastError(
            `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
          );
      }
      // O estado mudou no servidor (prazo, outro pedido, contestação): a tela relê.
      if (code !== undefined) {
        await refresh();
        onClose();
      }
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !sending) onClose();
      }}
      role="dialog"
      stackActions
      title={t(`refund.${kind}.title`)}
      description={refundDescription({ payment, payments, now, t })}
      actions={
        <>
          <Button variant="secondary" disabled={sending} onClick={onClose}>
            {t(`refund.${kind}.keep`)}
          </Button>
          <Button variant="destructive" disabled={sending} onClick={() => void confirm()}>
            {t('refund.action')}
          </Button>
        </>
      }
    >
      <div className="kore-payments__reason">
        <Label htmlFor={reasonId}>{t('refund.reason.label')}</Label>
        <Textarea
          id={reasonId}
          value={reason}
          maxLength={500}
          placeholder={t('refund.reason.placeholder')}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </Dialog>
  );
}
