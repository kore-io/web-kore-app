import { Alert, Button, DateField, PageHeader, Select, Spinner } from '@kore-io/design';
import { keepPreviousData } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useAreaPaths } from '../../../app/area';
import {
  useBillingQuoteControllerGetQuoteV1,
  usePricingControllerPricingV1,
} from '../../../shared/api/generated/billing/billing';
import { useMeControllerMeV1 } from '../../../shared/api/generated/me/me';
import type {
  BillingQuoteResponse,
  MeMembershipResponse,
  PricingResponse,
} from '../../../shared/api/generated/model';
import { useSiteControllerGetV1 } from '../../../shared/api/generated/site/site';
import { apiErrorCode } from '../../../shared/api/http-client';
import { FormField } from '../../../shared/components/form-field';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { Panel } from '../../../shared/components/panel';
import { PaymentOption, PaymentOptionGroup } from '../../../shared/components/payment-option';
import { ValueList, ValueRow, ValueTotal } from '../../../shared/components/value-list';
import { shortDate, shortDayMonth } from '../../../shared/date-texts';
import { useDebouncedValue } from '../../../shared/hooks/use-debounced-value';
import { formatCents, formatRulePrice } from '../../../shared/money';
import { TERMS_URL } from '../../../site/links';
import { useActiveWedding } from '../../guests/hooks/use-active-wedding';
import { usePublishPayment } from './use-publish-payment';
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
} from './pay-fields';
import { digitsOnly, localCardToken } from './payment-form';
import {
  capStartsAtMonths,
  installmentOptions,
  isEndDateInRange,
  percentText,
  summaryRows,
  type InstallmentOption,
  type SummaryRow,
} from './quote-view';

type Method = 'pix' | 'card';

/**
 * O Publicar aberto pela tela do Pix (Gerar novo Pix, Pagar com cartão; decisão 324): a forma,
 * a data, quando o app a tem, e o pendente que o novo pagamento troca (RN07).
 */
export interface PublishLocationState {
  method?: Method;
  endDate?: string;
  replacesPaymentId?: string;
}

function readPublishState(state: unknown): PublishLocationState {
  return typeof state === 'object' && state !== null ? (state as PublishLocationState) : {};
}

/** O tempo de espera da data digitada antes de pedir a cotação. */
const QUOTE_DEBOUNCE_MS = 300;

/** Os status em que o site já está publicado: o Publicar não serve mais, volta ao Dashboard. */
const PUBLISHED = new Set(['published', 'post_event', 'grace', 'expired']);

/**
 * Publicar o site (`…/cobranca/publicar`; Publicar e pagar RN01; Preço e cotação RN03,
 * RN04 e RN09; Penpot 21, A1 a A4): a cotação (a data, a forma, as parcelas, o Resumo, o
 * Comparar e o Resumo do contrato, com os bloqueios ao lado do botão) e, no E3, o pagar com
 * o cartão (Quem paga, os campos do cartão, o recusado e a confirmação). Com o Pix, o Pagar
 * e publicar fica desabilitado até o E4 (decisão 322(3)).
 */
export function PublishPage() {
  const { weddingId, role } = useActiveWedding();
  const { data: me } = useMeControllerMeV1();
  const membership = me?.memberships.find((item) => item.weddingId === weddingId);
  if (!weddingId || !membership) return null;
  // A colaboradora (e quem não é dono) vê a versão mínima (decisão 323).
  if (role !== 'owner') return <PlannerPublish />;
  return <CouplePublish weddingId={weddingId} membership={membership} />;
}

/** O cabeçalho da tela; a colaboradora vê o título sem o subtítulo, que fala ao casal (323). */
function PublishHeader({ withDescription = true }: { withDescription?: boolean }) {
  const { t } = useTranslation('billing');
  return (
    <PageHeader
      title={t('publish.title')}
      {...(withDescription && { description: t('publish.description') })}
    />
  );
}

