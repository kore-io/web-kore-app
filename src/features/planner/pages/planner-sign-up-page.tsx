import { Alert, Button, useToast } from '@kore-io/design';
import type { FormEvent } from 'react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import { usePlannerControllerReferrerV1 } from '../../../shared/api/generated/me/me';
import { redirectTo } from '../../../shared/browser/redirect';
import { LoadError } from '../../../shared/components/load-error';
import { KORE_URL } from '../../../site/links';
import { AccessLayout } from '../../access/components/access-layout';
import { GoogleOrEmail } from '../../access/components/google-or-email';
import { SignInAlert } from '../../access/components/sign-in-alert';
import { SignInCodeStep } from '../../access/components/sign-in-code-step';
import { PlannerProfileFields } from '../components/planner-profile-fields';
import {
  PlannerAccountContinue,
  PlannerHowItWorksStep,
  PlannerReferralReadyStep,
  PlannerSignUpClosed,
  PlannerStartStep,
} from '../components/planner-sign-up-steps';
import { usePlannerSignUp } from '../hooks/use-planner-sign-up';

/**
 * Cadastro do cerimonialista (/cerimonialista/cadastro; Cadastro e perfil RN01 a RN06;
 * Penpot da Área do Cerimonialista, 01 Primeiro acesso), no quadro do Acessos com o painel
 * da marca do cerimonialista.
 */
export function PlannerSignUpPage() {
  const { t } = useTranslation('access');
  const navigate = useNavigate();
  const signUp = usePlannerSignUp();
  const { signIn } = signUp;

  if (signUp.stage === 'loading') return null;
  if (signUp.stage === 'failed') return <LoadError onRetry={signUp.retry} />;
  // Quem já tem o perfil vai à Área (RN03); até o D3, a rota fica vazia (decisão 250(d)).
  if (signUp.stage === 'planner') return <Navigate to={paths.plannerArea} replace />;

  if (signUp.stage === 'closed') {
    return (
      <AccessLayout pitch="planner" showLegal={false}>
        <PlannerSignUpClosed onBack={() => redirectTo({ url: KORE_URL })} />
      </AccessLayout>
    );
  }

  if (signUp.stage === 'sign-in') {
    const noticeElement = signIn.notice && <SignInAlert notice={signIn.notice} />;
    return (
      <AccessLayout pitch="planner">
        {signIn.step === 'email' ? (
          <PlannerStartStep {...(noticeElement && { notice: noticeElement })}>
            <GoogleOrEmail
              onContinueWithGoogle={signIn.continueWithGoogle}
              onSubmit={signIn.submitEmail}
              submitLabel={t('plannerSignUp.submit')}
              {...(signIn.emailError !== undefined && { emailError: signIn.emailError })}
              submitting={signIn.submitting}
            />
            <div className="kore-sign-in__links kore-sign-in__links--actions">
              <p className="kore-sign-in__link-row">
                {t('plannerSignUp.signInPrompt')}{' '}
                <a
                  className="kore-sign-in__link kore-sign-in__link--standalone"
                  href={paths.signIn}
                >
                  {t('plannerSignUp.signInLink')}
                </a>
              </p>
              <p className="kore-sign-in__link-row">
                {t('plannerSignUp.couplePrompt')}{' '}
                <a
                  className="kore-sign-in__link kore-sign-in__link--standalone"
                  href={paths.signUp}
                >
                  {t('plannerSignUp.coupleLink')}
                </a>
              </p>
            </div>
          </PlannerStartStep>
        ) : (
          <SignInCodeStep
            email={signIn.email}
            {...(noticeElement && { notice: noticeElement })}
            onSubmit={signIn.submitCode}
            submitting={signIn.submitting}
            resendSecondsLeft={signIn.resendSecondsLeft}
            onResend={signIn.resend}
            onUseAnotherEmail={signIn.useAnotherEmail}
            resetKey={signIn.codeResetKey}
            invalid={signIn.codeInvalid}
          />
        )}
      </AccessLayout>
    );
  }

  if (signUp.stage === 'start') {
    return (
      <AccessLayout pitch="planner">
        <PlannerStartStep
          {...(signUp.sellerBlocked && {
            notice: (
              <Alert tone="danger" role="alert">
                {t('plannerSignUp.seller')}
              </Alert>
            ),
          })}
        >
          <PlannerAccountContinue email={signUp.email} onContinue={signUp.continueWithAccount} />
        </PlannerStartStep>
      </AccessLayout>
    );
  }

  if (signUp.stage === 'details') {
    return (
      <AccessLayout pitch="planner" showLegal={false}>
        <PlannerDetailsStep signUp={signUp} />
      </AccessLayout>
    );
  }

  return (
    <AccessLayout pitch="planner" showLegal={false}>
      {signUp.stage === 'ready' ? (
        <ReferralReady onContinue={signUp.showHowItWorks} />
      ) : (
        <PlannerHowItWorksStep onDone={() => void navigate(paths.plannerArea)} />
      )}
    </AccessLayout>
  );
}

/** Os Dados profissionais (RN04), com os erros no campo e os avisos acima do título. */
function PlannerDetailsStep({ signUp }: { signUp: ReturnType<typeof usePlannerSignUp> }) {
  const { t } = useTranslation('access');
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    signUp.submit();
  }
  return (
    <form className="kore-sign-in" noValidate onSubmit={handleSubmit}>
      {signUp.notice && <SignInAlert notice={signUp.notice} />}
      {signUp.sellerBlocked && (
        <Alert tone="danger" role="alert">
          {t('plannerSignUp.seller')}
        </Alert>
      )}
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">{t('plannerSignUp.details.title')}</h1>
        <p className="kore-sign-in__description">{t('plannerSignUp.details.description')}</p>
      </div>
      <PlannerProfileFields
        values={signUp.values}
        onChange={signUp.setValues}
        errors={signUp.errors}
        needsName={signUp.needsName}
        showTerms
      />
      <Button
        type="submit"
        size="lg"
        className="kore-sign-in__submit"
        disabled={signUp.submitting}
        aria-busy={signUp.submitting || undefined}
      >
        {t('plannerSignUp.details.submit')}
      </Button>
    </form>
  );
}

/** Link de indicação pronto: o link e o desconto vêm do GET /v1/me/referrer (RN06). */
function ReferralReady({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation('access');
  const { showToast } = useToast();
  const referrer = usePlannerControllerReferrerV1();
  // Sem o link, o Como funciona segue: ele também fica em Link de indicação (a nota).
  useEffect(() => {
    if (referrer.isError) onContinue();
  }, [referrer.isError, onContinue]);
  if (!referrer.data) return null;
  const { link, discountPercent } = referrer.data;
  return (
    <PlannerReferralReadyStep
      link={link}
      discountPercent={discountPercent}
      onCopy={() =>
        void navigator.clipboard
          .writeText(link)
          .then(() => showToast({ tone: 'success', message: t('plannerSignUp.ready.copied') }))
          // Sem a área de transferência (permissão negada): o aviso genérico; o link segue na tela.
          .catch(() =>
            showToast({
              tone: 'danger',
              message: `${t('alerts.generic.title')}. ${t('alerts.generic.description')}`,
            }),
          )
      }
      onContinue={onContinue}
    />
  );
}
