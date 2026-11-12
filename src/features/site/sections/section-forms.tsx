import { Alert, Button, DateField, IconButton, Input, Switch, Textarea } from '@kore-io/design';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { siteSectionPath } from '../../../app/paths';
import type { SiteEditorResponse, SiteSectionResponse } from '../../../shared/api/generated/model';
import { FormField } from '../../../shared/components/form-field';
import type { Audience } from '../../guests/hooks/use-active-wedding';
import { ImageField, type ImageValue } from '../components/image-field';
import { FIRST_SECTION_SLUG } from '../sections';
import { useSiteSection, type SectionErrors } from './use-site-section';

const NUMBER = new Intl.NumberFormat('pt-BR');
const TITLE_MAX = 80;
const LODGING_MAX = 5000;
const DRESS_MAX = 2000;
const QUESTION_MAX = 200;
const ANSWER_MAX = 1000;
export const FAQ_MAX = 30;
export const VENUES_MAX = 4;
const VENUE_TITLE_MAX = 40;
const PLACE_NAME_MAX = 80;
const ADDRESS_MAX = 200;

/** Move o item da posição `index` uma casa para cima (-1) ou para baixo (1). */
function moveItem<T>(items: readonly T[], index: number, by: -1 | 1): T[] {
  const next = [...items];
  const [item] = next.splice(index, 1);
  if (item !== undefined) next.splice(index + by, 0, item);
  return next;
}

interface SectionProps {
  weddingId: string;
  site: SiteEditorResponse;
  section: SiteSectionResponse;
  audience: Audience;
}

type Section = ReturnType<typeof useSiteSection<unknown>>;

/**
 * O que toda seção de conteúdo tem (Seções RN03, RN11, RN12): o Switch "Mostrar a seção
 * no site", o aviso de ligada e vazia e o Título da seção.
 */
function SectionFrame({
  state,
  audience,
  empty,
  notice,
  children,
}: {
  state: Pick<Section, 'draft' | 'errors' | 'setEnabled' | 'setTitle' | 'clearError'>;
  audience: Audience;
  empty: boolean;
  /** O aviso fixo da seção, embaixo do título (Penpot 1.4). */
  notice?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation('site');
  return (
    <div className="kore-site-section">
      {state.draft.enabled && empty && <Alert tone="warning">{t('section.empty')}</Alert>}
      <Switch
        checked={state.draft.enabled}
        onChange={(event) => state.setEnabled(event.target.checked)}
      >
        {t('section.show')}
      </Switch>
      <FormField
        label={t('section.title')}
        {...(state.errors.title && {
          hint: t(`section.errors.titleMissing.${audience}`),
          hintTone: 'danger' as const,
        })}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            maxLength={TITLE_MAX}
            value={state.draft.title}
            onChange={(event) => {
              state.clearError('title');
              state.setTitle(event.target.value);
            }}
          />
        )}
      </FormField>
      {notice}
      {children}
    </div>
  );
}