/** O Resumo do contrato; o preço e a data só com a cotação (o casal). */
function ContractPanel({ price }: { price?: { totalCents: number; endDate: string } }) {
  const { t } = useTranslation('billing');
  const now = new Date();
  return (
    <Panel title={t('publish.contract.title')}>
      <p className="kore-publish__contract-text">{t('publish.contract.included')}</p>
      {price && (
        <p className="kore-publish__contract-text">
          {t('publish.contract.price', {
            total: formatCents({ cents: price.totalCents }),
            date: shortDayMonth({ day: price.endDate, now }),
          })}
        </p>
      )}
      <p className="kore-publish__contract-text">{t('publish.contract.refund')}</p>
      <a className="kore-publish__terms" href={TERMS_URL} target="_blank" rel="noreferrer">
        {t('publish.contract.terms')}
      </a>
    </Panel>
  );
}

/**
 * O motivo acima dos botões e os botões (Penpot: Cancelar e Pagar e publicar à direita; no
 * celular, a largura toda, com o Pagar em cima). O motivo, quando há, é o que o app conhece
 * antes do clique (228(4)); enquanto o cartão é confirmado, o Spinner com a frase da Pena.
 */
function PublishActions({
  reason,
  onPay,
  confirming = false,
}: {
  reason?: string | undefined;
  /** Sem ele, o Pagar e publicar fica desabilitado. */
  onPay?: (() => void) | undefined;
  confirming?: boolean;
}) {
  const { t } = useTranslation('billing');
  const navigate = useNavigate();
  const paths = useAreaPaths();
  const reasonId = useId();
  return (
    <div className="kore-publish__actions">
      {confirming ? (
        <div id={reasonId} className="kore-publish__confirming">
          <Spinner label={t('publish.confirming')} />
          <span aria-hidden="true">{t('publish.confirming')}</span>
        </div>
      ) : (
        reason !== undefined && (
          <p id={reasonId} className="kore-publish__reason">
            {reason}
          </p>
        )
      )}
      <div className="kore-publish__buttons">
        <Button variant="secondary" size="lg" onClick={() => void navigate(paths.dashboard)}>
          {t('publish.cancel')}
        </Button>
        <Button
          size="lg"
          disabled={onPay === undefined}
          {...((reason !== undefined || confirming) && { 'aria-describedby': reasonId })}
          {...(onPay !== undefined && { onClick: onPay })}
        >
          {t('publish.pay')}
        </Button>
      </div>
    </div>
  );
}

/** A colaboradora: o cabeçalho, o contrato sem o preço e o botão com o motivo (decisão 323). */
function PlannerPublish() {
  const { t } = useTranslation('billing');
  return (
    <div className="kore-publish">
      <PublishHeader withDescription={false} />
      <div className="kore-publish__planner">
        <ContractPanel />
        <PublishActions reason={t('publish.reason.planner')} />
      </div>
    </div>
  );
}

function CouplePublish({
  weddingId,
  membership,
}: {
  weddingId: string;
  membership: MeMembershipResponse;
}) {
  const { t } = useTranslation('billing');
  const paths = useAreaPaths();
  const site = useSiteControllerGetV1(weddingId);
  const pricing = usePricingControllerPricingV1();
  const { status, blocked } = membership.lifecycle;
  const ready = site.data !== undefined && pricing.data !== undefined;
  // O que impede a cotação antes de qualquer escolha (RN01; Cortesia RN03 e RN04).
  const blocker = ((): string | undefined => {
    if (blocked) return t('publish.reason.blocked');
    if (status === 'awaiting_couple') return t('publish.reason.awaitingCouple');
    if (!site.data) return undefined;
    if (!site.data.eventDate) {
      return site.data.state
        ? t('publish.reason.noEventDate')
        : t('publish.reason.noEventDateAndState');
    }
    if (!site.data.slug) return t('publish.reason.noSlug');
    return undefined;
  })();
  const limits = useBillingQuoteControllerGetQuoteV1(
    weddingId,
    { kind: 'publication', method: 'pix' },
    { query: { enabled: ready && blocker === undefined } },
  );

  if (PUBLISHED.has(status)) return <Navigate to={paths.dashboard} replace />;
  if (site.isError || pricing.isError || limits.isError) {
    return (
      <LoadErrorNotice
        onRetry={() => {
          if (site.isError) void site.refetch();
          if (pricing.isError) void pricing.refetch();
          if (limits.isError) void limits.refetch();
        }}
      />
    );
  }
  if (!site.data || !pricing.data || (blocker === undefined && !limits.data)) {
    return (
      <div className="kore-publish__loading">
        <Spinner label={t('publish.loading')} />
      </div>
    );
  }
  return (
    <PublishForm
      weddingId={weddingId}
      pricing={pricing.data}
      limits={limits.data ?? null}
      blocker={blocker}
    />
  );
}

