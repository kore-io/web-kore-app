import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { RsvpResponse } from '../../shared/api/generated/model';
import { formatPhone } from '../../features/guests/party-form';
import {
  confirmedCount,
  DIET_MAX,
  displayName,
  formFromRsvp,
  hasErrors,
  PLUS_ONE_NAME_MAX,
  rememberedSigner,
  rememberSigner,
  rsvpBody,
  serverRsvpErrors,
  signers,
  SONG_MAX,
  validateRsvp,
  withAnswer,
  type RsvpAnswer,
  type RsvpErrors,
  type RsvpGuestForm,
} from './rsvp-form';
import { deadlineText, rsvpQueryKey, sendRsvp, useRsvp } from './use-rsvp';

/** Uma frase com a data curta ("15 de out."): um ponto só no fim. */
function sentence(text: string): string {
  return text.replace(/\.\.$/, '.');
}

type Notice = 'limit' | 'network' | 'linkInvalid';

/**
 * Confirmar presença (RN01 a RN14; Penpot, Área do Convidado, seção B; decisão 232): a
 * página do grupo em `/<slug>/confirmar-presenca`, com o nome do grupo e o título em todos
 * os estados. Aberto, o formulário por pessoa, as vagas, quem assina e o Enviar respostas;
 * depois de enviar, a confirmação com Alterar respostas. Depois do prazo ou no pós-evento,
 * só leitura; na prévia como grupo, o formulário não envia.
 */
export function RsvpPage({ slug, now }: { slug: string; now: Date }) {
  const { t } = useTranslation('publicSite');
  const rsvp = useRsvp({ slug });
  // O aviso do 409 sobrevive à remontagem do formulário com a versão nova (RN07).
  const [changed, setChanged] = useState(false);
  if (!rsvp.data) return null;
  return (
    <section className="kore-site-rsvp" aria-labelledby="kore-site-rsvp-title">
      <header className="kore-site-rsvp__header">
        <p className="kore-site-rsvp__overline">{rsvp.data.party.name}</p>
        <h1 id="kore-site-rsvp-title" className="kore-site-rsvp__title">
          {t('rsvp.title')}
        </h1>
      </header>
      {/* Remonta com a versão nova (após o 409 ou o envio), com as respostas atuais. */}
      <RsvpBody
        key={rsvp.data.party.version}
        slug={slug}
        rsvp={rsvp.data}
        now={now}
        changed={changed}
        onChanged={setChanged}
      />
    </section>
  );
}

