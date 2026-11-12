import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { externalUrls, paths } from '../../../app/paths';
import { LoadError } from '../../../shared/components/load-error';
import { AlreadyOwner } from '../components/already-owner';
import { InvitePartnerStep } from '../components/invite-partner-step';
import { AccessLayout } from '../components/access-layout';
import { SignInAlert } from '../components/sign-in-alert';
import { SignInCodeStep } from '../components/sign-in-code-step';
import { SignUpStartStep } from '../components/sign-up-start-step';
import { WeddingDetailsForm } from '../components/wedding-details-form';
import { useInvitePartner } from '../hooks/use-invite-partner';
import { useOpenCoupleArea } from '../hooks/use-open-couple-area';
import { useSignUp } from '../hooks/use-sign-up';
import { useWeddingDetails } from '../hooks/use-wedding-details';
import { getMeControllerMeV1QueryKey } from '../../../shared/api/generated/me/me';
import type { MeResponse } from '../../../shared/api/generated/model';
import { SimulatorAppearanceField } from '../components/simulator-appearance-field';
import { SimulatorDraftPreview } from '../components/simulator-draft-preview';
import { storedSimulatorDraft } from '../simulator-draft';

/**
 * Criar conta e casamento (/cadastro, decisão 165): o Início (Google ou e-mail, com a caixa
 * de indicação), o passo do código do Entrar e, com sessão, os Dados do casamento.
 */
export function SignUpPage() {
  const { stage, referral, referralCode, signIn, retry } = useSignUp();
  const [searchParams] = useSearchParams();
  // O rascunho do Simule, se houver (Cadastro RN12): o Início com rascunho.
  const [draft] = useState(() => storedSimulatorDraft());
  // "Continuar com Google" no Pronto do Simule chega com ?google=1: o login começa sozinho e
  // volta direto aos Dados do casamento (Cadastro RN12; Simule RN08).
  const startGoogle = stage === 'start' && searchParams.get('google') === '1';
  const googleStarted = useRef(false);
  useEffect(() => {
    if (!startGoogle || googleStarted.current) return;
    googleStarted.current = true;
    signIn.continueWithGoogle();
  }, [startGoogle, signIn]);
  if (stage === 'loading' || startGoogle) return null;
  if (stage === 'failed') return <LoadError onRetry={retry} />;
  if (stage === 'details') return <WeddingDetailsStage referralCode={referralCode} />;

  const noticeElement = signIn.notice && <SignInAlert notice={signIn.notice} />;
  const preview = draft && <SimulatorDraftPreview draft={draft} />;
  return (
    <AccessLayout
      pitch="couple"
      {...(preview && { aside: <div className="kore-access__brand-preview">{preview}</div> })}
    >
      {signIn.step === 'email' ? (
        <SignUpStartStep
          {...(preview && { draftPreview: preview })}
          {...(noticeElement && { notice: noticeElement })}
          {...(referral && { referral })}
          onContinueWithGoogle={signIn.continueWithGoogle}
          onSubmit={signIn.submitEmail}
          {...(signIn.emailError !== undefined && { emailError: signIn.emailError })}
          submitting={signIn.submitting}
          // Com o rascunho, quem já tem conta entra e volta ao cadastro (Cadastro RN12).
          signInHref={draft ? `${paths.signIn}?next=couple_signup` : paths.signIn}
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
  // RN06: Abrir meu casamento passa ao perfil de casal e vai ao Dashboard (171(B)).
  const coupleArea = useOpenCoupleArea();
  // Quem já é dono de um casamento não vê o cadastro (RN06); lido na entrada, porque o /me
  // muda logo depois de criar.
  const queryClient = useQueryClient();
  const [ownerAtEntry] = useState(() =>
    Boolean(
      queryClient
        .getQueryData<MeResponse>(getMeControllerMeV1QueryKey())
        ?.memberships?.some((membership) => membership.role === 'owner'),
    ),
  );
  const details = useWeddingDetails({ referralCode, ownerAtEntry });
  const openWedding = () =>
    void details.openWedding().then(() => navigate(paths.coupleArea, { replace: true }));

  if (details.stage === 'already-owner') {
    return (
      <AccessLayout pitch="couple" showLegal={false}>
        {/* Até existir o POST /v1/me/active-profile, a Seleção de perfil (decisão 171(B)). */}
        <AlreadyOwner onOpenWedding={coupleArea.open} />
      </AccessLayout>
    );
  }
  if (details.stage === 'invite-partner' && details.weddingId) {
    return (
      <InvitePartnerStage
        weddingId={details.weddingId}
        partnerName={firstName(details.partnerName)}
        onDone={openWedding}
      />
    );
  }
  return (
    <AccessLayout pitch="couple">
      <WeddingDetailsForm
        {...(details.notice && { notice: <SignInAlert notice={details.notice} /> })}
        {...(details.draft &&
          details.draftValues && {
            defaultValues: details.draftValues,
            fromSimulator: true,
            simulatorAppearance: <SimulatorAppearanceField draft={details.draft} />,
          })}
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

/** Convidar o parceiro depois de criar (RN10): o envio ou o Fazer isso depois. */
function InvitePartnerStage({
  weddingId,
  partnerName,
  onDone,
}: {
  weddingId: string;
  partnerName: string;
  onDone: () => void;
}) {
  const invite = useInvitePartner({ weddingId, onDone });
  return (
    <AccessLayout pitch="couple" showLegal={false}>
      <InvitePartnerStep
        {...(invite.notice && { notice: <SignInAlert notice={invite.notice} /> })}
        partnerName={partnerName}
        onSubmit={invite.submit}
        onSkip={onDone}
        {...(invite.emailError !== undefined && { emailError: invite.emailError })}
        submitting={invite.submitting}
      />
    </AccessLayout>
  );
}
