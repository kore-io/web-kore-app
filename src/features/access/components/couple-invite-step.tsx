import { Button } from '@kore-io/design';
import { Gift } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SitePreviewCard, type SitePreviewCardProps } from './site-preview-card';

export interface CoupleInviteStepProps {
  /** Quem preparou: o Nome para a assinatura do cerimonialista ou o primeiro nome do vendedor. */
  inviterName: string;
  /** Vendedor: "{nome}, do Kore," e sem o "continua ajudando", porque ele sai no aceite (RN09). */
  fromSeller?: boolean;
  preview: SitePreviewCardProps;
  /** Desconto da indicação, vindo da API; sem ele, sem o destaque. */
  discountPercent?: number;
  /** Convite com e-mail: a nota de como vão entrar. Por link (decisão 102), sem a nota. */
  invitedEmail?: string;
  onAccept: () => void;
  /** Sem o site ainda (F0, decisão 174(2)), sem o "Ver o site completo". */
  onViewSite?: () => void;
  submitting?: boolean;
}

/**
 * Convite do casal, com e-mail ou por link (Área do Casal, Penpot; decisões 102, 106 e 156;
 * vendedor, decisão 174(1)).
 */
export function CoupleInviteStep({
  inviterName,
  fromSeller = false,
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
        <h1 className="kore-sign-in__title">
          {fromSeller
            ? t('coupleInvite.titleSeller', { name: inviterName })
            : t('coupleInvite.title', { name: inviterName })}
        </h1>
        <p className="kore-sign-in__description">
          {fromSeller
            ? t('coupleInvite.descriptionSeller')
            : t('coupleInvite.description', { name: inviterName })}
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
      {onViewSite && (
        <Button variant="secondary" size="lg" className="kore-sign-in__submit" onClick={onViewSite}>
          {t('coupleInvite.viewSite')}
        </Button>
      )}
      {invitedEmail !== undefined && (
        <p className="kore-invite-partner__note">
          {t('coupleInvite.emailNote', { email: invitedEmail })}
        </p>
      )}
    </div>
  );
}
