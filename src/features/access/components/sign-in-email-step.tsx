import { Button, Divider, GoogleButton, Input, Label } from '@kore-io/design';
import { useId, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

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
  const emailId = useId();
  const errorId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get('email');
    onSubmit({ email: typeof email === 'string' ? email.trim() : '' });
  }

  return (
    <div className="kore-sign-in">
      {notice}
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">{t('signIn.title')}</h1>
        <p className="kore-sign-in__description">{t('signIn.description')}</p>
      </div>
      <GoogleButton className="kore-sign-in__google" onClick={onContinueWithGoogle}>
        {t('signIn.google')}
      </GoogleButton>
      <div className="kore-sign-in__or">
        <Divider />
        <span className="kore-sign-in__or-text">{t('signIn.or')}</span>
        <Divider />
      </div>
      <form className="kore-sign-in__form" onSubmit={handleSubmit} noValidate>
        <div className="kore-sign-in__field">
          <Label htmlFor={emailId}>{t('signIn.emailLabel')}</Label>
          <Input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t('signIn.emailPlaceholder')}
            invalid={emailError !== undefined}
            {...(emailError !== undefined && { 'aria-describedby': errorId })}
          />
          {emailError !== undefined && (
            <p id={errorId} className="kore-sign-in__error">
              {emailError}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" className="kore-sign-in__submit" disabled={submitting}>
          {t('signIn.submit')}
        </Button>
      </form>
      <div className="kore-sign-in__links">
        <p className="kore-sign-in__link-row">
          {t('signIn.couplePrompt')}{' '}
          <a className="kore-sign-in__link" href={signUpHref}>
            {t('signIn.coupleLink')}
          </a>
        </p>
        <p className="kore-sign-in__link-row">
          {t('signIn.plannerPrompt')}{' '}
          <a className="kore-sign-in__link" href={plannerHref}>
            {t('signIn.plannerLink')}
          </a>
        </p>
      </div>
    </div>
  );
}
