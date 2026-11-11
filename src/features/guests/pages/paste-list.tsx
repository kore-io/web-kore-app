import { Alert, Button, Input, StatCard, Textarea } from '@kore-io/design';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '../../../shared/components/form-field';
import type { Audience } from '../hooks/use-active-wedding';
import type { usePasteImport } from '../hooks/use-paste-import';
import {
  draftCounts,
  draftIsValid,
  groupNameError,
  guestNameError,
  type DraftGroup,
  type NameError,
} from '../paste-draft';

type Paste = ReturnType<typeof usePasteImport>;

/** O texto do erro de um nome; o vazio só trava o Importar, sem texto (RN12). */
function useNameErrorText() {
  const { t } = useTranslation('guests');
  return (error: NameError | null) =>
    error === 'tooLong'
      ? t('pasteList.tooLong')
      : error === 'duplicate'
        ? t('pasteList.duplicateName')
        : undefined;
}

/** Colar a lista (RN10): o texto, uma linha por grupo, e o Continuar. */
export function PasteText({
  paste,
  audience,
  onBack,
}: {
  paste: Paste;
  audience: Audience;
  onBack: () => void;
}) {
  const { t } = useTranslation('guests');
  const titleId = useId();
  return (
    <section className="kore-import" aria-labelledby={titleId}>
      <h2 id={titleId} className="kore-import__step">
        {t('pasteList.title')}
      </h2>
      <p className="kore-import__text">{t(`pasteList.intro.${audience}`)}</p>
      <Textarea
        className="kore-paste__text"
        aria-labelledby={titleId}
        placeholder={t('pasteList.placeholder')}
        rows={6}
        maxLength={100_000}
        value={paste.text}
        onChange={(event) => paste.setText(event.target.value)}
      />
      {paste.refusal && (
        <Alert tone="danger" role="alert">
          {paste.refusal}
        </Alert>
      )}
      <div className="kore-paste__actions">
        <Button variant="secondary" onClick={onBack}>
          {t('pasteList.back')}
        </Button>
        <Button disabled={!paste.text.trim() || paste.isReading} onClick={paste.send}>
          {t('pasteList.continue')}
        </Button>
      </div>
    </section>
  );
}

/** Prévia da lista colada (RN11 e RN12; decisão 210). */
export function PastePreview({ paste, audience }: { paste: Paste; audience: Audience }) {
  const { t } = useTranslation('guests');
  const draft = paste.draft;
  if (!draft) return null;
  const counts = draftCounts(draft);
  const parties = t('importSheet.parties', { count: counts.parties });
  const guests = t('importSheet.guests', { count: counts.guests });

  return (
    <div className="kore-import-preview">
      <div className="kore-import-preview__stats">
        <StatCard
          label={t('pasteList.groups')}
          value={counts.parties}
          detail={t('pasteList.groupsDetail')}
        />
        <StatCard
          label={t('pasteList.guests')}
          value={counts.guests}
          detail={t('pasteList.guestsDetail')}
        />
        <StatCard
          label={t('pasteList.missing')}
          value={counts.missingNames}
          {...(counts.groupsMissingNames > 0 && {
            detail: t('pasteList.missingDetail', { count: counts.groupsMissingNames }),
          })}
        />
      </div>

      {draft.groups.map((group) => (
        <GroupCard key={group.key} group={group} paste={paste} audience={audience} />
      ))}

      <Alert tone="info" title={t('importSheet.summary', { parties, guests })} />

      <div className="kore-import-preview__actions">
        <Button variant="secondary" onClick={paste.back}>
          {t('pasteList.back')}
        </Button>
        <Button disabled={!draftIsValid(draft) || paste.isImporting} onClick={paste.importAll}>
          {t('importSheet.import', { count: counts.guests })}
        </Button>
      </div>
    </div>
  );
}

/** Um cartão por grupo, com os nomes editáveis (210(1)). */
function GroupCard({
  group,
  paste,
  audience,
}: {
  group: DraftGroup;
  paste: Paste;
  audience: Audience;
}) {
  const { t } = useTranslation('guests');
  const errorText = useNameErrorText();
  const sourceId = useId();
  const warnings = group.warnings.flatMap((warning) =>
    warning === 'PARTY_NAME_EXISTS'
      ? [t('pasteList.partyExists')]
      : warning === 'DUPLICATE_REMOVED'
        ? [t('pasteList.duplicateRemoved')]
        : warning === 'PLUS_OUT_OF_RANGE'
          ? [t(`pasteList.plusOutOfRange.${audience}`)]
          : [],
  );

  return (
    <section className="kore-paste-group" aria-labelledby={sourceId}>
      {group.askNames && <p className="kore-paste-group__ask">{t('pasteList.askNames')}</p>}
      <h2 id={sourceId} className="kore-paste-group__source">
        {group.source}
      </h2>
      {warnings.length > 0 && (
        <Alert tone="warning">
          <ul className="kore-import-preview__warnings">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      )}
      {group.nameEditable && (
        <FormField
          label={t('pasteList.groupName')}
          hint={errorText(groupNameError(group))}
          hintTone="danger"
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={group.name}
              onChange={(event) =>
                paste.setGroupName({ groupKey: group.key, name: event.target.value })
              }
            />
          )}
        </FormField>
      )}
      <ul className="kore-paste-group__guests">
        {group.guests.map((guest, index) => (
          <GuestField
            key={guest.key}
            label={t('pasteList.personName', { n: index + 1 })}
            value={guest.name}
            error={errorText(guestNameError({ group, index }))}
            removeLabel={t('pasteList.removePerson')}
            onChange={(name) =>
              paste.setGuestName({ groupKey: group.key, guestKey: guest.key, name })
            }
            onRemove={() => paste.removeGuest({ groupKey: group.key, guestKey: guest.key })}
          />
        ))}
      </ul>
    </section>
  );
}

/** O nome de uma pessoa; vazio, mostra o Remover pessoa (RN11). */
function GuestField({
  label,
  value,
  error,
  removeLabel,
  onChange,
  onRemove,
}: {
  label: string;
  value: string;
  error: string | undefined;
  removeLabel: string;
  onChange: (name: string) => void;
  onRemove: () => void;
}) {
  const errorId = useId();
  return (
    <li className="kore-paste-group__guest">
      <div className="kore-paste-group__guest-row">
        <Input
          className="kore-paste-group__guest-input"
          aria-label={label}
          placeholder={label}
          aria-describedby={error ? errorId : undefined}
          invalid={error !== undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {!value.trim() && (
          <Button variant="ghost" onClick={onRemove}>
            {removeLabel}
          </Button>
        )}
      </div>
      {error && (
        <p id={errorId} className="kore-form-field__hint kore-form-field__hint--danger">
          {error}
        </p>
      )}
    </li>
  );
}
