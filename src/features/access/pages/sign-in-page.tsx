import { useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { paths } from '../../../app/paths';
import { AccessLayout } from '../components/access-layout';
import { SignInAlert, type SignInNotice } from '../components/sign-in-alert';
import { SignInCodeStep } from '../components/sign-in-code-step';
import { SignInEmailStep } from '../components/sign-in-email-step';
import { useSignIn } from '../hooks/use-sign-in';
import { noticeFromGoogleError } from '../login-errors';
import { safeReturnPath } from '../login-navigation';
import { readSignInLocationState } from '../sign-in-location-state';

/**
 * Entrar (/entrar) e Sessão expirada: e-mail ou Google, depois o código. Lê `?next=` (RN10),
 * `?error=` da volta do Google (e o tira da URL, decisão 150(3)) e a origem da navegação.
 */
export function SignInPage({ initialNotice }: { initialNotice?: SignInNotice }) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { origin, originRef, notice } = readSignInLocationState({ state: location.state });
  const googleError = searchParams.get('error');
  // ?next=couple_signup: o "Já têm conta? Entrar" do Simule volta ao cadastro com o rascunho
  // (Cadastro RN12); os outros são um caminho de volta (RN10).
  const nextParam = searchParams.get('next');
  const returnPath =
    nextParam === 'couple_signup' ? paths.signUp : safeReturnPath({ path: nextParam });
  const firstNotice = notice ?? noticeFromGoogleError({ error: googleError }) ?? initialNotice;

  const signIn = useSignIn({
    ...(origin !== undefined && { origin }),
    ...(originRef !== undefined && { originRef }),
    ...(returnPath !== undefined && { returnPath }),
    ...(firstNotice !== undefined && { initialNotice: firstNotice }),
  });

  useEffect(() => {
    if (googleError === null) return;
    setSearchParams(
      (params) => {
        params.delete('error');
        return params;
      },
      { replace: true },
    );
  }, [googleError, setSearchParams]);

  const noticeElement = signIn.notice && <SignInAlert notice={signIn.notice} />;
  return (
    <AccessLayout>
      {signIn.step === 'email' ? (
        <SignInEmailStep
          {...(noticeElement && { notice: noticeElement })}
          onContinueWithGoogle={signIn.continueWithGoogle}
          onSubmit={signIn.submitEmail}
          {...(signIn.emailError !== undefined && { emailError: signIn.emailError })}
          submitting={signIn.submitting}
          signUpHref={paths.signUp}
          plannerHref={paths.plannerSignUp}
        />
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
