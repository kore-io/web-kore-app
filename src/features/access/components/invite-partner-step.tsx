import { Button, Input } from '@kore-io/design';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '../../../shared/components/form-field';

export interface InvitePartnerStepProps {
  /** Nome de quem casa com a pessoa, como digitado no cadastro. */
  partnerName: string;
  onSubmit: (values: { email: string }) => void;
  onSkip: () => void;
  emailError?: string;
  submitting?: boolean;
}

/**
 * Convidar o parceiro (Área do Casal, Penpot), com os textos neutros da decisão 155: o app
 * não sabe o gênero de quem casa com a pessoa. Sem a linha legal.
 */
export function InvitePartnerStep({
  partnerName,
  onSubmit,
  onSkip,
  emailError,
  submitting = false,
}: InvitePartnerStepProps) {
  const { t } = useTranslation('access');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get('email');
    onSubmit({ email: typeof email === 'string' ? email.trim() : '' });
  }

  return (
    <div className="kore-sign-in">
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">{t('invitePartner.title', { name: partnerName })}</h1>
        <p className="kore-sign-in__description">
          {t('invitePartner.description', { name: partnerName })}
        </p>
      </div>
      <form className="kore-sign-in__form" onSubmit={handleSubmit} noValidate>
        <FormField
          label={t('invitePartner.emailLabel', { name: partnerName })}
          {...(emailError !== undefined && { hint: emailError, hintTone: 'danger' as const })}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="email"
              type="email"
              autoComplete="off"
              inputMode="email"
              invalid={invalid}
              {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
            />
          )}
        </FormField>
        <Button type="submit" size="lg" className="kore-sign-in__submit" disabled={submitting}>
          {t('invitePartner.submit')}
        </Button>
      </form>
      <button
        type="button"
        className="kore-sign-in__link kore-invite-partner__later"
        onClick={onSkip}
      >
        {t('invitePartner.later')}
      </button>
      <p className="kore-invite-partner__note">{t('invitePartner.laterNote')}</p>
    </div>
  );
}
