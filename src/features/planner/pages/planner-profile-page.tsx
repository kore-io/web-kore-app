import { Alert, Button, PageHeader, Spinner, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getMeControllerMeV1QueryKey,
  getPlannerControllerProfileV1QueryKey,
  usePlannerControllerProfileV1,
  usePlannerControllerUpdateV1,
} from '../../../shared/api/generated/me/me';
import type { PlannerProfileResponse } from '../../../shared/api/generated/model';
import { apiErrorCode } from '../../../shared/api/http-client';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { TERMS_VERSION } from '../../access/terms';
import { PlannerProfileFields } from '../components/planner-profile-fields';
import {
  fieldErrorsFromApi,
  formatPhoneDigits,
  plannerProfileBody,
  validatePlannerProfile,
  type PlannerFieldErrors,
  type PlannerProfileValues,
} from '../planner-profile-form';

/** Os valores do formulário a partir do perfil salvo (o telefone com a máscara). */
function valuesFrom({ profile }: { profile: PlannerProfileResponse }): PlannerProfileValues {
  const phone = formatPhoneDigits(profile.phone);
  const whatsapp = formatPhoneDigits(profile.whatsapp);
  return {
    creditName: profile.creditName,
    name: profile.name ?? '',
    phone,
    whatsapp,
    sameAsPhone: phone !== '' && whatsapp === phone,
    cities: profile.cities,
    termsAccepted: false,
  };
}

/**
 * Meu perfil (`/cerimonialista/perfil`; Cadastro e perfil RN09 e RN10; Penpot 15): os dados
 * da RN04 sem os Termos, o e-mail da conta como texto, Salvar alterações pelo PATCH e o
 * Toast. No perfil mínimo sem os Termos vigentes, a caixa dos Termos aparece e o PATCH a
 * exige (RN10). Com a assinatura ocultada pelo Kore, o aviso abaixo do nome (decisão 254(4)).
 */
export function PlannerProfilePage() {
  const { t } = useTranslation('planner');
  const profile = usePlannerControllerProfileV1();

  return (
    <div className="kore-planner-profile">
      <PageHeader title={t('profile.title')} description={t('profile.description')} />
      {profile.isError ? (
        <LoadErrorNotice onRetry={() => void profile.refetch()} />
      ) : !profile.data ? (
        <div className="kore-planner-profile__loading">
          <Spinner label={t('profile.loading')} />
        </div>
      ) : (
        // A chave refaz o formulário quando o perfil salvo muda (depois do Salvar).
        <ProfileForm key={JSON.stringify(profile.data)} profile={profile.data} />
      )}
    </div>
  );
}

function ProfileForm({ profile }: { profile: PlannerProfileResponse }) {
  const { t } = useTranslation('planner');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const update = usePlannerControllerUpdateV1();
  const [values, setValues] = useState(() => valuesFrom({ profile }));
  const [errors, setErrors] = useState<PlannerFieldErrors>({});
  const needsName = profile.name === null;
  const needsTerms = !profile.termsAccepted;

  function showGenericError() {
    showToast({
      tone: 'danger',
      message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validatePlannerProfile({ t: tAccess, values, needsName, needsTerms });
    // No Meu perfil o botão é Salvar alterações: o texto dos Termos diz "para salvar".
    if (found.terms) found.terms = t('profile.termsRequired');
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    update.mutate(
      {
        data: {
          ...plannerProfileBody({ values, needsName }),
          ...(needsTerms && { termsVersion: TERMS_VERSION }),
        },
      },
      {
        onSuccess: (saved) => {
          queryClient.setQueryData(getPlannerControllerProfileV1QueryKey(), saved);
          // O nome da assessoria é o título da Topbar (a Organization acompanha, RN09).
          void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
          showToast({ tone: 'success', message: t('profile.saved') });
        },
        onError: (error) => {
          const fieldErrors = fieldErrorsFromApi({ t: tAccess, error });
          if (fieldErrors) {
            setErrors(fieldErrors);
            return;
          }
          if (apiErrorCode({ error }) === 'TERMS_VERSION_OUTDATED') {
            setValues((current) => ({ ...current, termsAccepted: false }));
            setErrors({ terms: tAccess('plannerProfile.errors.termsOutdated') });
            return;
          }
          showGenericError();
        },
      },
    );
  }

  return (
    <form className="kore-planner-profile__card" noValidate onSubmit={handleSubmit}>
      <div className="kore-planner-profile__email">
        <p className="kore-planner-profile__email-label">{t('profile.email')}</p>
        <p className="kore-planner-profile__email-value">{profile.email}</p>
        <p className="kore-planner-profile__email-hint">{t('profile.emailHint')}</p>
      </div>
      <PlannerProfileFields
        values={values}
        onChange={setValues}
        errors={errors}
        needsName={needsName}
        showTerms={needsTerms}
        creditNameHint={t('profile.creditNameHint')}
        {...(profile.creditHidden && {
          creditNameNotice: <Alert tone="info">{t('profile.creditHidden')}</Alert>,
        })}
      />
      <div className="kore-planner-profile__actions">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => {
            setValues(valuesFrom({ profile }));
            setErrors({});
          }}
        >
          {t('profile.cancel')}
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={update.isPending}
          aria-busy={update.isPending || undefined}
        >
          {t('profile.save')}
        </Button>
      </div>
    </form>
  );
}