function RsvpBody({
  slug,
  rsvp,
  now,
  changed,
  onChanged,
}: {
  slug: string;
  rsvp: RsvpResponse;
  now: Date;
  changed: boolean;
  onChanged: (changed: boolean) => void;
}) {
  const { t } = useTranslation('publicSite');
  const queryClient = useQueryClient();
  const [guests, setGuests] = useState(() => formFromRsvp(rsvp));
  const named = signers(guests);
  const [signer, setSigner] = useState<string | null>(() => {
    const remembered = rememberedSigner(rsvp.party.id);
    return named.some((guest) => guest.id === remembered) ? remembered : null;
  });
  const [errors, setErrors] = useState<RsvpErrors>({ guests: {} });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sending, setSending] = useState(false);
  // Quem já respondeu vê a confirmação; Alterar respostas reabre o formulário (RN09).
  const answered = named.length > 0 && named.every((guest) => guest.status !== 'pending');
  // Depois do 409, o formulário abre com as respostas atuais e o aviso (RN07).
  const [editing, setEditing] = useState(!answered || changed);
  const songEnabled = rsvp.songQuestion.enabled;
  const preview = rsvp.state === 'preview';

  if (rsvp.state === 'deadline_passed' || rsvp.state === 'post_event') {
    return <ClosedRsvp rsvp={rsvp} guests={guests} />;
  }

  if (!editing) {
    return (
      <Confirmation guests={guests}>
        <button
          type="button"
          className="kore-site-rsvp__secondary"
          onClick={() => setEditing(true)}
        >
          {t('rsvp.change')}
        </button>
        {rsvp.rsvpDeadline && (
          <p className="kore-site-rsvp__note">
            {sentence(
              t('rsvp.canChangeUntil', { date: deadlineText({ day: rsvp.rsvpDeadline, now }) }),
            )}
          </p>
        )}
      </Confirmation>
    );
  }

  function update(id: string, change: (guest: RsvpGuestForm) => RsvpGuestForm) {
    setGuests((current) => current.map((guest) => (guest.id === id ? change(guest) : guest)));
  }

  async function submit() {
    if (sending || preview) return;
    const local = validateRsvp({ guests, signer });
    setErrors(local);
    setNotice(null);
    onChanged(false);
    if (hasErrors(local) || !signer) return;
    const body = rsvpBody({ guests, signer, version: rsvp.party.version, songEnabled });
    setSending(true);
    const result = await sendRsvp({ slug, body });
    setSending(false);
    if (result.kind === 'saved') {
      rememberSigner({ partyId: rsvp.party.id, guestId: signer });
      // Sem mudança, a API devolve a mesma version e o formulário não remonta: a volta à
      // confirmação é explícita (RN09; ponto do Crivo).
      setGuests(formFromRsvp(result.rsvp));
      setEditing(false);
      queryClient.setQueryData(rsvpQueryKey(slug), result.rsvp);
      return;
    }
    if (result.kind === 'changed') {
      // O formulário recarrega com as respostas atuais, e o aviso diz o porquê (RN07).
      onChanged(true);
      queryClient.setQueryData(rsvpQueryKey(slug), result.rsvp);
      return;
    }
    if (result.kind === 'closed') {
      void queryClient.invalidateQueries({ queryKey: rsvpQueryKey(slug) });
      return;
    }
    if (result.kind === 'invalid') {
      setErrors(
        serverRsvpErrors({
          guests,
          answered: body.guests.map((guest) => guest.id),
          errors: result.errors,
        }),
      );
      return;
    }
    setNotice(
      result.kind === 'linkInvalid' ? 'linkInvalid' : result.kind === 'limit' ? 'limit' : 'network',
    );
  }

  const people = guests.filter((guest) => !guest.isPlusOne && guest.name);
  const slots = guests.filter((guest) => guest.isPlusOne);

  return (
    <form
      className="kore-site-rsvp__form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {/* O prazo fica com o formulário aberto; na confirmação, a nota diz o mesmo (232(3)). */}
      {rsvp.rsvpDeadline && (
        <p className="kore-site-rsvp__deadline">
          {sentence(t('rsvp.deadline', { date: deadlineText({ day: rsvp.rsvpDeadline, now }) }))}
        </p>
      )}
      {changed && <RsvpNotice>{t('rsvp.errors.changed')}</RsvpNotice>}
      {people.map((guest) => (
        <GuestBlock
          key={guest.id}
          guest={guest}
          error={errors.guests[guest.id]}
          songQuestion={songEnabled ? rsvp.songQuestion.text : null}
          onAnswer={(status) => update(guest.id, (current) => withAnswer(current, status))}
          onChange={(change) => update(guest.id, (current) => ({ ...current, ...change }))}
        />
      ))}
      {slots.length > 0 && (
        <div className="kore-site-rsvp__card">
          <p className="kore-site-rsvp__card-title">
            {t('rsvp.plusOnes', { count: slots.length })}
          </p>
          {slots.map((guest, index) => (
            <PlusOneBlock
              key={guest.id}
              // Com uma vaga, o título do cartão nomeia o grupo; com mais, "Acompanhante N" (232(4)).
              legend={
                slots.length > 1
                  ? t('rsvp.plusOneSlot', { n: index + 1 })
                  : t('rsvp.plusOnes', { count: 1 })
              }
              guest={guest}
              error={errors.guests[guest.id]}
              songQuestion={songEnabled ? rsvp.songQuestion.text : null}
              onAnswer={(status) => update(guest.id, (current) => withAnswer(current, status))}
              onChange={(change) => update(guest.id, (current) => ({ ...current, ...change }))}
            />
          ))}
        </div>
      )}
      <SignerField
        options={named}
        value={signer}
        invalid={errors.signer !== undefined}
        onChange={setSigner}
      />
      {notice && (
        <RsvpNotice>
          {notice === 'linkInvalid'
            ? `${t('states.linkInvalid.title')} ${t('states.linkInvalid.description')}`
            : notice === 'limit'
              ? t('rsvp.errors.limit')
              : t('rsvp.errors.network')}
        </RsvpNotice>
      )}
      <button
        type="submit"
        className="kore-site-rsvp__submit"
        disabled={sending || preview}
        aria-busy={sending}
        {...(preview && { 'aria-describedby': 'kore-site-rsvp-preview' })}
      >
        {sending && <span className="kore-site-rsvp__spinner" aria-hidden="true" />}
        {t('rsvp.send')}
      </button>
      {preview && (
        <p id="kore-site-rsvp-preview" className="kore-site-rsvp__help">
          {t('rsvp.previewReadOnly')}
        </p>
      )}
    </form>
  );
}

function RsvpNotice({ children }: { children: ReactNode }) {
  return (
    <p className="kore-site-rsvp__notice" role="alert">
      {children}
    </p>
  );
}

