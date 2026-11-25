import { Button, Input } from '@kore-io/design';
import { useTranslation } from 'react-i18next';
import type { PayerDto } from '../../../shared/api/generated/model';
import { FormField } from '../../../shared/components/form-field';
import { Panel } from '../../../shared/components/panel';
import {
  cvvState,
  expiryState,
  formatCardNumber,
  formatCpf,
  formatExpiry,
  isValidCardNumber,
  isValidCpf,
} from './payment-form';

/** Os campos do cartão (Penpot 21, "Campos do cartão"). */
export interface CardValues {
  number: string;
  holder: string;
  expiry: string;
  cvv: string;
}

/** Quem paga: o pagador anterior (pelo `payerId`, 316(3)) ou o nome e o CPF. */
export interface PayerValues {
  name: string;
  taxId: string;
  /** Com o pagador anterior à mão, "Usar outro CPF" abre os campos. */
  useOther: boolean;
}

export const EMPTY_CARD: CardValues = { number: '', holder: '', expiry: '', cvv: '' };
export const EMPTY_PAYER: PayerValues = { name: '', taxId: '', useOther: false };

export type PayErrors = Partial<
  Record<'number' | 'holder' | 'expiry' | 'cvv' | 'name' | 'taxId', string>
>;

type T = ReturnType<typeof useTranslation<'billing'>>['t'];

/**
 * As conferências antes de mandar (Publicar RN02; Pena, item 5; 322(4)): os erros de cada
 * campo, com os textos da Voz. Vazio quando está tudo certo.
 */
export function payErrors({
  method,
  card,
  payer,
  previousPayer,
  now,
  t,
}: {
  /** No Pix, só quem paga; o cartão só no cartão. */
  method: 'pix' | 'card';
  card: CardValues;
  payer: PayerValues;
  previousPayer: PayerDto | null;
  now: Date;
  t: T;
}): PayErrors {
  const errors: PayErrors = {};
  if (method === 'card') {
    if (card.number.trim() === '') errors.number = t('publish.card.number.empty');
    else if (!isValidCardNumber(card.number)) errors.number = t('publish.card.number.invalid');
    if (card.holder.trim() === '') errors.holder = t('publish.card.holder.empty');
    const expiry = expiryState({ value: card.expiry, now });
    if (expiry !== 'ok') errors.expiry = t(`publish.card.expiry.${expiry}`);
    const cvv = cvvState(card.cvv);
    if (cvv !== 'ok') errors.cvv = t(`publish.card.cvv.${cvv}`);
  }
  if (previousPayerId({ payer, previousPayer }) === null) {
    if (payer.name.trim() === '') errors.name = t('publish.payer.name.empty');
    if (!isValidCpf(payer.taxId)) errors.taxId = t('publish.payer.taxId.invalid');
  }
  return errors;
}

/**
 * O `payerId` do pagador anterior, quando vale: a API o devolveu e o casal não pediu outro
 * CPF. Nulo: o casal informa o nome e o CPF.
 */
export function previousPayerId({
  payer,
  previousPayer,
}: {
  payer: PayerValues;
  previousPayer: PayerDto | null;
}): string | null {
  return previousPayer?.payerId && !payer.useOther ? previousPayer.payerId : null;
}

