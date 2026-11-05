import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface ProfilesStepProps {
  title: string;
  description: string;
  /** Os cartões de perfil (ProfileOption). */
  children: ReactNode;
  onUseAnotherAccount: () => void;
}

/** Seleção de perfil (Acessos, Penpot), com ou sem perfil: título, cartões e outra conta. */
export function ProfilesStep({
  title,
  description,
  children,
  onUseAnotherAccount,
}: ProfilesStepProps) {
  const { t } = useTranslation('access');
  return (
    <div className="kore-sign-in">
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">{title}</h1>
        <p className="kore-sign-in__description">{description}</p>
      </div>
      <div className="kore-profiles">{children}</div>
      <div className="kore-sign-in__links">
        <button type="button" className="kore-sign-in__link" onClick={onUseAnotherAccount}>
          {t('profiles.useAnotherAccount')}
        </button>
      </div>
    </div>
  );
}
