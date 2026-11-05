import { useNavigate } from 'react-router';
import { externalUrls, paths } from '../../../app/paths';
import { LoadError } from '../../../shared/components/load-error';
import { AlreadyOwner } from '../components/already-owner';
import { InvitePartnerStep } from '../components/invite-partner-step';
import { AccessLayout } from '../components/access-layout';
import { SignInAlert } from '../components/sign-in-alert';
import { SignInCodeStep } from '../components/sign-in-code-step';
import { SignUpStartStep } from '../components/sign-up-start-step';
import { WeddingDetailsForm } from '../components/wedding-details-form';
import { useSignUp } from '../hooks/use-sign-up';
import { useWeddingDetails } from '../hooks/use-wedding-details';

/**
 * Criar conta e casamento (/cadastro, decisão 165): o Início (Google ou e-mail, com a caixa
 * de indicação), o passo do código do Entrar e, com sessão, os Dados do casamento.
 */
export function SignUpPage() {
  const { stage, referral, referralCode, signIn, retry } = useSignUp();
  if (stage === 'loading') return null;
  if (stage === 'failed') return <LoadError onRetry={retry} />;
  if (stage === 'details') return <WeddingDetailsStage referralCode={referralCode} />;

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

/** Dados do casamento e o que vem depois do POST /v1/weddings (RN06 e RN10, decisão 169). */
function WeddingDetailsStage({ referralCode }: { referralCode: string | undefined }) {
  const navigate = useNavigate();
  const details = useWeddingDetails({ referralCode });
  const openWedding = () =>
    void details.openWedding().then(() => navigate(paths.coupleArea, { replace: true }));

  if (details.stage === 'already-owner') {
    return (
      <AccessLayout pitch="couple" showLegal={false}>
        {/* Até existir o POST /v1/me/active-profile, a Seleção de perfil (decisão 171(B)). */}
        <AlreadyOwner onOpenWedding={() => void navigate(paths.profiles, { replace: true })} />
      </AccessLayout>
    );
  }
  if (details.stage === 'invite-partner') {
    return (
      <AccessLayout pitch="couple" showLegal={false}>
        {/* Sem o envio até a rota de convites: só o Fazer isso depois (169(3)). */}
        <InvitePartnerStep partnerName={firstName(details.partnerName)} onSkip={openWedding} />
      </AccessLayout>
    );
  }
  return (
    <AccessLayout pitch="couple">
      <WeddingDetailsForm
        {...(details.notice && { notice: <SignInAlert notice={details.notice} /> })}
        slugValue={details.slugValue}
        {...(details.slugStatus && { slugStatus: details.slugStatus })}
        errors={details.errors}
        onValuesChange={details.onValuesChange}
        onSlugChange={details.onSlugChange}
        onSubmit={details.submit}
        submitting={details.submitting}
      />
    </AccessLayout>
  );
}

/** "Convide Marcos", e não "Convide Marcos Rocha": o primeiro nome, como nos outros textos. */
function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}
