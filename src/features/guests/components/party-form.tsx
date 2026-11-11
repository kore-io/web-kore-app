import { Button, Checkbox, Input, Select, Textarea } from '@kore-io/design';
import type { TFunction } from 'i18next';
import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TagResponse } from '../../../shared/api/generated/model';
import { FormField } from '../../../shared/components/form-field';
import type { Audience } from '../hooks/use-active-wedding';
import {
  canBeContact,
  emptyGuest,
  PLUS_ONES_MAX,
  type AgeGroupChoice,
  type FieldError,
  type FieldErrors,
  type GuestDraft,
  type PartyDraft,
} from '../party-form';

/** O texto de um erro de campo, pelo código e pelo perfil (RN04; 189(5); 213(3)). */
export function fieldErrorText({
  t,
  error,
  field,
  audience,
}: {
  t: TFunction<'guests'>;
  error: FieldError | undefined;
  field: 'groupName' | 'guestName' | 'phone' | 'email' | 'note';
  audience: Audience;
}): string | undefined {
  if (!error) return undefined;
  const n = (error.params as { n?: number }).n ?? 0;
  switch (error.code) {
    case 'NAME_MISSING':
      return t(
        field === 'groupName'
          ? `partyForm.errors.groupNameMissing.${audience}`
          : `partyForm.errors.guestNameMissing.${audience}`,
      );
    case 'TOO_LONG':
      return t('partyForm.errors.tooLong');
    case 'NOTE_TOO_LONG':
      return t('partyForm.errors.noteTooLong');
    case 'EMAIL_INVALID':
      return t(`partyForm.errors.emailInvalid.${audience}`);
    case 'PHONE_TOO_SHORT':
    case 'PHONE_TOO_LONG':
      return t(`importSheet.rowErrors.${error.code}.${audience}`, { n });
    case 'PHONE_INVALID':
      return t('importSheet.rowErrors.PHONE_INVALID', { n });
  }
}

export interface PartyFormProps {
  draft: PartyDraft;
  onChange: (draft: PartyDraft) => void;
  errors: FieldErrors;
  audience: Audience;
  tags: readonly TagResponse[];
  /** O erro das vagas que já têm resposta (409; RN07), embaixo do campo. */
  plusOnesError?: string | undefined;
  submitLabel: string;
  isSaving: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * Formulário do Novo grupo e do Editar grupo (Penpot "Novo grupo"; Grupos e convidados
 * RN03 a RN09; decisão 213): nome do grupo, os convidados (nome, faixa etária, telefone,
 * e-mail e o contato), + Adicionar convidado, vagas, tags e a observação interna. Sem a
 * restrição alimentar, que vem da planilha (RN05).
 */
export function PartyForm({
  draft,
  onChange,
  errors,
  audience,
  tags,
  plusOnesError,
  submitLabel,
  isSaving,
  onSubmit,
  onCancel,
}: PartyFormProps) {
  const { t } = useTranslation('guests');
  const text = (
    error: FieldError | undefined,
    field: Parameters<typeof fieldErrorText>[0]['field'],
  ) => fieldErrorText({ t, error, field, audience });

  function setGuest(key: string, patch: Partial<GuestDraft>) {
    onChange({
      ...draft,
      guests: draft.guests.map((guest) => (guest.key === key ? { ...guest, ...patch } : guest)),
    });
  }

  return (
    <form
      className="kore-party-form"
      noValidate
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <FormField
        label={t('partyForm.groupName')}
        hint={text(errors.name, 'groupName')}
        hintTone="danger"
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
          />
        )}
      </FormField>

      <fieldset className="kore-party-form__guests">
        <legend className="kore-party-form__legend">{t('partyForm.guests')}</legend>
        {draft.guests.map((guest) => (
          <GuestFields
            key={guest.key}
            guest={guest}
            errors={errors}
            text={text}
            isContact={draft.contactKey === guest.key}
            onChange={(patch) => setGuest(guest.key, patch)}
            onContact={(checked) => onChange({ ...draft, contactKey: checked ? guest.key : null })}
          />
        ))}
        <Button
          type="button"
          variant="ghost"
          className="kore-party-form__add"
          onClick={() => onChange({ ...draft, guests: [...draft.guests, emptyGuest()] })}
        >
          {t('partyForm.addGuest')}
        </Button>
      </fieldset>

