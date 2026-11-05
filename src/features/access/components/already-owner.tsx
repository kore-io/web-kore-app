import { Button } from '@kore-io/design';
import { useTranslation } from 'react-i18next';

/** Cadastro — Você já tem um casamento (Penpot; RN06, 409 ALREADY_OWNER). Sem a linha legal. */
export function AlreadyOwner({ onOpenWedding }: { onOpenWedding: () => void }) {
  const { t } = useTranslation('access');
  return (
    <div className="kore-sign-in">
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">{t('alreadyOwner.title')}</h1>
        <p className="kore-sign-in__description">{t('alreadyOwner.description')}</p>
      </div>
      <Button size="lg" className="kore-sign-in__submit" onClick={onOpenWedding}>
        {t('alreadyOwner.open')}
      </Button>
    </div>
  );
}
