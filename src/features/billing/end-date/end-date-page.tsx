import { Alert, Button, DateField, PageHeader, Spinner, useToast } from '@kore-io/design';
import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useAreaPaths } from '../../../app/area';
import {
  getPaymentsControllerBillingV1QueryKey,
  paymentsControllerEndDateV1,
  useBillingQuoteControllerGetQuoteV1,
  usePricingControllerPricingV1,
} from '../../../shared/api/generated/billing/billing';
import {
  getMeControllerMeV1QueryKey,
  useMeControllerMeV1,
} from '../../../shared/api/generated/me/me';
import type {
  BillingQuoteResponse,
  MeMembershipResponse,
  PricingResponse,
} from '../../../shared/api/generated/model';
import { getDashboardControllerGetV1QueryKey } from '../../../shared/api/generated/rsvp/rsvp';
import { getSiteControllerGetV1QueryKey } from '../../../shared/api/generated/site/site';
import { apiErrorCode } from '../../../shared/api/http-client';
import { FormField } from '../../../shared/components/form-field';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { Panel } from '../../../shared/components/panel';
import { ValueList, ValueRow, ValueTotal } from '../../../shared/components/value-list';
import { oneDot, shortDate, shortDayMonth } from '../../../shared/date-texts';
import { useDebouncedValue } from '../../../shared/hooks/use-debounced-value';
import { formatCents, formatRulePrice } from '../../../shared/money';
import { useActiveWedding } from '../../guests/hooks/use-active-wedding';
import { todayIn } from '../../site/site-texts';
import { MethodPanel, type Method } from '../publish/method-panel';
import {
  CardFields,
  EMPTY_CARD,
  EMPTY_PAYER,
  PayerPanel,
  payErrors,
  previousPayerId,
  type CardValues,
  type PayErrors,
  type PayerValues,
} from '../publish/pay-fields';
import { digitsOnly, localCardToken } from '../publish/payment-form';
import type { PublishLocationState } from '../publish/publish-page';
import { installmentOptions } from '../publish/quote-view';
import { usePublishPayment } from '../publish/use-publish-payment';
import {
  canChangeEndDate,
  endDateChoice,
  endDateLimits,
  paidAhead,
  type EndDateChoice,
  type EndDateSource,
} from './end-date';

/** O tempo de espera da data digitada antes de pedir a cotação (o mesmo do Publicar). */
const QUOTE_DEBOUNCE_MS = 300;

/**
 * Mudar a data de saída do ar (`…/cobranca/data-de-saida`; Data de saída RN04 e RN05; 289;
 * 293; 294; Penpot 21, A6 e A7). O que não cobra vai pelo `PATCH …/end-date` (antecipar e
 * voltar de graça até o `paidThrough`, também no expirado: Voltar ao ar). A data depois do
 * `paidThrough` é a extensão (E11): a cotação `kind=extension`, a forma, o Quem paga e o
 * Resumo, com o Pagar e adiar ou o Pagar e renovar, que reaproveitam o pagar do Publicar
 * (E3 e E4). Sem data possível, a A7 (o sem renovação). Só o dono muda a data.
 */
export function EndDatePage() {
  const { weddingId, role } = useActiveWedding();
  const paths = useAreaPaths();
  const { data: me } = useMeControllerMeV1();
  if (!weddingId || !me) return null;
  const membership = me.memberships.find((item) => item.weddingId === weddingId);
  if (role !== 'owner' || !membership?.lifecycle) {
    return <Navigate to={paths.billing} replace />;
  }
  return <EndDateLoader weddingId={weddingId} membership={membership} />;
}

function sourceOf(membership: MeMembershipResponse): EndDateSource {
  return {
    status: membership.lifecycle.status,
    endDate: membership.lifecycle.endDate,
    paidThrough: membership.lifecycle.paidThrough,
    eventDate: membership.eventDate,
    timezone: membership.timezone,
  };
}