      <FormField
        label={t('partyForm.plusOnes')}
        hint={plusOnesError ?? t('partyForm.plusOnesHint')}
        hintTone={plusOnesError ? 'danger' : 'neutral'}
      >
        {({ id, describedBy, invalid }) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            value={String(draft.plusOneSlots)}
            onChange={(event) => onChange({ ...draft, plusOneSlots: Number(event.target.value) })}
          >
            {Array.from({ length: PLUS_ONES_MAX + 1 }, (_, count) => (
              <option key={count} value={count}>
                {count === 0
                  ? t('partyForm.plusOnesNone')
                  : t('partyForm.plusOnesCount', { count })}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      {tags.length > 0 && (
        <fieldset className="kore-party-form__tags">
          <legend className="kore-party-form__legend">{t('partyForm.tags')}</legend>
          <div className="kore-party-form__tag-list">
            {tags.map((tag) => (
              <Checkbox
                key={tag.id}
                checked={draft.tagIds.includes(tag.id)}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    tagIds: event.target.checked
                      ? [...draft.tagIds, tag.id]
                      : draft.tagIds.filter((id) => id !== tag.id),
                  })
                }
              >
                {tag.name}
              </Checkbox>
            ))}
          </div>
        </fieldset>
      )}

      <FormField
        label={t('partyForm.note')}
        hint={text(errors.internalNote, 'note')}
        hintTone="danger"
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            rows={3}
            placeholder={t('partyForm.notePlaceholder')}
            value={draft.internalNote}
            onChange={(event) => onChange({ ...draft, internalNote: event.target.value })}
          />
        )}
      </FormField>

      <div className="kore-party-form__actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('partyForm.cancel')}
        </Button>
        <Button type="submit" disabled={isSaving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function GuestFields({
  guest,
  errors,
  text,
  isContact,
  onChange,
  onContact,
}: {
  guest: GuestDraft;
  errors: FieldErrors;
  text: (
    error: FieldError | undefined,
    field: 'groupName' | 'guestName' | 'phone' | 'email' | 'note',
  ) => string | undefined;
  isContact: boolean;
  onChange: (patch: Partial<GuestDraft>) => void;
  onContact: (checked: boolean) => void;
}): ReactNode {
  const { t } = useTranslation('guests');
  const error = (field: string) => errors[`guests.${guest.key}.${field}`];
  return (
    <div className="kore-party-form__guest">
      <div className="kore-party-form__row kore-party-form__row--name">
        <FormField
          label={t('partyForm.guestName')}
          hint={text(error('name'), 'guestName')}
          hintTone="danger"
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={guest.name}
              onChange={(event) => onChange({ name: event.target.value })}
            />
          )}
        </FormField>
        <FormField label={t('partyForm.ageGroup')}>
          {({ id }) => (
            <Select
              id={id}
              value={guest.ageGroup}
              onChange={(event) => onChange({ ageGroup: event.target.value as AgeGroupChoice })}
            >
              <option value="adult">{t('partyForm.ages.adult')}</option>
              <option value="child">{t('partyForm.ages.child')}</option>
              <option value="baby">{t('partyForm.ages.baby')}</option>
              <option value="">{t('partyForm.ages.none')}</option>
            </Select>
          )}
        </FormField>
      </div>
      <div className="kore-party-form__row">
        <FormField
          label={t('partyForm.phone')}
          hint={text(error('phone'), 'phone')}
          hintTone="danger"
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="tel"
              autoComplete="off"
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder={t('partyForm.phonePlaceholder')}
              value={guest.phone}
              onChange={(event) => onChange({ phone: event.target.value })}
            />
          )}
        </FormField>
        <FormField
          label={t('partyForm.email')}
          hint={text(error('email'), 'email')}
          hintTone="danger"
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              autoComplete="off"
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder={t('partyForm.emailPlaceholder')}
              value={guest.email}
              onChange={(event) => onChange({ email: event.target.value })}
            />
          )}
        </FormField>
      </div>
      <Checkbox
        checked={isContact && canBeContact(guest)}
        disabled={!canBeContact(guest)}
        onChange={(event) => onContact(event.target.checked)}
      >
        {t('partyForm.contact')}
      </Checkbox>
    </div>
  );
}
