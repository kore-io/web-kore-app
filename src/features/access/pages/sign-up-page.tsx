import { externalUrls, paths } from '../../../app/paths';
import { AccessLayout } from '../components/access-layout';
import { SignInAlert } from '../components/sign-in-alert';
import { SignInCodeStep } from '../components/sign-in-code-step';
import { SignUpStartStep } from '../components/sign-up-start-step';
import { WeddingDetailsForm } from '../components/wedding-details-form';
import { useSignUp } from '../hooks/use-sign-up';

/**
 * Criar conta e casamento (/cadastro, decisão 165): o Início (Google ou e-mail, com a caixa
 * de indicação), o passo do código do Entrar e, com sessão, os Dados do casamento.
 */
export function SignUpPage() {
  const { stage, referral, signIn } = useSignUp();
  if (stage === 'loading') return null;

  if (stage === 'details') {
    return (
      <AccessLayout pitch="couple">
        {/* Só visual até o POST /v1/weddings existir (decisão 165(3)). */}
        <WeddingDetailsForm onSubmit={() => undefined} />
      </AccessLayout>
    );
  }

  const noticeElement = signIn.notice && <SignInAlert notice={signIn.notice} />;
  return (
    <AccessLayout pitch="couple">
      {signIn.step === 'email' ? (
        <SignUpStartStep
          {...(noticeElement && { notice: noticeElement })}
          {...(referral && { referral })}
          onContinueWithGoogle={signIn.continueWithGoogle}
          onSubmit={signIn.submitEmail}
          {...(signIn.emailError !== undefined && { emailError: signIn.emailError })}
          submitting={signIn.submitting}
          signInHref={paths.signIn}
          plannerHref={externalUrls.plannerPartnership}
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
