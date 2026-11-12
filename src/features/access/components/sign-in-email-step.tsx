import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { GoogleOrEmail } from './google-or-email';

export interface SignInEmailStepProps {
  /** Aviso acima do título (ex.: Sessão expirada, erro do Google), um Alert da lib. */
  notice?: ReactNode;
  onContinueWithGoogle: () => void;
  onSubmit: (values: { email: string }) => void;
  /** Mensagem de erro do campo E-mail, vinda da validação. */
  emailError?: string;
  submitting?: boolean;
  /** Destinos dos links do rodapé (Criar meu site, Fazer parceria). */
  signUpHref: string;
  plannerHref: string;
}

/** Passo do e-mail da tela Entrar (Acessos, Penpot): Google, "ou", e-mail e os links. */
export function SignInEmailStep({
  notice,
  onContinueWithGoogle,
  onSubmit,
  emailError,
  submitting = false,
  signUpHref,
  plannerHref,
}: SignInEmailStepProps) {
  const { t } = useTranslation('access');
  return (
    <div className="kore-sign-in">
      {notice}
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">{t('signIn.title')}</h1>
        <p className="kore-sign-in__description">{t('signIn.description')}</p>
      </div>
      <GoogleOrEmail
        onContinueWithGoogle={onContinueWithGoogle}
        onSubmit={onSubmit}
        submitLabel={t('signIn.submit')}
        {...(emailError !== undefined && { emailError })}
        submitting={submitting}
      />
      <div className="kore-sign-in__links kore-sign-in__links--actions">
        <p className="kore-sign-in__link-row">
          {t('signIn.couplePrompt')}{' '}
          <a className="kore-sign-in__link kore-sign-in__link--standalone" href={signUpHref}>
            {t('signIn.coupleLink')}
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
