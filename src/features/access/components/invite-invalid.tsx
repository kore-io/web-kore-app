import { Alert, Button } from '@kore-io/design';
import { useTranslation } from 'react-i18next';

/** Convite inválido (Acessos, Penpot): expirou, já foi usado ou foi cancelado. */
export function InviteInvalid({ onSignIn }: { onSignIn: () => void }) {
  const { t } = useTranslation('access');
  return (
    <div className="kore-sign-in">
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">{t('invite.invalid.title')}</h1>
        <p className="kore-sign-in__description">{t('invite.invalid.description')}</p>
      </div>
      <Alert tone="info" title={t('invite.invalid.alertTitle')}>
        {t('invite.invalid.alertDescription')}
      </Alert>
      <Button variant="secondary" size="lg" className="kore-sign-in__submit" onClick={onSignIn}>
        {t('invite.invalid.signIn')}
      </Button>
    </div>
  );
}
