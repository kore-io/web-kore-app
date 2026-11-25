import { Alert, Select } from '@kore-io/design';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { BillingQuoteResponse, PricingResponse } from '../../../shared/api/generated/model';
import { FormField } from '../../../shared/components/form-field';
import { Panel } from '../../../shared/components/panel';
import { PaymentOption, PaymentOptionGroup } from '../../../shared/components/payment-option';
import { formatCents } from '../../../shared/money';
import { percentText, type InstallmentOption } from './quote-view';

export type Method = 'pix' | 'card';

/**
 * A forma de pagamento, as parcelas e o aviso dos juros (Penpot 21, "Formas"; Preço e cotação
 * RN09), do Publicar e da extensão (E11). Os campos do cartão vêm como filhos.
 */
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

export function MethodPanel({
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