/** A tabela de preços e os limites da extensão (o `canExtend` da A7) antes da tela. */
function EndDateLoader({
  weddingId,
  membership,
}: {
  weddingId: string;
  membership: MeMembershipResponse;
}) {
  const { t } = useTranslation('billing');
  const paths = useAreaPaths();
  const source = sourceOf(membership);
  const allowed = canChangeEndDate({ status: source.status });
  const pricing = usePricingControllerPricingV1();
  const limits = useBillingQuoteControllerGetQuoteV1(
    weddingId,
    { kind: 'extension', method: 'pix' },
    { query: { enabled: allowed } },
  );
  if (!allowed) return <Navigate to={paths.billing} replace />;
  if (pricing.isError || limits.isError) {
    return (
      <LoadErrorNotice
        onRetry={() => {
          if (pricing.isError) void pricing.refetch();
          if (limits.isError) void limits.refetch();
        }}
      />
    );
  }
  if (!pricing.data || !limits.data) {
    return (
      <div className="kore-end-date__loading">
        <Spinner label={t('endDate.loading')} />
      </div>
    );
  }
  // Sem data possível dentro do limite e sem mês pago à frente: a A7 (314; Retenção RN01).
  if (!limits.data.canExtend && paidAhead({ source, now: new Date() }) === null) {
    return <FinalScreen weddingId={weddingId} membership={membership} />;
  }
  return <EndDate weddingId={weddingId} membership={membership} pricing={pricing.data} />;
}

/** A A7 (Penpot 21, "Mudar a data — sem renovação"): o Alert, a guarda dos dados e o Exportar. */
function FinalScreen({
  weddingId,
  membership,
}: {
  weddingId: string;
  membership: MeMembershipResponse;
}) {
  const { t } = useTranslation('billing');
  const paths = useAreaPaths();
  const payment = usePublishPayment({ weddingId, kind: 'extension' });
  const purgeAt = payment.billing?.purgeAt ?? null;
  const expiredAt = membership.lifecycle.expiredAt;
  return (
    <div className="kore-end-date">
      <PageHeader
        title={t('endDate.title')}
        {...(expiredAt && {
          description: oneDot(t('endDate.offAirSinceFull', { date: shortDate(expiredAt) })),
        })}
      />
      <Alert tone="danger" title={t('endDate.final.alert')} className="kore-end-date__final">
        {purgeAt && (
          <p className="kore-end-date__final-text">
            {oneDot(t('endDate.final.retention', { date: shortDate(purgeAt.slice(0, 10)) }))}
          </p>
        )}
        <Link to={paths.guestExport} className="kore-end-date__final-link">
          {t('endDate.final.exportGuests')}
        </Link>
      </Alert>
    </div>
  );
}

