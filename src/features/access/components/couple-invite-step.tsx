import { Button } from '@kore-io/design';
import { Gift } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SitePreviewCard, type SitePreviewCardProps } from './site-preview-card';

export interface CoupleInviteStepProps {
  organization: string;
  /** Primeiro nome de quem do cerimonial preparou o site. */
  plannerName: string;
  preview: SitePreviewCardProps;
  /** Desconto da indicação, vindo da API; sem ele, sem o destaque. */
  discountPercent?: number;
  /** Convite com e-mail: a nota de como vão entrar. Por link (decisão 102), sem a nota. */
  invitedEmail?: string;
  onAccept: () => void;
  onViewSite: () => void;
  submitting?: boolean;
}

/** Convite do casal, com e-mail ou por link (Área do Casal, Penpot; decisões 102, 106 e 156). */
export function CoupleInviteStep({
  organization,
  plannerName,
  preview,
  discountPercent,
  invitedEmail,
  onAccept,
  onViewSite,
  submitting = false,
}: CoupleInviteStepProps) {
  const { t } = useTranslation('access');
  return (
    <div className="kore-sign-in">
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">{t('coupleInvite.title', { organization })}</h1>
        <p className="kore-sign-in__description">
          {t('coupleInvite.description', { planner: plannerName })}
        </p>
      </div>
      <SitePreviewCard {...preview} />
      {discountPercent !== undefined && (
        <div className="kore-referral">
          <Gift className="kore-referral__icon" aria-hidden="true" strokeWidth={1.75} />
          <p className="kore-referral__description">
            {t('signUp.referralDescription', { percent: discountPercent })}
          </p>
        </div>
      )}
      <Button size="lg" className="kore-sign-in__submit" onClick={onAccept} disabled={submitting}>
        {t('coupleInvite.accept')}
      </Button>
      <Button variant="secondary" size="lg" className="kore-sign-in__submit" onClick={onViewSite}>
        {t('coupleInvite.viewSite')}
      </Button>
      {invitedEmail !== undefined && (
        <p className="kore-invite-partner__note">
          {t('coupleInvite.emailNote', { email: invitedEmail })}
        </p>
      )}
    </div>
  );
}
