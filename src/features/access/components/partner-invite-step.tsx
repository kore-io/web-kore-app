import { Button } from '@kore-io/design';
import { useTranslation } from 'react-i18next';
import { GoogleOrEmail } from './google-or-email';
import { WeddingSummaryCard } from './wedding-summary-card';

/** Sem sessão: entra pelo Google ou pelo e-mail, como no Penpot. */
interface SignedOutEntry {
  signedIn?: false;
  invitedEmail: string;
  onContinueWithGoogle: () => void;
  onSubmit: (values: { email: string }) => void;
  emailError?: string;
}

/** Com sessão: a pessoa já entrou, então só o Aceitar convite. */
interface SignedInEntry {
  signedIn: true;
  onAccept: () => void;
}

export type PartnerInviteStepProps = (SignedOutEntry | SignedInEntry) & {
  /** Primeiro nome de quem convidou. */
  inviterName: string;
  couple: string;
  /** Linha de data e cidade (weddingProfileDescription). */
  weddingDetails: string;
  onDecline: () => void;
  submitting?: boolean;
};

/** Convite do parceiro (Área do Casal, Penpot; textos neutros da decisão 156). */
export function PartnerInviteStep(props: PartnerInviteStepProps) {
  const { inviterName, couple, weddingDetails, onDecline, submitting = false } = props;
  const { t } = useTranslation('access');
  return (
    <div className="kore-sign-in">
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">
          {t('partnerInvite.title', { inviter: inviterName })}
        </h1>
        <p className="kore-sign-in__description">
          {t('partnerInvite.description', { inviter: inviterName })}
        </p>
      </div>
      <WeddingSummaryCard couple={couple} details={weddingDetails} />
      {props.signedIn ? (
        <Button
          size="lg"
          className="kore-sign-in__submit"
          onClick={props.onAccept}
          disabled={submitting}
        >
          {t('partnerInvite.accept')}
        </Button>
      ) : (
        <GoogleOrEmail
          onContinueWithGoogle={props.onContinueWithGoogle}
          onSubmit={props.onSubmit}
          submitLabel={t('partnerInvite.accept')}
          defaultEmail={props.invitedEmail}
          {...(props.emailError !== undefined && { emailError: props.emailError })}
          submitting={submitting}
        />
      )}
      <button
        type="button"
        className="kore-sign-in__link kore-sign-in__link--standalone kore-invite-partner__later"
        onClick={onDecline}
        disabled={submitting}
      >
        {t('partnerInvite.decline')}
      </button>
    </div>
  );
}