function EndDate({
  weddingId,
  membership,
  pricing,
}: {
  weddingId: string;
  membership: MeMembershipResponse;
  pricing: PricingResponse;
}) {
  const { t } = useTranslation('billing');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const paths = useAreaPaths();
  const location = useLocation();
  const from = (location.state ?? {}) as PublishLocationState;
  const reasonId = useId();
  const now = new Date();
  const source = sourceOf(membership);
  const expired = source.status === 'expired';
  const ahead = paidAhead({ source, now });
  const limits = endDateLimits({ source, now });
  const [date, setDate] = useState(() => {
    if (from.endDate) return from.endDate;
    if (expired) return ahead ?? '';
    // Na carência a data atual já passou: o campo abre vazio, ou no mês pago à frente
    // (sugestão do Crivo no E10).
    if (limits && source.endDate && source.endDate < limits.min) return ahead ?? '';
    return source.endDate ?? '';
  });
  const [method, setMethod] = useState<Method>(from.method ?? 'card');
  const [installments, setInstallments] = useState(1);
  const [card, setCard] = useState<CardValues>(EMPTY_CARD);
  const [payer, setPayer] = useState<PayerValues>(EMPTY_PAYER);
  const [errors, setErrors] = useState<PayErrors>({});
  const [beyondPaid, setBeyondPaid] = useState(false);
  const [sending, setSending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => {
    if (focusRequest === 0) return;
    rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);

  const payment = usePublishPayment({ weddingId, kind: 'extension' });
  // Reabrir com a extensão pendente: o cartão no Confirmando, o Pix na tela dele (324).
  const pending = payment.billing?.pendingPayment;
  const resumable =
    pending?.kind === 'extension' && from.replacesPaymentId === undefined ? pending : null;
  const resumed = useRef(false);
  useEffect(() => {
    if (resumable?.method !== 'card' || resumed.current) return;
    resumed.current = true;
    setDate((current) => (current === '' ? resumable.endDate : current));
    payment.resume({ paymentId: resumable.paymentId });
  }, [resumable?.method, resumable?.paymentId, resumable?.endDate, payment]);

  const debouncedDate = useDebouncedValue({ value: date, delayMs: QUOTE_DEBOUNCE_MS });
  const choice: EndDateChoice = date ? endDateChoice({ source, date, now }) : 'invalid';
  const extending = choice === 'extend' && debouncedDate === date;
  const free = pricing.installments.interestFreeUpTo;
  const quote = useBillingQuoteControllerGetQuoteV1(
    weddingId,
    {
      kind: 'extension',
      endDate: debouncedDate,
      method,
      ...(method === 'card' && { installments }),
    },
    { query: { enabled: extending, placeholderData: keepPreviousData } },
  );
  const maxInstallments = quote.data?.maxInstallments ?? null;
  const interestQuote = useBillingQuoteControllerGetQuoteV1(
    weddingId,
    { kind: 'extension', endDate: debouncedDate, method: 'card', installments: free + 1 },
    {
      query: {
        enabled:
          extending && method === 'card' && maxInstallments !== null && maxInstallments > free,
      },
    },
  );
  if (maxInstallments !== null && installments > maxInstallments) setInstallments(maxInstallments);

  if (!limits) return <Navigate to={paths.billing} replace />;
  // Reabrir com o Pix da extensão pendente: a tela do Pix.
  if (resumable?.method === 'pix') {
    const state: PublishLocationState = { endDate: resumable.endDate, kind: 'extension' };
    return <Navigate to={paths.billingPix} replace state={state} />;
  }

  const day = (value: string) => shortDayMonth({ day: value, now });
  const blocked = membership.lifecycle.blocked;
  const busy = payment.state.kind === 'sending' || payment.state.kind === 'confirming';
  const shown = extending ? quote.data : undefined;
  const quoteFailed = extending && quote.isError;
  const options =
    shown?.totalsByMethod && shown.maxInstallments
      ? installmentOptions({
          maxInstallments: shown.maxInstallments,
          interestFreeUpTo: free,
          cardWithoutInterestCents: shown.totalsByMethod.cardUpTo6,
          cardWithInterestCents: interestQuote.data?.totalsByMethod?.cardChosen ?? null,
        })
      : [];

  const subtitle = expired
    ? membership.lifecycle.expiredAt &&
      oneDot(t('endDate.offAirSince', { date: day(membership.lifecycle.expiredAt) }))
    : (() => {
        // Na carência, o site fica no ar até o fim do graceUntil (RN01).
        const until = source.status === 'grace' ? membership.lifecycle.graceUntil : source.endDate;
        return until && oneDot(t('endDate.onAirUntil', { date: day(until) }));
      })();
  // A ajuda do campo (RN04; 293(1)(3)): no expirado depois do pago, de onde os meses contam.
  const renewHelp =
    expired && choice === 'extend' && shown
      ? shown.periodStart === todayIn({ timezone: source.timezone, now })
        ? t('endDate.helpRenewToday')
        : t('endDate.helpRenewPaid', { paidThrough: shortDate(shown.periodStart) })
      : null;
  const help =
    renewHelp ??
    (ahead
      ? t('endDate.helpPaidAhead', { paidThrough: day(ahead), max: day(limits.max) })
      : t('endDate.help', { max: day(limits.max) }));
  const outOfRange = date !== '' && choice === 'invalid';

  // O primário pelo caso (Penpot 21, A6; 293(4)).
  const primary =
    choice === 'bringForward'
      ? t('endDate.bringForward')
      : choice === 'restore'
        ? expired
          ? t('endDate.backOnline')
          : t('endDate.backDate')
        : expired
          ? t('endDate.renew')
          : t('endDate.extend');
  const free_ = choice === 'bringForward' || choice === 'restore';
  const canPay =
    choice === 'extend' &&
    extending &&
    !busy &&
    shown?.totalCents !== undefined &&
    shown.totalCents !== null;
  const canSubmit = !blocked && !sending && !busy && (free_ || canPay);

  function refresh() {
    return Promise.all(
      [
        getMeControllerMeV1QueryKey(),
        getPaymentsControllerBillingV1QueryKey(weddingId),
        getSiteControllerGetV1QueryKey(weddingId),
        getDashboardControllerGetV1QueryKey(weddingId),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    ).catch(() => undefined);
  }

  async function changeFree() {
    setSending(true);
    setBeyondPaid(false);
    try {
      const changed = await paymentsControllerEndDateV1(weddingId, { endDate: date });
      // O Toast da 293(6): no expirado, "voltou ao ar"; nos outros, "fica no ar até".
      showToast({
        tone: 'success',
        message: oneDot(
          t(expired ? 'endDate.toast.backOnline' : 'endDate.toast.until', {
            date: day(changed.endDate),
          }),
        ),
      });
      await refresh();
      void navigate(paths.billing);
    } catch (error) {
      setSending(false);
      const code = apiErrorCode({ error });
      if (code === 'END_DATE_BEYOND_PAID') {
        // A data passou do paidThrough entre a tela e o envio (293(8); 294(1)).
        setBeyondPaid(true);
        void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
        return;
      }
      if (code === 'WEDDING_BLOCKED') {
        void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
        showToast({ tone: 'danger', message: t('publish.reason.blocked') });
        return;
      }
      showToast({
        tone: 'danger',
        message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
      });
      if (code !== undefined) {
        void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
      }
    }
  }

  async function pay() {
    if (!shown?.totalCents) return;
    const found = payErrors({
      method,
      card,
      payer,
      previousPayer: payment.previousPayer,
      now: new Date(),
      t,
    });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFocusRequest((count) => count + 1);
      return;
    }
    const payerId = previousPayerId({ payer, previousPayer: payment.previousPayer });
    const failure = await payment.pay({
      body: {
        kind: 'extension',
        endDate: debouncedDate,
        method,
        payer:
          payerId !== null
            ? { payerId }
            : { name: payer.name.trim(), taxId: digitsOnly(payer.taxId) },
        installments: method === 'card' ? installments : 1,
        ...(method === 'card' && { cardToken: localCardToken({ number: card.number }) }),
        ...(from.replacesPaymentId !== undefined && { replacesPaymentId: from.replacesPaymentId }),
        priceVersion: shown.priceVersion,
        expectedTotalCents: shown.totalCents,
      },
    });
    if (failure === 'priceChanged' || failure === 'quoteStale') void quote.refetch();
    if (failure === 'payerNotFound') setPayer((current) => ({ ...current, useOther: true }));
  }

  return (
    <div className="kore-end-date" ref={rootRef}>
      <PageHeader title={t('endDate.title')} {...(subtitle && { description: subtitle })} />
      <div className="kore-end-date__columns">
        <div className="kore-end-date__choices">
          <Panel>
            <FormField
              label={t('endDate.label')}
              hint={
                beyondPaid
                  ? t('endDate.beyondPaid')
                  : outOfRange
                    ? // A data mínima e o limite, com o ano (decisão 335; pena-e11).
                      t('publish.endDate.outOfRange', {
                        min: shortDate(limits.min),
                        max: shortDate(limits.max),
                      })
                    : help
              }
              hintTone={beyondPaid || outOfRange ? 'danger' : 'neutral'}
            >
              {({ id, describedBy, invalid }) => (
                <DateField
                  id={id}
                  value={date}
                  min={limits.min}
                  max={limits.max}
                  invalid={invalid}
                  disabled={sending || busy}
                  {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
                  onChange={(event) => {
                    setBeyondPaid(false);
                    setDate(event.target.value);
                  }}
                />
              )}
            </FormField>
          </Panel>
          {choice === 'extend' && (
            <>
              <MethodPanel
                pricing={pricing}
                method={method}
                onMethodChange={setMethod}
                installments={installments}
                onInstallmentsChange={setInstallments}
                options={options}
                quote={shown}
                disabled={blocked || busy}
              >
                <CardFields
                  values={card}
                  errors={errors}
                  disabled={blocked || busy}
                  onChange={(values) => {
                    setCard(values);
                    setErrors({});
                    if (payment.state.kind === 'declined') payment.dismissDeclined();
                  }}
                />
              </MethodPanel>
              <PayerPanel
                values={payer}
                errors={errors}
                previousPayer={payment.previousPayer}
                disabled={blocked || busy}
                onChange={(values) => {
                  setPayer(values);
                  setErrors({});
                }}
              />
            </>
          )}
        </div>
        <div className="kore-end-date__summary">
          {choice === 'extend' &&
            (quoteFailed ? (
              <LoadErrorNotice onRetry={() => void quote.refetch()} />
            ) : (
              <ExtensionSummary
                pricing={pricing}
                quote={shown}
                expired={expired}
                timezone={source.timezone}
                now={now}
              />
            ))}
          {choice === 'bringForward' && <Alert tone="info">{t('endDate.bringForwardAlert')}</Alert>}
          {choice === 'restore' && source.paidThrough && (
            <Alert tone="info">
              {oneDot(t('endDate.freeAlert', { date: day(source.paidThrough) }))}
            </Alert>
          )}
          {payment.state.kind === 'declined' && (
            <Alert tone="danger" role="alert">
              {t('publish.declined')}
            </Alert>
          )}
          {payment.state.kind === 'confirming' ? (
            <div id={reasonId} className="kore-end-date__confirming">
              <Spinner label={t('publish.confirming')} />
              <span aria-hidden="true">{t('publish.confirming')}</span>
            </div>
          ) : (
            blocked && (
              <p id={reasonId} className="kore-end-date__reason">
                {t('publish.reason.blocked')}
              </p>
            )
          )}
          <div className="kore-end-date__buttons">
            <Button variant="secondary" size="lg" onClick={() => void navigate(paths.billing)}>
              {t('endDate.cancel')}
            </Button>
            <Button
              size="lg"
              disabled={!canSubmit}
              {...((blocked || payment.state.kind === 'confirming') && {
                'aria-describedby': reasonId,
              })}
              onClick={() => void (free_ ? changeFree() : pay())}
            >
              {sending ? <Spinner label={primary} /> : primary}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * O Resumo da extensão (Penpot 21, A6; Data de saída RN04): "3 meses a mais × R$ 29" (adiar)
 * ou "{n} meses × R$ 29 (de hoje|{início} até {data})" (renovar o expirado, pelo `periodStart`
 * da cotação; 293(2)), o desconto do Pix, os juros e o Total. Sem ativação, teto nem indicação.
 */
function ExtensionSummary({
  pricing,
  quote,
  expired,
  timezone,
  now,
}: {
  pricing: PricingResponse;
  quote: BillingQuoteResponse | undefined;
  expired: boolean;
  timezone: string | null;
  now: Date;
}) {
  const { t } = useTranslation('billing');
  if (!quote || quote.totalCents === null || quote.monthsCovered === null) {
    return (
      <Panel title={t('publish.summary.title')}>
        <p className="kore-end-date__empty">{t('publish.summary.empty')}</p>
      </Panel>
    );
  }
  const brl = (cents: number) => formatCents({ cents });
  const monthly = formatRulePrice({ cents: pricing.monthlyCents });
  const months = quote.monthsCovered;
  const start =
    quote.periodStart === todayIn({ timezone, now })
      ? t('endDate.summary.today')
      : shortDate(quote.periodStart);
  const label = expired
    ? t('endDate.summary.renewMonths', {
        count: months,
        monthly,
        start,
        end: quote.periodEnd ? shortDate(quote.periodEnd) : '',
      })
    : t('endDate.summary.months', { count: months, monthly });
  return (
    <Panel title={t('publish.summary.title')}>
      <ValueList>
        <ValueRow label={label} value={brl(quote.listTotalCents ?? quote.totalCents)} />
        {quote.pixDiscountCents ? (
          <ValueRow
            label={t('publish.summary.pix', { percent: pricing.pixDiscountPercent })}
            value={brl(-quote.pixDiscountCents)}
          />
        ) : null}
        {quote.installmentInterestCents && quote.installments ? (
          <ValueRow
            label={t('publish.summary.interest', { count: quote.installments })}
            value={brl(quote.installmentInterestCents)}
          />
        ) : null}
        <ValueTotal label={t('publish.summary.total')} value={brl(quote.totalCents)} />
      </ValueList>
    </Panel>
  );
}