/** Vou · Não vou (ou Vou levar · Não vou levar), como um grupo de rádio. */
function AnswerChoice({
  legend,
  hiddenLegend = false,
  value,
  options,
  invalid,
  describedBy,
  onChange,
}: {
  legend: string;
  /** Na vaga, o título "Vocês podem levar…" já está visível acima. */
  hiddenLegend?: boolean;
  value: RsvpAnswer;
  options: [string, string];
  invalid: boolean;
  describedBy?: string | undefined;
  onChange: (status: RsvpAnswer) => void;
}) {
  const name = useId();
  return (
    <fieldset
      className="kore-site-rsvp__choice"
      aria-invalid={invalid || undefined}
      {...(describedBy && { 'aria-describedby': describedBy })}
    >
      <legend className={hiddenLegend ? 'kore-site-rsvp__hidden' : 'kore-site-rsvp__name'}>
        {legend}
      </legend>
      {(['confirmed', 'declined'] as const).map((status, index) => (
        <label key={status} className="kore-site-rsvp__option" data-checked={value === status}>
          <input
            type="radio"
            name={name}
            className="kore-site-rsvp__radio"
            checked={value === status}
            onChange={() => onChange(status)}
          />
          {options[index]}
        </label>
      ))}
    </fieldset>
  );
}

