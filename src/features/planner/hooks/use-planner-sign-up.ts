import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import {
  getMeControllerMeV1QueryKey,
  useMeControllerMeV1,
  usePlannerControllerCreateV1,
} from '../../../shared/api/generated/me/me';
import { ApiError, apiErrorCode } from '../../../shared/api/http-client';
import { reloadPage } from '../../../shared/browser/redirect';
import type { SignInNotice } from '../../access/components/sign-in-alert';
import { useSignIn } from '../../access/hooks/use-sign-in';
import type { PlannerSignUpLocationState } from '../../access/login-navigation';
import { TERMS_VERSION } from '../../access/terms';
import {
  fieldErrorsFromApi,
  plannerProfileBody,
  validatePlannerProfile,
  type PlannerFieldErrors,
  type PlannerProfileValues,
} from '../planner-profile-form';

const EMPTY: PlannerProfileValues = {
  creditName: '',
  name: '',
  phone: '',
  whatsapp: '',
  sameAsPhone: false,
  cities: [],
  termsAccepted: false,
};

/** O passo do cadastro depois do Início (Cadastro e perfil RN04 a RN06). */
type Step = 'start' | 'details' | 'ready' | 'how-it-works';

/**
 * Cadastro do cerimonialista (/cerimonialista/cadastro; Cadastro e perfil RN01 a RN06):
 * - sem sessão, o Início com o login (origem `planner_signup`), que volta a esta tela;
 * - com sessão: o perfil que já existe leva à Área (RN03), a chave desligada mostra o Cadastro
 *   fechado antes dos dados (RN02), e o Início mostra a conta e o Continuar (A5);
 * - os Dados profissionais criam o perfil (POST /v1/me/planner) e seguem ao Link pronto e ao
 *   Como funciona.
 */
export function usePlannerSignUp() {
  const { t } = useTranslation('access');
  const queryClient = useQueryClient();
  const location = useLocation();
  const me = useMeControllerMeV1({ query: { retry: false } });
  const signIn = useSignIn({ origin: 'planner_signup' });
  const create = usePlannerControllerCreateV1();
  const [step, setStep] = useState<Step>('start');
  const [values, setValues] = useState<PlannerProfileValues>(EMPTY);
  const [errors, setErrors] = useState<PlannerFieldErrors>({});
  const [notice, setNotice] = useState<SignInNotice>();
  const [sellerBlocked, setSellerBlocked] = useState(false);
  /** O POST disse que a chave está desligada (RN02), mesmo com o /me dizendo aberta. */
  const [closedByServer, setClosedByServer] = useState(false);
  /** O perfil já existia (a outra aba, RN03): vai à Área. */
  const [alreadyPlanner, setAlreadyPlanner] = useState(false);
  /** Os Termos mudaram (RN04): o próximo envio recarrega o app, que traz a versão nova. */
  const [termsOutdated, setTermsOutdated] = useState(false);

  const signedOut = me.error instanceof ApiError && me.error.status === 401;
  const data = me.data;
  // Criado aqui, o /me já traz o perfil: o Link pronto e o Como funciona seguem na tela.
  const createdHere = step === 'ready' || step === 'how-it-works';
  const hasPlanner = data?.profiles.includes('planner') === true;
  const needsName = !data?.user.name;
  // Acabou de entrar por este cadastro: os Dados vêm direto, sem o Início com a conta (RN02).
  // O vendedor segue no Início, que mostra o aviso no Continuar (RN03).
  const afterLogin = (location.state as PlannerSignUpLocationState | null)?.afterLogin === true;
  const currentStep =
    step === 'start' && afterLogin && data?.profiles.includes('seller') !== true ? 'details' : step;

  const stage = me.isPending
    ? ('loading' as const)
    : signedOut
      ? ('sign-in' as const)
      : !data
        ? ('failed' as const)
        : alreadyPlanner || (hasPlanner && !createdHere)
          ? ('planner' as const)
          : closedByServer || (!data.plannerSignupEnabled && !createdHere)
            ? ('closed' as const)
            : currentStep;

  function continueWithAccount() {
    // Vendedor não vira cerimonialista (RN03; decisão 175): o aviso, sem os dados.
    if (data?.profiles.includes('seller')) {
      setSellerBlocked(true);
      return;
    }
    setStep('details');
  }

  function submit() {
    if (termsOutdated) {
      reloadPage();
      return;
    }
    const found = validatePlannerProfile({ t, values, needsName, needsTerms: true });
    setErrors(found);
    setNotice(undefined);
    if (Object.keys(found).length > 0) return;
    create.mutate(
      {
        data: { ...plannerProfileBody({ values, needsName }), termsVersion: TERMS_VERSION },
      },
      {
        onSuccess: () => {
          // A sessão passou ao perfil de cerimonialista (RN05): o /me é lido de novo.
          void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
          setStep('ready');
        },
        onError: (error) => {
          const fieldErrors = fieldErrorsFromApi({ t, error });
          if (fieldErrors) {
            setErrors(fieldErrors);
            return;
          }
          switch (apiErrorCode({ error })) {
            case 'PLANNER_SIGNUP_DISABLED':
              setClosedByServer(true);
              return;
            case 'PLANNER_PROFILE_EXISTS':
              // O perfil foi criado na outra aba: relê o /me antes de ir à Área, que só
              // abre para quem tem o perfil (Colaboradora RN01).
              void queryClient
                .invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() })
                .then(() => setAlreadyPlanner(true));
              return;
            case 'SELLER_CANNOT_BE_PLANNER':
              setSellerBlocked(true);
              return;
            case 'TERMS_VERSION_OUTDATED':
              setTermsOutdated(true);
              setValues((current) => ({ ...current, termsAccepted: false }));
              setErrors({ terms: t('plannerProfile.errors.termsOutdated') });
              return;
            case 'RATE_LIMITED':
              setNotice({ kind: 'rate-limited' });
              return;
            default:
              if (error instanceof ApiError && error.status === 401) {
                void me.refetch();
                return;
              }
              setNotice({ kind: 'generic' });
          }
        },
      },
    );
  }

  return {
    stage,
    retry: () => void me.refetch(),
    email: data?.user.email ?? '',
    signIn,
    sellerBlocked,
    continueWithAccount,
    values,
    setValues,
    errors,
    needsName,
    notice,
    submitting: create.isPending,
    submit,
    showHowItWorks: () => setStep('how-it-works'),
  };
}
