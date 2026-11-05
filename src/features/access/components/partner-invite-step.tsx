import { useTranslation } from 'react-i18next';
import { GoogleOrEmail } from './google-or-email';
import { WeddingSummaryCard } from './wedding-summary-card';

export interface PartnerInviteStepProps {
  /** Primeiro nome de quem convidou. */
  inviterName: string;
  couple: string;
  /** Linha de data e cidade (weddingProfileDescription). */
  weddingDetails: string;
  invitedEmail: string;
  onContinueWithGoogle: () => void;
  onSubmit: (values: { email: string }) => void;
  onDecline: () => void;
  emailError?: string;
  submitting?: boolean;
}

/** Convite do parceiro (Área do Casal, Penpot; textos neutros da decisão 156). */
export function PartnerInviteStep({
  inviterName,
  couple,
  weddingDetails,
  invitedEmail,
  onContinueWithGoogle,
  onSubmit,
  onDecline,
  emailError,
  submitting = false,
}: PartnerInviteStepProps) {
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
      <GoogleOrEmail
        onContinueWithGoogle={onContinueWithGoogle}
        onSubmit={onSubmit}
        submitLabel={t('partnerInvite.accept')}
        defaultEmail={invitedEmail}
        {...(emailError !== undefined && { emailError })}
        submitting={submitting}
      />
      <button
        type="button"
        className="kore-sign-in__link kore-invite-partner__later"
        onClick={onDecline}
      >
        {t('partnerInvite.decline')}
      </button>
    </div>
  );
}