function PublishForm({
  weddingId,
  pricing,
  limits,
  blocker,
}: {
  weddingId: string;
  pricing: PricingResponse;
  limits: BillingQuoteResponse | null;
  blocker: string | undefined;
}) {
  const { t } = useTranslation('billing');
  const paths = useAreaPaths();
  const location = useLocation();
  const from = readPublishState(location.state);
  const [endDate, setEndDate] = useState(from.endDate ?? '');
  const [method, setMethod] = useState<Method>(from.method ?? 'card');
  const [installments, setInstallments] = useState(1);
  const [card, setCard] = useState<CardValues>(EMPTY_CARD);
  const [payer, setPayer] = useState<PayerValues>(EMPTY_PAYER);
  const [errors, setErrors] = useState<PayErrors>({});
  // Depois do Pagar com erros, o foco vai ao 1º campo inválido (sugestão do Crivo no E3).
  const rootRef = useRef<HTMLDivElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => {
    if (focusRequest === 0) return;
    rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);
  const payment = usePublishPayment({ weddingId });
  // Reabrir com o cartão pendente: o Confirmando de novo (324; cobrança do Crivo no E3).
  const pending = payment.billing?.pendingPayment;
  const resumable =
    pending?.kind === 'publication' && from.replacesPaymentId === undefined ? pending : null;
  const resumed = useRef(false);
  useEffect(() => {
    if (resumable?.method !== 'card' || resumed.current) return;
    resumed.current = true;
    payment.resume({ paymentId: resumable.paymentId });
    // A trava retoma uma vez só, quando o pendente aparece.
  }, [resumable?.method, resumable?.paymentId, payment]);
  const debouncedEndDate = useDebouncedValue({ value: endDate, delayMs: QUOTE_DEBOUNCE_MS });
  const free = pricing.installments.interestFreeUpTo;
  const max = limits?.endDateMax ?? null;
  const inRange =
    limits !== null &&
    max !== null &&
    debouncedEndDate !== '' &&
    isEndDateInRange({ endDate: debouncedEndDate, min: limits.endDateMin, max });
  const typedOutOfRange =
    limits !== null &&
    max !== null &&
    endDate !== '' &&
    !isEndDateInRange({ endDate, min: limits.endDateMin, max });

  const quote = useBillingQuoteControllerGetQuoteV1(
    weddingId,
    {
      kind: 'publication',
      endDate: debouncedEndDate,
      method,
      ...(method === 'card' && { installments }),
    },
    { query: { enabled: inRange, placeholderData: keepPreviousData } },
  );
  const maxInstallments = quote.data?.maxInstallments ?? null;
  // O total com juros é o mesmo de 7x a 12x (RN01): uma 2ª cotação na 1ª parcela com juros
  // (decisão 322). Só quando o cartão permite parcelar com juros.
  const interestQuote = useBillingQuoteControllerGetQuoteV1(
    weddingId,
    { kind: 'publication', endDate: debouncedEndDate, method: 'card', installments: free + 1 },
    {
      query: {
        enabled: inRange && method === 'card' && maxInstallments !== null && maxInstallments > free,
      },
    },
  );
  // Um máximo de parcelas menor que a escolhida (a data mudou): volta ao máximo.
  if (maxInstallments !== null && installments > maxInstallments) setInstallments(maxInstallments);

  const fieldError =
    typedOutOfRange || apiErrorCode({ error: quote.error }) === 'END_DATE_OUT_OF_RANGE';
  const quoteFailed = quote.isError && !fieldError;
  const shown = inRange && !fieldError ? quote.data : undefined;
  const options =
    shown?.totalsByMethod && shown.maxInstallments
      ? installmentOptions({
          maxInstallments: shown.maxInstallments,
          interestFreeUpTo: free,
          cardWithoutInterestCents: shown.totalsByMethod.cardUpTo6,
          cardWithInterestCents: interestQuote.data?.totalsByMethod?.cardChosen ?? null,
        })
      : [];

  const maxText = max !== null ? shortDate(max) : '';
  const reason =
    blocker ?? (fieldError ? undefined : endDate === '' ? t('publish.reason.noDate') : undefined);
  const busy = payment.state.kind === 'sending' || payment.state.kind === 'confirming';
  const canPay =
    blocker === undefined &&
    !fieldError &&
    !busy &&
    shown?.totalCents !== undefined &&
    shown.totalCents !== null &&
    debouncedEndDate === endDate;

  async function submit() {
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
        kind: 'publication',
        endDate: debouncedEndDate,
        method,
        payer:
          payerId !== null
            ? { payerId }
            : { name: payer.name.trim(), taxId: digitsOnly(payer.taxId) },
        // No Pix, à vista: 1 (o campo é obrigatório no contrato).
        installments: method === 'card' ? installments : 1,
        ...(method === 'card' && { cardToken: localCardToken({ number: card.number }) }),
        ...(from.replacesPaymentId !== undefined && { replacesPaymentId: from.replacesPaymentId }),
        priceVersion: shown.priceVersion,
        expectedTotalCents: shown.totalCents,
      },
    });
    // O valor mudou ou a data e as parcelas saíram dos limites: a cotação de novo (RN05).
    if (failure === 'priceChanged' || failure === 'quoteStale') void quote.refetch();
    // O pagador anterior sumiu do gateway: o CPF de novo (316(3)).
    if (failure === 'payerNotFound') setPayer((current) => ({ ...current, useOther: true }));
  }

  // Reabrir com o Pix pendente: a tela do Pix (324).
  if (resumable?.method === 'pix') {
    // A data vai junto quando o app a tem (o Gerar novo Pix volta com ela; 324).
    const state: PublishLocationState = endDate !== '' ? { endDate } : {};
    return <Navigate to={paths.billingPix} replace state={state} />;
  }

  return (
    <div className="kore-publish" ref={rootRef}>
      <PublishHeader />
      <div className="kore-publish__columns">
        <div className="kore-publish__choices">
          <Panel>
            <FormField
              label={t('publish.endDate.label')}
              {...(max !== null && {
                hint: fieldError
                  ? t('publish.endDate.outOfRange', { max: maxText })
                  : t('publish.endDate.help', { max: maxText }),
                hintTone: fieldError ? 'danger' : 'neutral',
              })}
            >
              {({ id, describedBy, invalid }) => (
                <DateField
                  id={id}
                  value={endDate}
                  disabled={blocker !== undefined}
                  invalid={invalid}
                  {...(limits?.endDateMin && { min: limits.endDateMin })}
                  {...(max !== null && { max })}
                  {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              )}
            </FormField>
            {shown && shown.endDateMax !== debouncedEndDate && (
              <Alert tone="info">
                {t('publish.monthsAlert', {
                  cap: formatRulePrice({ cents: pricing.capCents }),
                  monthly: formatRulePrice({ cents: pricing.monthlyCents }),
                })}
              </Alert>
            )}
          </Panel>
          <MethodPanel
            pricing={pricing}
            method={method}
            onMethodChange={setMethod}
            installments={installments}
            onInstallmentsChange={setInstallments}
            options={options}
            quote={shown}
            disabled={blocker !== undefined || busy}
          >
            <CardFields
              values={card}
              errors={errors}
              disabled={blocker !== undefined || busy}
              onChange={(values) => {
                setCard(values);
                setErrors({});
                if (payment.state.kind === 'declined') payment.dismissDeclined();
              }}
            />
          </MethodPanel>
          {/* Quem paga vale para as duas formas (RN02). */}
          <PayerPanel
            values={payer}
            errors={errors}
            previousPayer={payment.previousPayer}
            disabled={blocker !== undefined || busy}
            onChange={(values) => {
              setPayer(values);
              setErrors({});
            }}
          />
        </div>
        <div className="kore-publish__summary">
          {quoteFailed ? (
            <LoadErrorNotice onRetry={() => void quote.refetch()} />
          ) : (
            <>
              <SummaryPanel pricing={pricing} quote={shown} />
              <ComparePanel quote={shown} free={free} method={method} installments={installments} />
            </>
          )}
          <ContractPanel
            {...(shown?.totalCents !== undefined &&
              shown.totalCents !== null &&
              debouncedEndDate !== '' && {
                price: { totalCents: shown.totalCents, endDate: debouncedEndDate },
              })}
          />
          {payment.state.kind === 'declined' && (
            <Alert tone="danger" role="alert">
              {t('publish.declined')}
            </Alert>
          )}
          <PublishActions
            reason={reason}
            confirming={payment.state.kind === 'confirming'}
            {...(canPay && { onPay: () => void submit() })}
          />
        </div>
      </div>
    </div>
  );
}

