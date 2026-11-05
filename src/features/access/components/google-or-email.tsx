import { Button, Divider, GoogleButton, Input } from '@kore-io/design';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '../../../shared/components/form-field';

export interface GoogleOrEmailProps {
  onContinueWithGoogle: () => void;
  onSubmit: (values: { email: string }) => void;
  /** Texto do botão do e-mail (Receber código no Entrar, Continuar no Cadastro). */
  submitLabel: string;
  emailError?: string;
  submitting?: boolean;
}

/** O miolo comum do Entrar e do Cadastro (Penpot): Google, "ou", E-mail e o botão. */
export function GoogleOrEmail({
  onContinueWithGoogle,
  onSubmit,
  submitLabel,
  emailError,
  submitting = false,
}: GoogleOrEmailProps) {
  const { t } = useTranslation('access');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get('email');
    onSubmit({ email: typeof email === 'string' ? email.trim() : '' });
  }

  return (
    <>
      <GoogleButton className="kore-sign-in__google" onClick={onContinueWithGoogle}>
        {t('signIn.google')}
      </GoogleButton>
      <div className="kore-sign-in__or">
        <Divider />
        <span className="kore-sign-in__or-text">{t('signIn.or')}</span>
        <Divider />
      </div>
      <form className="kore-sign-in__form" onSubmit={handleSubmit} noValidate>
        <FormField
          label={t('signIn.emailLabel')}
          {...(emailError !== undefined && { hint: emailError, hintTone: 'danger' as const })}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder={t('signIn.emailPlaceholder')}
              invalid={invalid}
              {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
            />
          )}
        </FormField>
        <Button type="submit" size="lg" className="kore-sign-in__submit" disabled={submitting}>
          {submitLabel}
        </Button>
      </form>
    </>
  );
}