/** Texto com o contador do Penpot ("0/5.000"); o limite trava a digitação (RN12). */
function TextWithCounter({
  label,
  value,
  max,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  max: number;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation('site');
  return (
    <FormField
      label={label}
      hint={t('section.counter', { count: NUMBER.format(value.length), max: NUMBER.format(max) })}
    >
      {({ id, describedBy }) => (
        <Textarea
          id={id}
          aria-describedby={describedBy}
          rows={6}
          maxLength={max}
          {...(placeholder !== undefined && { placeholder })}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </FormField>
  );
}

const text = (content: Record<string, unknown>) =>
  typeof content.text === 'string' ? content.text : '';

/** Contagem regressiva (RN06): só o Switch; sem data, desabilitado com o motivo. */
export function CountdownSection({ weddingId, site, section, audience }: SectionProps) {
  const { t } = useTranslation('site');
  const state = useSiteSection({
    weddingId,
    section,
    fromResponse: () => ({}),
    toBody: () => ({}),
    validate: () => ({}),
  });
  const hasDate = site.eventDate !== null;
  // Sem data: o casal e o vendedor (que muda a data) com o link; a cerimonialista, sem (RN06).
  const reason = audience === 'couple' ? 'couple' : site.editable.eventDate ? 'seller' : 'planner';
  return (
    <div className="kore-site-section">
      <Switch
        checked={state.draft.enabled}
        disabled={!hasDate}
        aria-describedby="kore-site-countdown-help"
        onChange={(event) => state.setEnabled(event.target.checked)}
      >
        {t('section.countdown.switch')}
      </Switch>
      <p id="kore-site-countdown-help" className="kore-site-section__help">
        {hasDate ? (
          t('section.countdown.help')
        ) : (
          <>
            {t(`section.countdown.noDate.${reason}`)}
            {reason !== 'planner' && (
              <>
                {' '}
                <Link
                  to={siteSectionPath({ section: FIRST_SECTION_SLUG })}
                  className="kore-site-section__link"
                >
                  {t('section.countdown.goToBasics')}
                </Link>
              </>
            )}
          </>
        )}
      </p>
    </div>
  );
}

/** Hospedagem e transporte (RN08): título e texto até 5.000. */
export function LodgingSection({ weddingId, section, audience }: SectionProps) {
  const { t } = useTranslation('site');
  const state = useSiteSection({
    weddingId,
    section,
    fromResponse: (content) => ({ text: text(content) }),
    toBody: (content) => ({ text: content.text }),
    validate: () => ({}),
  });
  return (
    <SectionFrame state={state} audience={audience} empty={!state.draft.content.text.trim()}>
      <TextWithCounter
        label={t('section.text')}
        value={state.draft.content.text}
        max={LODGING_MAX}
        placeholder={t('section.lodging.placeholder')}
        onChange={(value) => state.setContent(() => ({ text: value }))}
      />
    </SectionFrame>
  );
}

/** Dress code (RN09): título, texto até 2.000 e a foto de referência opcional. */
export function DressCodeSection({ weddingId, section, audience }: SectionProps) {
  const { t } = useTranslation('site');
  const state = useSiteSection<{ text: string; image: ImageValue }>({
    weddingId,
    section,
    fromResponse: (content) => {
      const image = content.image as ImageValue | undefined;
      return {
        text: text(content),
        image: image ? { id: image.id, url: image.url, thumbUrl: image.thumbUrl } : null,
      };
    },
    toBody: (content) => ({ text: content.text, imageId: content.image?.id ?? null }),
    validate: () => ({}),
  });
  const { content } = state.draft;
  return (
    <SectionFrame state={state} audience={audience} empty={!content.text.trim() && !content.image}>
      <TextWithCounter
        label={t('section.text')}
        value={content.text}
        max={DRESS_MAX}
        onChange={(value) => state.setContent((current) => ({ ...current, text: value }))}
      />
      <ImageField
        weddingId={weddingId}
        audience={audience}
        label={t('section.dressCode.photo')}
        image={content.image}
        alt={t('section.dressCode.photo')}
        onChange={(image) => state.setContent((current) => ({ ...current, image }))}
      />
    </SectionFrame>
  );
}

interface FaqItem {
  key: string;
  question: string;
  answer: string;
}

let faqKey = 0;
const nextKey = () => {
  faqKey += 1;
  return `faq-${faqKey}`;
};

/** FAQ (RN10): até 30 perguntas, cada uma com Pergunta e Resposta obrigatórias. */
export function FaqSection({ weddingId, section, audience }: SectionProps) {
  const { t } = useTranslation('site');
  const state = useSiteSection<FaqItem[]>({
    weddingId,
    section,
    fromResponse: (content) =>
      (Array.isArray(content.items)
        ? (content.items as { question: string; answer: string }[])
        : []
      ).map((item) => ({ key: nextKey(), question: item.question, answer: item.answer })),
    toBody: (items) => ({
      items: items.map((item) => ({ question: item.question.trim(), answer: item.answer.trim() })),
    }),
    validate: (items) => {
      const errors: SectionErrors = {};
      items.forEach((item, index) => {
        if (!item.question.trim()) errors[`content.items.${index}.question`] = 'REQUIRED';
        if (!item.answer.trim()) errors[`content.items.${index}.answer`] = 'REQUIRED';
      });
      return errors;
    },
  });
  const items = state.draft.content;
  const full = items.length >= FAQ_MAX;
  const required = t(`section.errors.required.${audience}`);

  const move = (index: number, by: -1 | 1) =>
    state.setContent((current) => moveItem(current, index, by));

  return (
    <SectionFrame state={state} audience={audience} empty={items.length === 0}>
      <ol className="kore-site-faq">
        {items.map((item, index) => {
          const n = index + 1;
          const fieldError = (field: 'question' | 'answer') =>
            state.errors[`content.items.${index}.${field}`]
              ? { hint: required, hintTone: 'danger' as const }
              : {};
          const set = (field: 'question' | 'answer', value: string) => {
            state.clearError(`content.items.${index}.${field}`);
            state.setContent((current) =>
              current.map((entry) =>
                entry.key === item.key ? { ...entry, [field]: value } : entry,
              ),
            );
          };
          return (
            <li key={item.key} className="kore-site-faq__item">
              <div className="kore-site-faq__head">
                <span className="kore-site-faq__label">{t('section.faq.item', { n })}</span>
                <span className="kore-site-faq__actions">
                  <IconButton
                    icon={<ChevronUp />}
                    label={t('section.faq.up', { n })}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  />
                  <IconButton
                    icon={<ChevronDown />}
                    label={t('section.faq.down', { n })}
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                  />
                  <IconButton
                    icon={<X />}
                    label={t('section.faq.remove', { n })}
                    onClick={() =>
                      state.setContent((current) =>
                        current.filter((entry) => entry.key !== item.key),
                      )
                    }
                  />
                </span>
              </div>
              <FormField label={t('section.faq.question')} {...fieldError('question')}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    maxLength={QUESTION_MAX}
                    value={item.question}
                    onChange={(event) => set('question', event.target.value)}
                  />
                )}
              </FormField>
              <FormField label={t('section.faq.answer')} {...fieldError('answer')}>
                {({ id, describedBy, invalid }) => (
                  <Textarea
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    rows={3}
                    maxLength={ANSWER_MAX}
                    value={item.answer}
                    onChange={(event) => set('answer', event.target.value)}
                  />
                )}
              </FormField>
            </li>
          );
        })}
      </ol>
      <div className="kore-site-faq__add">
        <Button
          variant="secondary"
          disabled={full}
          {...(full && { 'aria-describedby': 'kore-site-faq-limit' })}
          onClick={() =>
            state.setContent((current) => [
              ...current,
              { key: nextKey(), question: '', answer: '' },
            ])
          }
        >
          {t('section.faq.add')}
        </Button>
        {full && (
          <p id="kore-site-faq-limit" className="kore-site-section__help">
            {t(`section.faq.limit.${audience}`)}
          </p>
        )}
      </div>
    </SectionFrame>
  );
}

interface Venue {
  key: string;
  title: string;
  placeName: string;
  date: string;
  time: string;
  address: string;
}

type VenueField = 'title' | 'placeName' | 'date' | 'time' | 'address';

/**
 * Cerimônia & Recepção (RN07): até 4 locais, cada um com Título, Nome do lugar e
 * Endereço obrigatórios, e Data e Hora opcionais, no horário local do casamento. O 1º
 * local novo vem com "Cerimônia", o 2º com "Recepção", e a data é a do casamento.
 */
export function CeremonySection({ weddingId, site, section, audience }: SectionProps) {
  const { t } = useTranslation('site');
  const state = useSiteSection<Venue[]>({
    weddingId,
    section,
    fromResponse: (content) =>
      (Array.isArray(content.venues)
        ? (content.venues as {
            title: string;
            placeName: string;
            date: string | null;
            time: string | null;
            address: string;
          }[])
        : []
      ).map((venue) => ({
        key: nextKey(),
        title: venue.title,
        placeName: venue.placeName,
        date: venue.date ?? '',
        time: venue.time ?? '',
        address: venue.address,
      })),
    toBody: (venues) => ({
      venues: venues.map((venue) => ({
        title: venue.title.trim(),
        placeName: venue.placeName.trim(),
        date: venue.date || null,
        time: venue.time || null,
        address: venue.address.trim(),
      })),
    }),
    validate: (venues) => {
      const errors: SectionErrors = {};
      venues.forEach((venue, index) => {
        for (const field of ['title', 'placeName', 'address'] as const) {
          if (!venue[field].trim()) errors[`content.venues.${index}.${field}`] = 'REQUIRED';
        }
      });
      return errors;
    },
  });
  const venues = state.draft.content;
  const full = venues.length >= VENUES_MAX;
  const required = t(`section.errors.required.${audience}`);

  function add() {
    state.setContent((current) => {
      const title =
        current.length === 0
          ? t('section.ceremony.defaultTitle.first')
          : current.length === 1
            ? t('section.ceremony.defaultTitle.second')
            : '';
      return [
        ...current,
        { key: nextKey(), title, placeName: '', date: site.eventDate ?? '', time: '', address: '' },
      ];
    });
  }

  return (
    <SectionFrame
      state={state}
      audience={audience}
      empty={venues.length === 0}
      notice={<Alert tone="info">{t('section.ceremony.notice')}</Alert>}
    >
      <ol className="kore-site-faq">
        {venues.map((venue, index) => {
          const n = index + 1;
          // O rótulo das ações diz o local; sem título, o número do cartão (RN07).
          const name = venue.title.trim() || t('section.ceremony.item', { n });
          const path = (field: VenueField) => `content.venues.${index}.${field}`;
          const fieldError = (field: VenueField) =>
            state.errors[path(field)] ? { hint: required, hintTone: 'danger' as const } : {};
          const set = (field: VenueField, value: string) => {
            state.clearError(path(field));
            state.setContent((current) =>
              current.map((entry) =>
                entry.key === venue.key ? { ...entry, [field]: value } : entry,
              ),
            );
          };
          const text = (field: 'title' | 'placeName', label: string, max: number) => (
            <FormField label={label} {...fieldError(field)}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  maxLength={max}
                  value={venue[field]}
                  onChange={(event) => set(field, event.target.value)}
                />
              )}
            </FormField>
          );
          return (
            <li key={venue.key} className="kore-site-faq__item">
              <div className="kore-site-faq__head">
                <span className="kore-site-faq__label">{t('section.ceremony.item', { n })}</span>
                <span className="kore-site-faq__actions">
                  <IconButton
                    icon={<ChevronUp />}
                    label={t('section.ceremony.up', { title: name })}
                    disabled={index === 0}
                    onClick={() => state.setContent((current) => moveItem(current, index, -1))}
                  />
                  <IconButton
                    icon={<ChevronDown />}
                    label={t('section.ceremony.down', { title: name })}
                    disabled={index === venues.length - 1}
                    onClick={() => state.setContent((current) => moveItem(current, index, 1))}
                  />
                  <IconButton
                    icon={<X />}
                    label={t('section.ceremony.remove', { title: name })}
                    onClick={() =>
                      state.setContent((current) =>
                        current.filter((entry) => entry.key !== venue.key),
                      )
                    }
                  />
                </span>
              </div>
              {text('title', t('section.ceremony.title'), VENUE_TITLE_MAX)}
              {text('placeName', t('section.ceremony.placeName'), PLACE_NAME_MAX)}
              <div className="kore-site-venue__when">
                <FormField label={t('section.ceremony.date')}>
                  {({ id, describedBy }) => (
                    <DateField
                      id={id}
                      aria-describedby={describedBy}
                      value={venue.date}
                      onChange={(event) => set('date', event.target.value)}
                    />
                  )}
                </FormField>
                <FormField label={t('section.ceremony.time')}>
                  {({ id, describedBy }) => (
                    <Input
                      id={id}
                      type="time"
                      aria-describedby={describedBy}
                      value={venue.time}
                      onChange={(event) => set('time', event.target.value)}
                    />
                  )}
                </FormField>
              </div>
              <FormField
                label={t('section.ceremony.address')}
                {...(state.errors[path('address')]
                  ? { hint: required, hintTone: 'danger' as const }
                  : {
                      hint: t(`section.ceremony.addressHelp.${audience}`),
                      hintTone: 'neutral' as const,
                    })}
              >
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    maxLength={ADDRESS_MAX}
                    value={venue.address}
                    onChange={(event) => set('address', event.target.value)}
                  />
                )}
              </FormField>
            </li>
          );
        })}
      </ol>
      <div className="kore-site-faq__add">
        <Button
          variant="secondary"
          disabled={full}
          {...(full && { 'aria-describedby': 'kore-site-venue-limit' })}
          onClick={add}
        >
          {t('section.ceremony.add')}
        </Button>
        {full && (
          <p id="kore-site-venue-limit" className="kore-site-section__help">
            {t(`section.ceremony.limit.${audience}`)}
          </p>
        )}
      </div>
    </SectionFrame>
  );
}