function installmentText({
  option,
  t,
}: {
  option: InstallmentOption;
  t: TFunction<'billing'>;
}): string {
  const brl = (cents: number) => formatCents({ cents });
  const even = option.first === option.rest;
  if (option.withInterest) {
    return even
      ? t('publish.installments.evenInterest', {
          count: option.count,
          amount: brl(option.rest),
          total: brl(option.totalCents),
        })
      : t('publish.installments.unevenInterest', {
          count: option.count,
          first: brl(option.first),
          rest: brl(option.rest),
          total: brl(option.totalCents),
        });
  }
  return even
    ? t('publish.installments.even', { count: option.count, amount: brl(option.rest) })
    : t('publish.installments.uneven', {
        count: option.count,
        first: brl(option.first),
        rest: brl(option.rest),
      });
}

function MethodPanel({
  pricing,
  method,
  onMethodChange,
  installments,
  onInstallmentsChange,
  options,
  quote,
  disabled,
  children,
}: {
  pricing: PricingResponse;
  method: Method;
  onMethodChange: (method: Method) => void;
  installments: number;
  onInstallmentsChange: (installments: number) => void;
  options: InstallmentOption[];
  quote: BillingQuoteResponse | undefined;
  disabled: boolean;
  /** Os campos do cartão, abaixo das parcelas e dos juros (Penpot 21). */
  children: ReactNode;
}) {
  const { t } = useTranslation('billing');
  const free = pricing.installments.interestFreeUpTo;
  const interest = quote?.installmentInterestCents ?? 0;
  return (
    <Panel title={t('publish.method.title')} gap="md">
      <PaymentOptionGroup label={t('publish.method.title')}>
        <PaymentOption
          name="method"
          value="pix"
          checked={method === 'pix'}
          disabled={disabled}
          onChange={() => onMethodChange('pix')}
          label={t('publish.method.pix', { percent: pricing.pixDiscountPercent })}
        />
        <PaymentOption
          name="method"
          value="card"
          checked={method === 'card'}
          disabled={disabled}
          onChange={() => onMethodChange('card')}
          label={t('publish.method.card')}
          caption={t('publish.method.cardCaption', { max: pricing.installments.max, free })}
        />
      </PaymentOptionGroup>
      {method === 'card' && (
        <FormField
          label={t('publish.installments.label')}
          {...(options.length === 0 && { hint: t('publish.installments.noDate') })}
        >
          {({ id, describedBy }) => (
            <Select
              id={id}
              value={String(installments)}
              disabled={disabled || options.length === 0}
              {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
              onChange={(event) => onInstallmentsChange(Number(event.target.value))}
            >
              {options.length === 0 ? (
                <option value={String(installments)} />
              ) : (
                options.map((option) => (
                  <option key={option.count} value={String(option.count)}>
                    {installmentText({ option, t })}
                  </option>
                ))
              )}
            </Select>
          )}
        </FormField>
      )}
      {method === 'card' && installments > free && interest > 0 && quote?.totalCents && (
        <Alert tone="info">
          {t('publish.interestAlert', {
            count: installments,
            interest: formatCents({ cents: interest }),
            rate: percentText({ percent: pricing.installments.interestPercent }),
            fixed: formatCents({ cents: pricing.installments.interestFixedCents }),
            total: formatCents({ cents: quote.totalCents }),
            free,
          })}
        </Alert>
      )}
      {method === 'card' && children}
    </Panel>
  );
}

function SummaryPanel({
  pricing,
  quote,
}: {
  pricing: PricingResponse;
  quote: BillingQuoteResponse | undefined;
}) {
  const { t } = useTranslation('billing');
  const rows = quote ? summaryRows({ quote }) : [];
  if (!quote || rows.length === 0 || quote.totalCents === null) {
    return (
      <Panel title={t('publish.summary.title')}>
        <p className="kore-publish__empty">{t('publish.summary.empty')}</p>
      </Panel>
    );
  }
  const brl = (cents: number) => formatCents({ cents });
  const label = (row: SummaryRow): string => {
    switch (row.kind) {
      case 'activation':
        return t('publish.summary.activation');
      case 'months':
        return t('publish.summary.months', {
          count: row.months,
          monthly: formatRulePrice({ cents: pricing.monthlyCents }),
        });
      case 'cap':
        return t('publish.summary.cap');
      case 'referral':
        return t(`publish.summary.referral.${row.label}`, {
          percent: pricing.referralDiscountPercent,
        });
      case 'pix':
        return t('publish.summary.pix', { percent: pricing.pixDiscountPercent });
      case 'interest':
        return t('publish.summary.interest', { count: row.installments });
    }
  };
  return (
    <Panel title={t('publish.summary.title')}>
      <ValueList>
        {rows.map((row) => (
          <ValueRow
            key={row.kind}
            label={label(row)}
            value={brl(row.cents)}
            {...(row.kind === 'cap' && {
              caption: t('publish.summary.capCaption', {
                cap: formatRulePrice({ cents: pricing.capCents }),
                months: capStartsAtMonths({ pricing }),
              }),
            })}
          />
        ))}
        <ValueTotal label={t('publish.summary.total')} value={brl(quote.totalCents)} />
      </ValueList>
    </Panel>
  );
}

function ComparePanel({
  quote,
  free,
  method,
  installments,
}: {
  quote: BillingQuoteResponse | undefined;
  free: number;
  method: Method;
  installments: number;
}) {
  const { t } = useTranslation('billing');
  const totals = quote?.totalsByMethod;
  if (!totals) {
    return (
      <Panel title={t('publish.compare.title')}>
        <p className="kore-publish__empty">{t('publish.compare.empty')}</p>
      </Panel>
    );
  }
  const brl = (cents: number) => formatCents({ cents });
  return (
    <Panel title={t('publish.compare.title')}>
      <ValueList>
        <ValueRow label={t('publish.compare.pix')} value={brl(totals.pix)} />
        <ValueRow label={t('publish.compare.cardFree', { free })} value={brl(totals.cardUpTo6)} />
        {method === 'card' && installments > free && (
          <ValueRow
            label={t('publish.compare.cardInterest', { count: installments })}
            value={brl(totals.cardChosen)}
          />
        )}
      </ValueList>
    </Panel>
  );
}
