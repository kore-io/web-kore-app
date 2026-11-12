import { Button, DateField, Input, Radio, Select } from '@kore-io/design';
import { useId, type FormEvent, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { BRAZIL_STATES } from '../../../shared/brazil-states';
import { FormField } from '../../../shared/components/form-field';

/** Valores do formulário, nos nomes do contrato POST /v1/weddings. */
export interface WeddingDetailsValues {
  myName: string;
  myTitle: 'bride' | 'groom' | '';
  partnerName: string;
  /** ISO (aaaa-mm-dd); vazio quando não há data. */
  eventDate: string;
  city: string;
  state: string;
  slug: string;
}

export type WeddingDetailsField = Exclude<keyof WeddingDetailsValues, 'eventDate'>;

/** Situação do endereço do site (GET /v1/weddings/slug-availability e o 409 do POST). */
export type SlugStatus =
  { kind: 'available'; slug: string } | { kind: 'taken'; slug: string; suggestion: string };

export interface WeddingDetailsFormProps {
  /** Aviso acima do título (ex.: rede fora), um Alert da lib. */
  notice?: ReactNode;
  defaultValues?: Partial<WeddingDetailsValues>;
  /** Endereço controlado pela página (a sugestão dos nomes, RN04); sem ele, livre. */
  slugValue?: string;
  /** Todos os valores a cada mudança (para sugerir e checar o endereço). */
  onValuesChange?: (values: WeddingDetailsValues) => void;
  /** Mensagens por campo (textos da decisão 155), vindas da validação. */
  errors?: Partial<Record<WeddingDetailsField, string>>;
  slugStatus?: SlugStatus;
  onSlugChange?: (change: { slug: string }) => void;
  onSubmit: (values: WeddingDetailsValues) => void;
  submitting?: boolean;
  /** Os dados vieram do Simule (Cadastro RN12): a ajuda no "Seu nome". */
  fromSimulator?: boolean;
  /** A Aparência do simulador, mostrada para conferir, antes do Criar nosso site. */
  simulatorAppearance?: ReactNode;
}

function read({ form }: { form: HTMLFormElement }): WeddingDetailsValues {
  const data = new FormData(form);
  const text = (name: string) => String(data.get(name) ?? '').trim();
  const myTitle = text('myTitle');
  return {
    myName: text('myName'),
    myTitle: myTitle === 'bride' || myTitle === 'groom' ? myTitle : '',
    partnerName: text('partnerName'),
    eventDate: text('eventDate'),
    city: text('city'),
    state: text('state'),
    slug: text('slug'),
  };
}

/**
 * Cadastro — Dados do casamento (Área do Casal, Penpot), com o estado Endereço em uso.
 * Visual por props: a validação e a checagem do endereço ficam com a página.
 */
/** Limite dos nomes e da cidade no POST /v1/weddings (decisão 166). */
const TEXT_MAX_LENGTH = 80;

/** O endereço do site não quebra no meio (decisão 161): kore.com.br/ana-e-marcos-2026. */
const ADDRESS = <span className="kore-wedding-details__address" />;

export function WeddingDetailsForm({
  notice,
  defaultValues = {},
  slugValue,
  onValuesChange,
  errors = {},
  slugStatus,
  onSlugChange,
  onSubmit,
  submitting = false,
  fromSimulator = false,
  simulatorAppearance,
}: WeddingDetailsFormProps) {
  const { t } = useTranslation('access');
  const myTitleErrorId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(read({ form: event.currentTarget }));
  }

  const slugHint =
    errors.slug !== undefined
      ? { hint: errors.slug, hintTone: 'danger' as const }
      : slugStatus?.kind === 'taken'
        ? {
            hint: (
              <Trans
                t={t}
                i18nKey="weddingDetails.slugTaken"
                values={{ slug: slugStatus.slug, suggestion: slugStatus.suggestion }}
                components={{ address: ADDRESS }}
              />
            ),
            hintTone: 'danger' as const,
          }
        : slugStatus?.kind === 'available'
          ? {
              hint: (
                <Trans
                  t={t}
                  i18nKey="weddingDetails.slugAvailable"
                  values={{ slug: slugStatus.slug }}
                  components={{ address: ADDRESS }}
                />
              ),
              hintTone: 'success' as const,
            }
          : {};
  const error = (field: WeddingDetailsField) =>
    errors[field] !== undefined ? { hint: errors[field], hintTone: 'danger' as const } : {};

  return (
    <div className="kore-sign-in">
      {notice}
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">{t('weddingDetails.title')}</h1>
        <p className="kore-sign-in__description">{t('weddingDetails.description')}</p>
      </div>
      <form
        className="kore-sign-in__form"
        onSubmit={handleSubmit}
        onChange={(event) => onValuesChange?.(read({ form: event.currentTarget }))}
        noValidate
      >
        <FormField
          label={t('weddingDetails.myName')}
          {...(errors.myName === undefined && fromSimulator
            ? { hint: t('weddingDetails.myNameFromSimulator'), hintTone: 'neutral' as const }
            : error('myName'))}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="myName"
              maxLength={TEXT_MAX_LENGTH}
              autoComplete="name"
              defaultValue={defaultValues.myName}
              invalid={invalid}
              {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
            />
          )}
        </FormField>
        <fieldset
          className="kore-wedding-details__choice"
          {...(errors.myTitle !== undefined && { 'aria-describedby': myTitleErrorId })}
        >
          <legend className="kore-wedding-details__legend">{t('weddingDetails.myTitle')}</legend>
          <div className="kore-wedding-details__options">
            <Radio name="myTitle" value="bride" defaultChecked={defaultValues.myTitle === 'bride'}>
              {t('weddingDetails.bride')}
            </Radio>
            <Radio name="myTitle" value="groom" defaultChecked={defaultValues.myTitle === 'groom'}>
              {t('weddingDetails.groom')}
            </Radio>
          </div>
          {errors.myTitle !== undefined && (
            <p id={myTitleErrorId} className="kore-form-field__hint kore-form-field__hint--danger">
              {errors.myTitle}
            </p>
          )}
        </fieldset>
        <FormField label={t('weddingDetails.partnerName')} {...error('partnerName')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="partnerName"
              maxLength={TEXT_MAX_LENGTH}
              defaultValue={defaultValues.partnerName}
              invalid={invalid}
              {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
            />
          )}
        </FormField>
        <FormField
          label={t('weddingDetails.eventDate')}
          hint={t('weddingDetails.eventDateHint')}
          hintTone="neutral"
        >
          {({ id, describedBy }) => (
            <DateField
              id={id}
              name="eventDate"
              defaultValue={defaultValues.eventDate}
              {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
            />
          )}
        </FormField>
        <div className="kore-wedding-details__place">
          <FormField label={t('weddingDetails.city')} {...error('city')}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="city"
                maxLength={TEXT_MAX_LENGTH}
                autoComplete="address-level2"
                defaultValue={defaultValues.city}
                invalid={invalid}
                {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
              />
            )}
          </FormField>
          <FormField label={t('weddingDetails.state')} {...error('state')}>
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                name="state"
                className="kore-wedding-details__state"
                placeholder={t('weddingDetails.statePlaceholder')}
                defaultValue={defaultValues.state ?? ''}
                invalid={invalid}
                {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
              >
                {BRAZIL_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>
        <FormField label={t('weddingDetails.slug')} {...slugHint}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="slug"
              autoCapitalize="none"
              spellCheck={false}
              {...(slugValue === undefined
                ? { defaultValue: defaultValues.slug }
                : { value: slugValue })}
              invalid={invalid}
              onChange={(event) => onSlugChange?.({ slug: event.target.value.trim() })}
              {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
            />
          )}
        </FormField>
        {simulatorAppearance}
        {/* Só com um endereço livre (RN05; Penpot e decisão 161 no Endereço em uso). */}
        <Button
          type="submit"
          size="lg"
          className="kore-sign-in__submit"
          disabled={submitting || slugStatus?.kind !== 'available'}
        >
          {t('weddingDetails.submit')}
        </Button>
      </form>
    </div>
  );
}
