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
 * O texto do Dialog (RN02; Pena; decisões 327(3) e 328, `.prs/f3/pena-327.md`). A publicação
 * com extensões: numa forma só, uma frase com o total e as partes ("cada valor no cartão que
 * pagou" ou "para a conta que pagou"); em formas diferentes, o total e uma frase por forma,
 * a da publicação primeiro. "Com os juros" vai junto do valor que os tem (de 7x a 12x).
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
  const total = formatCents({ cents: refundTotal({ payment, payments }) });
  if (payment.kind === 'extension') {
    // A data de volta, calculada pela API com o min(endDate, previousEndDate) da RN03 (327(2)).
    // Sem ela (não esperado na extensão no prazo), o início da extensão, e não "volta a ."
    // (sugestão do Crivo no E7).
    const date = shortDayMonth({ day: payment.refundEndDate ?? payment.periodStart, now });
    return oneDot(t(`refund.extension.${methodKey(payment)}`, { date, amount: total }));
  }
  const extensions = extensionsPaid(payments);
  if (extensions.length === 0)
    return t(`refund.publication.${methodKey(payment)}`, { amount: total });

  const sum = (items: BillingPaymentDto[]) =>
    items.reduce((value, item) => value + item.amountCents, 0);
  const interest = (items: BillingPaymentDto[]) =>
    items.some((item) => methodKey(item) === 'cardInterest');
  const all = [payment, ...extensions];
  if (all.every((item) => item.method === payment.method)) {
    const key = payment.method === 'pix' ? 'pix' : interest(all) ? 'cardInterest' : 'card';
    return t(`refund.publication.withExtensions.${key}`, {
      total,
      publication: formatCents({ cents: payment.amountCents }),
      extensions: t('refund.publication.withExtensions.extensions', {
        count: extensions.length,
        amount: formatCents({ cents: sum(extensions) }),
      }),
    });
  }

  // Formas diferentes: o total e uma frase por forma, a da publicação primeiro.
  const methods = [payment.method, payment.method === 'pix' ? 'card' : 'pix'] as const;
  const sentences = methods.map((method) => {
    const items = all.filter((item) => item.method === method);
    const own = items.filter((item) => item.kind === 'extension');
    const withPublication = items.includes(payment);
    const subject = withPublication
      ? own.length === 0
        ? t('refund.publication.withExtensions.subject.publication')
        : t('refund.publication.withExtensions.subject.publicationAndExtensions', {
            count: own.length,
          })
      : own.length === extensions.length
        ? t('refund.publication.withExtensions.subject.extensions', { count: own.length })
        : t('refund.publication.withExtensions.subject.otherExtensions', { count: own.length });
    const value = formatCents({ cents: sum(items) });
    return t('refund.publication.withExtensions.group', {
      count: items.length,
      subject,
      amount: interest(items)
        ? t('refund.publication.withExtensions.withInterest', { amount: value })
        : value,
      where: t(`refund.publication.withExtensions.where.${method}`),
    });
  });
  return [t('refund.publication.withExtensions.mixedTotal', { total }), ...sentences].join(' ');
}

/** O Alert do prazo: a publicação com extensões diz por que o total é maior (Pena, item 8). */
function alertText({
  payment,
  payments,
  timezone,
  now,
  t,
}: {
  payment: BillingPaymentDto;
  payments: BillingPaymentDto[];
  timezone: string | null;
  now: Date;
  t: TFunction<'billing'>;
}): string {
  const values = {
    date: dayMonthIn({ at: payment.refundableUntil ?? '', timezone, now }),
    amount: formatCents({ cents: refundTotal({ payment, payments }) }),
  };
  const extensions = payment.kind === 'publication' ? extensionsPaid(payments).length : 0;
  if (extensions > 0) {
    return t('refund.alert.publicationWithExtensions', { ...values, count: extensions });
  }
  return t(`refund.alert.${payment.kind}`, values);
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
          <Alert tone="info">{alertText({ payment, payments, timezone, now, t })}</Alert>
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

  /**
   * O pedido aceito (202) sempre fecha o Dialog e mostra o Toast, mesmo se a releitura
   * falhar: o reembolso já foi pedido no servidor (bloqueante do Crivo no E7). Na extensão, a
   * data vem do billing relido e, na falha, do `refundEndDate` do pagamento (327(2)).
   */
  async function accepted() {
    onClose();
    if (kind === 'publication') {
      showToast({ tone: 'success', message: t('refund.toast.publication') });
      await refresh().catch(() => undefined);
      return;
    }
    let endDate = payment.refundEndDate;
    try {
      const billing = await paymentsControllerBillingV1(weddingId);
      queryClient.setQueryData(getPaymentsControllerBillingV1QueryKey(weddingId), billing);
      endDate = billing.endDate ?? endDate;
    } catch {
      void queryClient.invalidateQueries({
        queryKey: getPaymentsControllerBillingV1QueryKey(weddingId),
      });
    }
    void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
    void queryClient.invalidateQueries({ queryKey: getSiteControllerGetV1QueryKey(weddingId) });
    showToast({
      tone: 'success',
      message: oneDot(
        t('refund.toast.extension', { date: endDate ? shortDayMonth({ day: endDate, now }) : '' }),
      ),
    });
  }

  async function confirm() {
    setSending(true);
    try {
      const trimmed = reason.trim();
      await paymentsControllerRefundV1(weddingId, payment.id, trimmed ? { reason: trimmed } : {});
    } catch (error) {
      setSending(false);
      await reject(error);
      return;
    }
    await accepted();
  }

  /** O pedido recusado: o Toast da causa e, com código, a tela relida (os 409 em corrida). */
  async function reject(error: unknown) {
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
        toastError(`${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`);
    }
    // O estado mudou no servidor (prazo, outro pedido, contestação): a tela relê.
    if (code !== undefined) {
      await refresh().catch(() => undefined);
      onClose();
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