/** Os campos do cartão, dentro do painel Forma de pagamento (Penpot 21). */
export function CardFields({
  values,
  errors,
  disabled,
  onChange,
}: {
  values: CardValues;
  errors: PayErrors;
  disabled: boolean;
  onChange: (values: CardValues) => void;
}) {
  const { t } = useTranslation('billing');
  const set = (patch: Partial<CardValues>) => onChange({ ...values, ...patch });
  return (
    <div className="kore-publish__card-fields">
      <FormField
        label={t('publish.card.number.label')}
        {...(errors.number !== undefined && { hint: errors.number, hintTone: 'danger' })}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder={t('publish.card.number.placeholder')}
            value={values.number}
            disabled={disabled}
            invalid={invalid}
            {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
            onChange={(event) => set({ number: formatCardNumber(event.target.value) })}
          />
        )}
      </FormField>
      <FormField
        label={t('publish.card.holder.label')}
        {...(errors.holder !== undefined && { hint: errors.holder, hintTone: 'danger' })}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            autoComplete="cc-name"
            placeholder={t('publish.card.holder.placeholder')}
            value={values.holder}
            disabled={disabled}
            invalid={invalid}
            {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
            onChange={(event) => set({ holder: event.target.value })}
          />
        )}
      </FormField>
      <div className="kore-publish__card-row">
        <FormField
          label={t('publish.card.expiry.label')}
          {...(errors.expiry !== undefined && { hint: errors.expiry, hintTone: 'danger' })}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder={t('publish.card.expiry.placeholder')}
              value={values.expiry}
              disabled={disabled}
              invalid={invalid}
              {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
              onChange={(event) => set({ expiry: formatExpiry(event.target.value) })}
            />
          )}
        </FormField>
        <FormField
          label={t('publish.card.cvv.label')}
          hint={errors.cvv ?? t('publish.card.cvv.help')}
          hintTone={errors.cvv !== undefined ? 'danger' : 'neutral'}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder={t('publish.card.cvv.placeholder')}
              value={values.cvv}
              disabled={disabled}
              invalid={invalid}
              {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
              onChange={(event) => set({ cvv: event.target.value.replace(/\D/g, '').slice(0, 4) })}
            />
          )}
        </FormField>
      </div>
    </div>
  );
}

/**
 * Quem paga (Publicar RN02; Penpot 21, "Painel / Quem paga"). Com o pagador anterior que a
 * API devolve (`payer.payerId`, 316(3)), "Ana Beatriz Moreira · CPF final 4821" e Usar outro
 * CPF; sem ele, o nome e o CPF, com a ajuda.
 */
export function PayerPanel({
  values,
  errors,
  previousPayer,
  disabled,
  onChange,
}: {
  values: PayerValues;
  errors: PayErrors;
  previousPayer: PayerDto | null;
  disabled: boolean;
  onChange: (values: PayerValues) => void;
}) {
  const { t } = useTranslation('billing');
  const set = (patch: Partial<PayerValues>) => onChange({ ...values, ...patch });
  if (previousPayer !== null && previousPayerId({ payer: values, previousPayer }) !== null) {
    return (
      <Panel title={t('publish.payer.title')} gap="md">
        <p className="kore-publish__payer">
          {t('publish.payer.previous', {
            name: previousPayer.name,
            last4: previousPayer.taxIdLast4,
          })}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="kore-publish__payer-other"
          disabled={disabled}
          onClick={() => set({ useOther: true })}
        >
          {t('publish.payer.useOther')}
        </Button>
      </Panel>
    );
  }
  return (
    <Panel title={t('publish.payer.title')} gap="md">
      <FormField
        label={t('publish.payer.name.label')}
        {...(errors.name !== undefined && { hint: errors.name, hintTone: 'danger' })}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            autoComplete="name"
            placeholder={t('publish.payer.name.placeholder')}
            value={values.name}
            disabled={disabled}
            invalid={invalid}
            {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
            onChange={(event) => set({ name: event.target.value })}
          />
        )}
      </FormField>
      <FormField
        label={t('publish.payer.taxId.label')}
        hint={errors.taxId ?? t('publish.payer.taxId.help')}
        hintTone={errors.taxId !== undefined ? 'danger' : 'neutral'}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            inputMode="numeric"
            placeholder={t('publish.payer.taxId.placeholder')}
            value={values.taxId}
            disabled={disabled}
            invalid={invalid}
            {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
            onChange={(event) => set({ taxId: formatCpf(event.target.value) })}
          />
        )}
      </FormField>
    </Panel>
  );
}
