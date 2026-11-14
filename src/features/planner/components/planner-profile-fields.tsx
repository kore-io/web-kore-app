import { Checkbox, Input } from '@kore-io/design';
import { Trans, useTranslation } from 'react-i18next';
import { FormField } from '../../../shared/components/form-field';
import { PRIVACY_URL, TERMS_URL } from '../../../site/links';
import type { PlannerFieldErrors, PlannerProfileValues } from '../planner-profile-form';
import { CityListField } from './city-list-field';

export interface PlannerProfileFieldsProps {
  values: PlannerProfileValues;
  onChange: (values: PlannerProfileValues) => void;
  errors: PlannerFieldErrors;
  /** Seu nome só quando a conta não tem nome (RN04). */
  needsName: boolean;
  /** A caixa dos Termos: no Cadastro, sempre; no Meu perfil, só no perfil mínimo (RN10). */
  showTerms: boolean;
}

/**
 * Os Dados profissionais (Cadastro e perfil RN04; Penpot "Dados profissionais — F6"): o Nome
 * da assessoria, Seu nome (sem nome na conta), Telefone e WhatsApp lado a lado, "O mesmo do
 * telefone", as Cidades de atuação e a caixa dos Termos. O Meu perfil (D3) usa os mesmos.
 */
export function PlannerProfileFields({
  values,
  onChange,
  errors,
  needsName,
  showTerms,
}: PlannerProfileFieldsProps) {
  const { t } = useTranslation('access');
  const set = (patch: Partial<PlannerProfileValues>) => onChange({ ...values, ...patch });
  const danger = (message: string | undefined) =>
    message ? { hint: message, hintTone: 'danger' as const } : {};

  return (
    <>
      <FormField
        label={t('plannerProfile.creditName')}
        hint={errors.creditName ?? t('plannerProfile.creditNameHint')}
        hintTone={errors.creditName ? 'danger' : 'neutral'}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            autoComplete="organization"
            value={values.creditName}
            onChange={(event) => set({ creditName: event.target.value })}
          />
        )}
      </FormField>
      {needsName && (
        <FormField label={t('plannerProfile.name')} {...danger(errors.name)}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              autoComplete="name"
              value={values.name}
              onChange={(event) => set({ name: event.target.value })}
            />
          )}
        </FormField>
      )}
      <div className="kore-planner-profile__phones">
        <FormField
          label={t('plannerProfile.phone')}
          optionalText={t('plannerProfile.optional')}
          {...danger(errors.phone)}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              value={values.phone}
              onChange={(event) =>
                set({
                  phone: event.target.value,
                  ...(values.sameAsPhone && { whatsapp: event.target.value }),
                })
              }
            />
          )}
        </FormField>
        <FormField
          label={t('plannerProfile.whatsapp')}
          optionalText={t('plannerProfile.optional')}
          {...danger(errors.whatsapp)}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="tel"
              inputMode="tel"
              value={values.sameAsPhone ? values.phone : values.whatsapp}
              disabled={values.sameAsPhone}
              onChange={(event) => set({ whatsapp: event.target.value })}
            />
          )}
        </FormField>
      </div>
      <Checkbox
        checked={values.sameAsPhone}
        onChange={(event) =>
          set({
            sameAsPhone: event.target.checked,
            whatsapp: event.target.checked ? values.phone : values.whatsapp,
          })
        }
      >
        {t('plannerProfile.sameAsPhone')}
      </Checkbox>
      <CityListField
        cities={values.cities}
        onChange={(cities) => set({ cities })}
        error={errors.cities}
      />
      {showTerms && (
        <div className="kore-planner-profile__terms">
          <Checkbox
            checked={values.termsAccepted}
            aria-invalid={errors.terms ? true : undefined}
            onChange={(event) => set({ termsAccepted: event.target.checked })}
          >
            <Trans
              t={t}
              i18nKey="plannerProfile.terms"
              components={{
                terms: <a href={TERMS_URL} target="_blank" rel="noreferrer" />,
                privacy: <a href={PRIVACY_URL} target="_blank" rel="noreferrer" />,
              }}
            />
          </Checkbox>
          {errors.terms && (
            <p className="kore-planner-profile__error" role="alert">
              {errors.terms}
            </p>
          )}
        </div>
      )}
    </>
  );
}
