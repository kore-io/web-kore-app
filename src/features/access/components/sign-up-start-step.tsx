import type { ReactNode } from 'react';
import { Gift } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GoogleOrEmail } from './google-or-email';

export interface SignUpStartStepProps {
  /** Aviso acima do título (ex.: muitos pedidos, rede fora), um Alert da lib. */
  notice?: ReactNode;
  /** Quem indicou e o desconto, vindos da API (referrer); sem indicação, sem o destaque. */
  referral?: { name: string; discountPercent: number };
  onContinueWithGoogle: () => void;
  onSubmit: (values: { email: string }) => void;
  emailError?: string;
  submitting?: boolean;
  signInHref: string;
  plannerHref: string;
  /**
   * A prévia do site do Simule (Cadastro RN12): o Início com rascunho ("Falta só criar a
   * conta."). No celular e no tablet, a prévia aparece aqui; no desktop, no painel da marca.
   */
  draftPreview?: ReactNode;
}

/** Cadastro — Início (Área do Casal, Penpot; quadro do Acessos pela decisão 154). */
export function SignUpStartStep({
  notice,
  referral,
  onContinueWithGoogle,
  onSubmit,
  emailError,
  submitting = false,
  signInHref,
  plannerHref,
  draftPreview,
}: SignUpStartStepProps) {
  const { t } = useTranslation('access');
  return (
    <div className="kore-sign-in">
      {notice}
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">
          {draftPreview ? t('signUp.draftTitle') : t('signUp.title')}
        </h1>
        <p className="kore-sign-in__description">
          {draftPreview ? t('signUp.draftDescription') : t('signUp.description')}
        </p>
      </div>
      {draftPreview && <div className="kore-sign-up__draft-preview">{draftPreview}</div>}
      {referral && (
        <div className="kore-referral">
          <Gift className="kore-referral__icon" aria-hidden="true" strokeWidth={1.75} />
          <div className="kore-referral__text">
            <p className="kore-referral__title">
              {t('signUp.referralTitle', { name: referral.name })}
            </p>
            <p className="kore-referral__description">
              {t('signUp.referralDescription', { percent: referral.discountPercent })}
            </p>
          </div>
        </div>
      )}
      <GoogleOrEmail
        onContinueWithGoogle={onContinueWithGoogle}
        onSubmit={onSubmit}
        submitLabel={t('signUp.submit')}
        {...(emailError !== undefined && { emailError })}
        submitting={submitting}
      />
      <div className="kore-sign-in__links kore-sign-in__links--actions">
        <p className="kore-sign-in__link-row">
          {draftPreview ? t('signUp.draftSignInPrompt') : t('signUp.signInPrompt')}{' '}
          <a className="kore-sign-in__link kore-sign-in__link--standalone" href={signInHref}>
            {t('signUp.signInLink')}
          </a>
        </p>
        <p className="kore-sign-in__link-row">
          {t('signIn.plannerPrompt')}{' '}
          <a className="kore-sign-in__link kore-sign-in__link--standalone" href={plannerHref}>
            {t('signIn.plannerLink')}
          </a>
        </p>
      </div>
    </div>
  );
}
