import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { paths } from '../../../app/paths';
import { LoadError } from '../../../shared/components/load-error';
import type { AccessInvitation } from '../api/access-invitations';
import { AccessLayout } from '../components/access-layout';
import { AlreadyOwner } from '../components/already-owner';
import { CoupleInviteStep } from '../components/couple-invite-step';
import { InviteInvalid } from '../components/invite-invalid';
import { InviteOtherAccount } from '../components/invite-other-account';
import { PartnerInviteStep } from '../components/partner-invite-step';
import { PlannerInviteStep } from '../components/planner-invite-step';
import { SignInAlert } from '../components/sign-in-alert';
import { SignInCodeStep } from '../components/sign-in-code-step';
import { WhoAreYouStep } from '../components/who-are-you-step';
import { useInvite } from '../hooks/use-invite';
import { markAccepting } from '../invite-storage';
import { useSignIn } from '../hooks/use-sign-in';
import { useSignOut } from '../hooks/use-sign-out';
import { formatLongDate, weddingProfileDescription } from '../profile-texts';

/** Convite de acesso (/convite/:token): parceiro, casal ou cerimonialista. */
export function InvitePage() {
  const { token = '' } = useParams();
  const invite = useInvite({ token });
  const { t } = useTranslation('access');
  const signOut = useSignOut({ signInState: invite.inviteSignInState });
  // O convite do parceiro tem o login na própria tela (Penpot): Google ou e-mail e o código.
  const signIn = useSignIn({
    origin: 'invite',
    returnPath: paths.invite.replace(':token', encodeURIComponent(token)),
  });
  const { stage } = invite;

  switch (stage.name) {
    case 'loading':
      return null;
    case 'failed':
      return (
        <AccessLayout>
          <LoadError onRetry={invite.retry} />
        </AccessLayout>
      );
    case 'invalid':
      return (
        <AccessLayout>
          <InviteInvalid onSignIn={invite.signIn} />
        </AccessLayout>
      );
    case 'already-owner':
      return (
        <AccessLayout pitch="couple" showLegal={false}>
          <AlreadyOwner onOpenWedding={invite.openMyWedding} />
        </AccessLayout>
      );
    case 'other-account':
      return (
        <AccessLayout>
          <InviteOtherAccount
            invitedEmail={stage.invitation.email ?? ''}
            currentEmail={stage.currentEmail}
            onConfirm={invite.confirmOtherAccount}
            onUseAnotherAccount={() => {
              // Depois de entrar com a outra conta, o aceite continua (decisão 142).
              markAccepting({ token });
              signOut();
            }}
            submitting={invite.submitting}
          />
        </AccessLayout>
      );
    case 'who-are-you':
      return (
        <AccessLayout pitch="couple">
          <WhoAreYouStep
            {...(stage.invitation.kind === 'couple' && {
              ...partnerNamesOf({ invitation: stage.invitation }),
            })}
            onSubmit={invite.submitWhoAreYou}
            submitting={invite.submitting}
          />
        </AccessLayout>
      );
    case 'invite':
      break;
  }

  const { invitation } = stage;
  const weddingDetails = weddingProfileDescription({
    t,
    ...(invitation.wedding.eventDate !== null && { isoDate: invitation.wedding.eventDate }),
    city: invitation.wedding.city,
    state: invitation.wedding.state,
  });

  if (invitation.kind === 'planner') {
    return (
      <AccessLayout pitch="planner">
        <PlannerInviteStep
          couple={invitation.wedding.names}
          weddingDetails={weddingDetails}
          needsName={invitation.needsName === true}
          {...(invite.nameError !== undefined && { nameError: invite.nameError })}
          onAccept={invite.acceptAsPlanner}
          onDecline={invite.decline}
          submitting={invite.submitting}
        />
      </AccessLayout>
    );
  }

  if (invitation.kind === 'couple') {
    return (
      <AccessLayout pitch="couple">
        <CoupleInviteStep
          inviterName={invitation.invitedBy.name}
          fromSeller={invitation.invitedBy.role === 'seller'}
          preview={{ couple: invitation.wedding.names, details: previewDetails(invitation) }}
          {...(invitation.referrer?.discountPercent != null && {
            discountPercent: invitation.referrer.discountPercent,
          })}
          {...(invitation.email !== null && { invitedEmail: invitation.email })}
          onAccept={invite.startAccept}
          submitting={invite.submitting}
        />
      </AccessLayout>
    );
  }

  // Parceiro sem sessão, depois do e-mail: o passo do código, na mesma tela.
  if (!invite.signedIn && signIn.step === 'code') {
    return (
      <AccessLayout pitch="couple">
        <SignInCodeStep
          email={signIn.email}
          {...(signIn.notice && { notice: <SignInAlert notice={signIn.notice} /> })}
          onSubmit={signIn.submitCode}
          submitting={signIn.submitting}
          resendSecondsLeft={signIn.resendSecondsLeft}
          onResend={signIn.resend}
          onUseAnotherEmail={signIn.useAnotherEmail}
          resetKey={signIn.codeResetKey}
          invalid={signIn.codeInvalid}
        />
      </AccessLayout>
    );
  }

  const partnerProps = {
    inviterName: invitation.invitedBy.name,
    couple: invitation.wedding.names,
    weddingDetails,
    onDecline: invite.decline,
  };
  return (
    <AccessLayout pitch="couple">
      {invite.signedIn ? (
        <PartnerInviteStep
          {...partnerProps}
          signedIn
          onAccept={invite.startAccept}
          submitting={invite.submitting}
        />
      ) : (
        <PartnerInviteStep
          {...partnerProps}
          invitedEmail={invitation.email ?? ''}
          onContinueWithGoogle={() => {
            invite.markAccepting();
            signIn.continueWithGoogle();
          }}
          onSubmit={(values) => {
            invite.markAccepting();
            signIn.submitEmail(values);
          }}
          {...(signIn.emailError !== undefined && { emailError: signIn.emailError })}
          submitting={signIn.submitting || invite.submitting}
        />
      )}
    </AccessLayout>
  );
}

/** Os dois nomes do Quem é você? (173(a)), na ordem do partnerIndex. */
function partnerNamesOf({ invitation }: { invitation: AccessInvitation }) {
  const [first, second] = invitation.wedding.partnerNames ?? [];
  return first !== undefined && second !== undefined
    ? { partnerNames: [first, second] as [string, string] }
    : {};
}

/** Prévia do site: data por extenso e cidade (Penpot), ou só a cidade sem data. */
function previewDetails(invitation: AccessInvitation) {
  const { eventDate, city } = invitation.wedding;
  return eventDate ? `${formatLongDate({ isoDate: eventDate })} · ${city}` : city;
}