function TextField({
  label,
  value,
  maxLength,
  placeholder,
  help,
  error,
  onChange,
}: {
  label: string;
  value: string;
  maxLength: number;
  placeholder?: string;
  help?: string;
  error?: string | undefined;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const hintId = useId();
  const hint = error ?? help;
  return (
    <div className="kore-site-rsvp__field">
      <label htmlFor={id} className="kore-site-rsvp__label">
        {label}
      </label>
      <input
        id={id}
        className="kore-site-rsvp__input"
        value={value}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        {...(placeholder && { placeholder })}
        {...(hint && { 'aria-describedby': hintId })}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && (
        <p id={hintId} className={error ? 'kore-site-rsvp__error' : 'kore-site-rsvp__help'}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** A restrição e a música de quem vai (RN03; Música RN04). */
function GoingFields({
  guest,
  error,
  songQuestion,
  onChange,
}: {
  guest: RsvpGuestForm;
  error: string | undefined;
  songQuestion: string | null;
  onChange: (change: Partial<RsvpGuestForm>) => void;
}) {
  const { t } = useTranslation('publicSite');
  return (
    <>
      <TextField
        label={t('rsvp.diet')}
        value={guest.dietaryRestriction}
        maxLength={DIET_MAX}
        placeholder={t('rsvp.dietPlaceholder')}
        help={t('rsvp.dietHelp')}
        error={error === 'dietTooLong' ? t('rsvp.errors.dietTooLong') : undefined}
        onChange={(value) => onChange({ dietaryRestriction: value })}
      />
      {songQuestion && (
        <TextField
          label={t('rsvp.songOptional', { question: songQuestion })}
          value={guest.songSuggestion}
          maxLength={SONG_MAX}
          placeholder={t('rsvp.songPlaceholder')}
          error={error === 'songTooLong' ? t('rsvp.errors.songTooLong') : undefined}
          onChange={(value) => onChange({ songSuggestion: value })}
        />
      )}
    </>
  );
}

interface BlockProps {
  guest: RsvpGuestForm;
  error: string | undefined;
  songQuestion: string | null;
  onAnswer: (status: RsvpAnswer) => void;
  onChange: (change: Partial<RsvpGuestForm>) => void;
}

function GuestBlock({ guest, error, songQuestion, onAnswer, onChange }: BlockProps) {
  const { t } = useTranslation('publicSite');
  const errorId = useId();
  const name = displayName(guest);
  return (
    <div className="kore-site-rsvp__card">
      <AnswerChoice
        legend={name}
        value={guest.status}
        options={[t('rsvp.going'), t('rsvp.notGoing')]}
        invalid={error === 'answerMissing'}
        describedBy={error === 'answerMissing' ? errorId : undefined}
        onChange={onAnswer}
      />
      {error === 'answerMissing' && (
        <p id={errorId} className="kore-site-rsvp__error">
          {t('rsvp.errors.answerMissing', { name })}
        </p>
      )}
      {guest.status === 'confirmed' && (
        <GoingFields guest={guest} error={error} songQuestion={songQuestion} onChange={onChange} />
      )}
    </div>
  );
}

/** A vaga: Vou levar já conta o acompanhante como confirmado, com o nome (RN05). */
function PlusOneBlock({
  guest,
  error,
  songQuestion,
  onAnswer,
  onChange,
  legend,
}: BlockProps & { legend: string }) {
  const { t } = useTranslation('publicSite');
  return (
    <div className="kore-site-rsvp__slot">
      <AnswerChoice
        legend={legend}
        hiddenLegend
        value={guest.status}
        options={[t('rsvp.bring'), t('rsvp.notBring')]}
        invalid={false}
        onChange={onAnswer}
      />
      {guest.status === 'confirmed' && (
        <>
          <TextField
            label={t('rsvp.plusOneName')}
            value={guest.plusOneName}
            maxLength={PLUS_ONE_NAME_MAX}
            error={
              error === 'plusOneNameMissing'
                ? t('rsvp.errors.plusOneNameMissing')
                : error === 'nameTooLong'
                  ? t('rsvp.errors.nameTooLong')
                  : undefined
            }
            onChange={(value) => onChange({ plusOneName: value })}
          />
          <GoingFields
            guest={guest}
            error={error}
            songQuestion={songQuestion}
            onChange={onChange}
          />
        </>
      )}
    </div>
  );
}

/** Quem está respondendo? (RN04): só os convidados com nome; obrigatório. */
function SignerField({
  options,
  value,
  invalid,
  onChange,
}: {
  options: readonly RsvpGuestForm[];
  value: string | null;
  invalid: boolean;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation('publicSite');
  const name = useId();
  const hintId = useId();
  const errorId = useId();
  return (
    <div className="kore-site-rsvp__card">
      <fieldset
        className="kore-site-rsvp__signer"
        aria-describedby={invalid ? `${errorId} ${hintId}` : hintId}
        aria-invalid={invalid || undefined}
      >
        <legend className="kore-site-rsvp__name">{t('rsvp.signer')}</legend>
        <div className="kore-site-rsvp__pills">
          {options.map((guest) => (
            <label
              key={guest.id}
              className="kore-site-rsvp__option"
              data-checked={value === guest.id}
            >
              <input
                type="radio"
                name={name}
                className="kore-site-rsvp__radio"
                checked={value === guest.id}
                onChange={() => onChange(guest.id)}
              />
              {/* Só o primeiro nome, como no Penpot (decisão 232(5)). */}
              {guest.name?.split(' ')[0]}
            </label>
          ))}
        </div>
        {invalid && (
          <p id={errorId} className="kore-site-rsvp__error">
            {t('rsvp.errors.signerMissing')}
          </p>
        )}
        <p id={hintId} className="kore-site-rsvp__help">
          {t('rsvp.signerHelp')}
        </p>
      </fieldset>
    </div>
  );
}

/** A confirmação (RN09): sem "Obrigado!", o resumo só com Vou / Não vou. */
function Confirmation({
  guests,
  children,
}: {
  guests: readonly RsvpGuestForm[];
  children?: ReactNode;
}) {
  const { t } = useTranslation('publicSite');
  const count = confirmedCount(guests);
  const answered = guests.filter((guest) => guest.status !== 'pending');
  return (
    <div className="kore-site-rsvp__done">
      <span className="kore-site-rsvp__done-icon" aria-hidden="true">
        <Check />
      </span>
      <p className="kore-site-rsvp__done-title" role="status">
        {count > 0 ? t('rsvp.done.confirmed', { count }) : t('rsvp.done.declined')}
      </p>
      <Summary guests={answered} />
      {children}
    </div>
  );
}

function Summary({ guests }: { guests: readonly RsvpGuestForm[] }) {
  const { t } = useTranslation('publicSite');
  return (
    <ul className="kore-site-rsvp__summary">
      {guests.map((guest) => (
        <li key={guest.id} className="kore-site-rsvp__summary-item">
          <span>{displayName(guest) || t('rsvp.plusOneName')}</span>
          <span className="kore-site-rsvp__summary-answer">
            {guest.status === 'confirmed' ? t('rsvp.going') : t('rsvp.notGoing')}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Depois do prazo ou no pós-evento: só leitura, com o contato do casal no prazo (RN08). */
function ClosedRsvp({ rsvp, guests }: { rsvp: RsvpResponse; guests: readonly RsvpGuestForm[] }) {
  const { t } = useTranslation('publicSite');
  const answered = guests.filter((guest) => guest.status !== 'pending');
  const postEvent = rsvp.state === 'post_event';
  return (
    <div className="kore-site-rsvp__closed">
      <div className="kore-site-rsvp__closed-box">
        <p className="kore-site-rsvp__closed-text">
          {postEvent ? t('rsvp.closed.postEvent') : t('rsvp.closed.deadline')}
        </p>
        {!postEvent && rsvp.contact.whatsapp && (
          <p className="kore-site-rsvp__contact">
            {t('rsvp.closed.whatsapp', { phone: formatPhone(rsvp.contact.whatsapp) })}
          </p>
        )}
        {!postEvent && !rsvp.contact.whatsapp && rsvp.contact.email && (
          <p className="kore-site-rsvp__contact">
            {t('rsvp.closed.email', { email: rsvp.contact.email })}
          </p>
        )}
      </div>
      {answered.length > 0 && <Summary guests={answered} />}
    </div>
  );
}
