import { Button, Input } from '@kore-io/design';
import { Check, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '../../../shared/components/form-field';
import { WeddingSummaryCard } from './wedding-summary-card';

export interface PlannerInviteStepProps {
  /** Os primeiros nomes do casal ("Ana & Marcos"). */
  couple: string;
  /** Linha de data e cidade (weddingProfileDescription). */
  weddingDetails: string;
  /** Conta sem nome: o campo Seu nome, obrigatório (decisões 168(4), 173(d) e 174(6)). */
  needsName?: boolean;
  nameError?: string;
  onAccept: (values: { name?: string }) => void;
  onDecline: () => void;
  submitting?: boolean;
}

/** Convite do cerimonialista (Área do Cerimonialista, Penpot; Voz; RN10 de Convites). */
export function PlannerInviteStep({
  couple,
  weddingDetails,
  needsName = false,
  nameError,
  onAccept,
  onDecline,
  submitting = false,
}: PlannerInviteStepProps) {
  const { t } = useTranslation('access');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!needsName) {
      onAccept({});
      return;
    }
    const name = new FormData(event.currentTarget).get('name');
    onAccept({ name: typeof name === 'string' ? name.trim() : '' });
  }

  return (
    <div className="kore-sign-in">
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">
          {/* No título, "Ana e Marcos" (Voz); no cartão, "Ana & Marcos". */}
          {t('plannerInvite.title', { couple: couple.replace(' & ', ' e ') })}
        </h1>
        <p className="kore-sign-in__description">{t('plannerInvite.description')}</p>
      </div>
      <WeddingSummaryCard couple={couple} details={weddingDetails} />
      <ul className="kore-planner-invite__permissions">
        <li className="kore-planner-invite__permission">
          <Check className="kore-planner-invite__icon" aria-hidden="true" strokeWidth={1.75} />
          {t('plannerInvite.canEdit')}
        </li>
        <li className="kore-planner-invite__permission">
          <Check className="kore-planner-invite__icon" aria-hidden="true" strokeWidth={1.75} />
          {t('plannerInvite.canFollow')}
        </li>
        <li className="kore-planner-invite__permission">
          <X
            className="kore-planner-invite__icon kore-planner-invite__icon--denied"
            aria-hidden="true"
            strokeWidth={1.75}
          />
          {t('plannerInvite.coupleOnly')}
        </li>
      </ul>
      <form className="kore-sign-in__form" onSubmit={handleSubmit} noValidate>
        {needsName && (
          <FormField
            label={t('plannerInvite.nameLabel')}
            {...(nameError !== undefined && { hint: nameError, hintTone: 'danger' as const })}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="name"
                autoComplete="name"
                maxLength={80}
                invalid={invalid}
                {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
              />
            )}
          </FormField>
        )}
        <Button type="submit" size="lg" className="kore-sign-in__submit" disabled={submitting}>
          {t('plannerInvite.accept')}
        </Button>
      </form>
      <button
        type="button"
        className="kore-sign-in__link kore-sign-in__link--standalone kore-planner-invite__decline"
        onClick={onDecline}
        disabled={submitting}
      >
        {t('plannerInvite.decline')}
      </button>
    </div>
  );
}
