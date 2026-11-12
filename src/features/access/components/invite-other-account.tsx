import { Alert, Button } from '@kore-io/design';
import { useTranslation } from 'react-i18next';

export interface InviteOtherAccountProps {
  invitedEmail: string;
  currentEmail: string;
  onConfirm: () => void;
  onUseAnotherAccount: () => void;
  submitting?: boolean;
}

/** Outra conta (Acessos, Penpot): o convite foi para um e-mail e a pessoa entrou com outro. */
export function InviteOtherAccount({
  invitedEmail,
  currentEmail,
  onConfirm,
  onUseAnotherAccount,
  submitting = false,
}: InviteOtherAccountProps) {
  const { t } = useTranslation('access');
  return (
    <div className="kore-sign-in">
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">{t('invite.otherAccount.title')}</h1>
        <p className="kore-sign-in__description">
          {t('invite.otherAccount.description', { invitedEmail, currentEmail })}
        </p>
      </div>
      <Alert tone="warning" title={t('invite.otherAccount.alertTitle')}>
        {t('invite.otherAccount.alertDescription', { currentEmail })}
      </Alert>
      <Button size="lg" className="kore-sign-in__submit" onClick={onConfirm} disabled={submitting}>
        {t('invite.otherAccount.confirm', { currentEmail })}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        className="kore-sign-in__submit"
        onClick={onUseAnotherAccount}
      >
        {t('invite.otherAccount.useAnotherAccount')}
      </Button>
    </div>
  );
}
