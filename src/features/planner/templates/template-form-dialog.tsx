import { Alert, Button, Dialog, Input, Select, Textarea, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlannerTemplateResponse } from '../../../shared/api/generated/model';
import {
  getPlannerTemplatesControllerListV1QueryKey,
  usePlannerTemplatesControllerCreateV1,
  usePlannerTemplatesControllerUpdateV1,
} from '../../../shared/api/generated/planner/planner';
import { ApiError, apiErrorCode } from '../../../shared/api/http-client';
import { FormField } from '../../../shared/components/form-field';
import { DEFAULT_APPEARANCE } from '../new-wedding/use-new-wedding';
import { AppearanceFields, useAppearanceDraft } from '../../site/components/appearance-fields';
import type { ContrastBlock } from '../../site/appearance';
import {
  ANSWER_MAX,
  appearanceOf,
  FAQ_MAX_QUESTIONS,
  faqBody,
  hasFaqErrors,
  KIND_BY_TAB,
  NAME_MAX,
  nameError,
  QUESTION_MAX,
  questionsOf,
  TEXT_MAX,
  TEXT_SECTIONS,
  textBody,
  textOf,
  validateFaq,
  validateText,
  type FaqQuestion,
  type TemplateError,
  type TemplateTab,
  type TextSection,
} from './templates-model';

const NUMBER = new Intl.NumberFormat('pt-BR');
const EMPTY_QUESTION: FaqQuestion = { question: '', answer: '' };

/** O objeto sem uma chave (o erro que some quando o campo muda). */
function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key)) as Omit<T, K>;
}

type SaveResult = { ok: true } | { ok: false; block?: ContrastBlock };

/**
 * O Criar e o Editar de um modelo (Modelos RN03, RN04, RN06; Voz, Modelos do cerimonialista):
 * o Nome do modelo e, por tipo, a Seção e o Texto, as perguntas do FAQ ou os campos da
 * Aparência do Editor. Textos e FAQ mostram o aviso de não guardar dado de cliente (A10).
 */
export function TemplateFormDialog({
  tab,
  template,
  onClose,
}: {
  tab: TemplateTab;
  /** Nulo no Criar. */
  template: PlannerTemplateResponse | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('planner');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const create = usePlannerTemplatesControllerCreateV1();
  const update = usePlannerTemplatesControllerUpdateV1();
  const [saveError, setSaveError] = useState(false);
  const pending = create.isPending || update.isPending;
  const editing = template !== null;

  /** Grava o modelo (POST no Criar, PATCH no Editar) e fecha com o Toast da Voz. */
  async function save(body: {
    name: string;
    content: object;
    sectionType?: TextSection;
  }): Promise<SaveResult> {
    setSaveError(false);
    try {
      if (template) {
        await update.mutateAsync({
          id: template.id,
          data: { name: body.name, content: body.content as Record<string, unknown> },
        });
      } else {
        await create.mutateAsync({
          data: {
            kind: KIND_BY_TAB[tab],
            name: body.name,
            content: body.content as Record<string, unknown>,
            ...(body.sectionType && { sectionType: body.sectionType }),
          },
        });
      }
    } catch (error) {
      if (apiErrorCode({ error }) === 'CONTRAST_TOO_LOW') {
        const check = error instanceof ApiError ? (error.body as { check?: unknown }).check : null;
        return {
          ok: false,
          block: (typeof check === 'string' ? check : 'primary_foreground') as ContrastBlock,
        };
      }
      // O teto técnico (409 TEMPLATES_LIMIT) não aparece na tela (RN04): cai no aviso geral.
      setSaveError(true);
      return { ok: false };
    }
    void queryClient.invalidateQueries({ queryKey: getPlannerTemplatesControllerListV1QueryKey() });
    showToast({
      tone: 'success',
      message: t(editing ? 'templates.toast.saved' : 'templates.toast.created'),
    });
    onClose();
    return { ok: true };
  }

  const title = editing ? t('templates.form.titleEdit') : t(`templates.form.titleNew.${tab}`);
  const formId = 'kore-template-form';
  const props = { template, formId, save };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      role="dialog"
      size="lg"
      stackActions
      className="kore-template-dialog"
      title={title}
      actions={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('templates.form.cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={pending} aria-busy={pending || undefined}>
            {editing ? t('templates.form.save') : t('templates.form.create')}
          </Button>
        </>
      }
    >
      {saveError && (
        <Alert tone="danger" role="alert">
          {t('templates.errors.save')}
        </Alert>
      )}
      {tab === 'texts' && <TextForm {...props} />}
      {tab === 'faq' && <FaqForm {...props} />}
      {tab === 'appearance' && <AppearanceForm {...props} />}
    </Dialog>
  );
}

interface FormProps {
  template: PlannerTemplateResponse | null;
  formId: string;
  save: (body: { name: string; content: object; sectionType?: TextSection }) => Promise<SaveResult>;
}

function useErrorText() {
  const { t } = useTranslation('planner');
  return (error: TemplateError | undefined, max?: number) =>
    error
      ? {
          hint: t(`templates.errors.${error}`, { max: NUMBER.format(max ?? 0) }),
          hintTone: 'danger' as const,
        }
      : {};
}

function NameField({
  value,
  onChange,
  error,
  tab,
}: {
  value: string;
  onChange: (value: string) => void;
  error: TemplateError | undefined;
  tab: TemplateTab;
}) {
  const { t } = useTranslation('planner');
  const errorText = useErrorText();
  return (
    <FormField label={t('templates.form.name')} {...errorText(error)}>
      {({ id, describedBy, invalid }) => (
        <Input
          id={id}
          value={value}
          maxLength={NAME_MAX + 40}
          placeholder={t(`templates.form.namePlaceholder.${tab}`)}
          invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
          {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
        />
      )}
    </FormField>
  );
}

/** O aviso A10, só nos Textos e no FAQ (RN03). */
function ClientDataNotice() {
  const { t } = useTranslation('planner');
  return <Alert tone="info">{t('templates.form.notice')}</Alert>;
}

/** Textos: Nome, Seção (só no Criar) e Texto com o contador e a ajuda dos marcadores. */
function TextForm({ template, formId, save }: FormProps) {
  const { t } = useTranslation('planner');
  const errorText = useErrorText();
  const [name, setName] = useState(template?.name ?? '');
  const [sectionType, setSectionType] = useState<TextSection>(
    (template?.sectionType as TextSection | null) ?? 'story',
  );
  const [text, setText] = useState(template ? textOf(template) : '');
  const [errors, setErrors] = useState<ReturnType<typeof validateText>>({});
  const max = TEXT_MAX[sectionType];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft = { name, sectionType, text };
    const found = validateText(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    void save({ ...textBody(draft), ...(!template && { sectionType }) });
  }

  return (
    <form id={formId} className="kore-template-form" noValidate onSubmit={submit}>
      <ClientDataNotice />
      <NameField
        value={name}
        tab="texts"
        error={errors.name}
        onChange={(value) => {
          setName(value);
          setErrors((current) => without(current, 'name'));
        }}
      />
      <FormField label={t('templates.form.section')}>
        {({ id }) => (
          <Select
            id={id}
            value={sectionType}
            // A seção é a do modelo: no Editar, ela não muda (o PATCH não a recebe).
            disabled={template !== null}
            onChange={(event) => {
              setSectionType(event.target.value as TextSection);
              setErrors((current) => without(current, 'text'));
            }}
          >
            {TEXT_SECTIONS.map((section) => (
              <option key={section} value={section}>
                {t(`templates.sections.${section}`)}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField
        label={t('templates.form.text')}
        {...(errors.text ? errorText(errors.text, max) : { hint: t('templates.form.textHelp') })}
      >
        {({ id, describedBy, invalid }) => (
          <>
            <Textarea
              id={id}
              rows={8}
              value={text}
              maxLength={max}
              invalid={invalid}
              onChange={(event) => {
                setText(event.target.value);
                setErrors((current) => without(current, 'text'));
              }}
              {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
            />
            {/* Acima do limite, em cor de perigo, como no Editor (RN08; decisão 302(6)). */}
            <span
              className={
                text.length > max
                  ? 'kore-template-form__counter kore-template-form__counter--over'
                  : 'kore-template-form__counter'
              }
              aria-hidden="true"
            >
              {t('templates.form.counter', {
                count: NUMBER.format(text.length),
                max: NUMBER.format(max),
              })}
            </span>
          </>
        )}
      </FormField>
    </form>
  );
}

/** FAQ: Nome e as perguntas (Pergunta · Resposta · Remover), de 1 a 30. */
function FaqForm({ template, formId, save }: FormProps) {
  const { t } = useTranslation('planner');
  const errorText = useErrorText();
  const [name, setName] = useState(template?.name ?? '');
  const [questions, setQuestions] = useState<FaqQuestion[]>(() => {
    const current = template ? questionsOf(template) : [];
    return current.length > 0 ? current : [EMPTY_QUESTION];
  });
  const [errors, setErrors] = useState<ReturnType<typeof validateFaq>>({ items: [] });
  const full = questions.length >= FAQ_MAX_QUESTIONS;

  function change(index: number, patch: Partial<FaqQuestion>) {
    setQuestions((current) =>
      current.map((item, position) => (position === index ? { ...item, ...patch } : item)),
    );
    setErrors((current) => ({
      ...without(current, 'list'),
      items: current.items.map((item, position) => (position === index ? {} : item)),
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft = { name, questions };
    const found = validateFaq(draft);
    setErrors(found);
    if (hasFaqErrors(found)) return;
    void save(faqBody(draft));
  }

  return (
    <form id={formId} className="kore-template-form" noValidate onSubmit={submit}>
      <ClientDataNotice />
      <NameField
        value={name}
        tab="faq"
        error={errors.name}
        onChange={(value) => {
          setName(value);
          setErrors((current) => without(current, 'name'));
        }}
      />
      {errors.list && (
        <Alert tone="danger" role="alert">
          {t(`templates.errors.${errors.list}`)}
        </Alert>
      )}
      <ol className="kore-template-form__questions">
        {questions.map((item, index) => {
          const itemErrors = errors.items[index] ?? {};
          return (
            <li key={index} className="kore-template-form__question">
              <fieldset className="kore-template-form__fieldset">
                <legend className="kore-template-form__legend">
                  {t('templates.form.item', { n: index + 1 })}
                </legend>
                <FormField label={t('templates.form.question')} {...errorText(itemErrors.question)}>
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      aria-label={t('templates.form.questionN', { n: index + 1 })}
                      value={item.question}
                      maxLength={QUESTION_MAX}
                      invalid={invalid}
                      onChange={(event) => change(index, { question: event.target.value })}
                      {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
                    />
                  )}
                </FormField>
                <FormField label={t('templates.form.answer')} {...errorText(itemErrors.answer)}>
                  {({ id, describedBy, invalid }) => (
                    <Textarea
                      id={id}
                      rows={3}
                      aria-label={t('templates.form.answerN', { n: index + 1 })}
                      value={item.answer}
                      maxLength={ANSWER_MAX}
                      invalid={invalid}
                      onChange={(event) => change(index, { answer: event.target.value })}
                      {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
                    />
                  )}
                </FormField>
                {questions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="kore-template-form__remove"
                    aria-label={t('templates.form.removeQuestion', { n: index + 1 })}
                    onClick={() => {
                      setQuestions((current) =>
                        current.filter((_, position) => position !== index),
                      );
                      setErrors(({ items, ...rest }) => ({
                        ...rest,
                        items: items.filter((_, position) => position !== index),
                      }));
                    }}
                  >
                    {t('templates.form.remove')}
                  </Button>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>
      <div className="kore-template-form__add">
        <Button
          type="button"
          variant="secondary"
          disabled={full}
          aria-describedby={full ? 'kore-template-faq-limit' : undefined}
          onClick={() => setQuestions((current) => [...current, EMPTY_QUESTION])}
        >
          {t('templates.form.addQuestion')}
        </Button>
        {full && (
          <p id="kore-template-faq-limit" className="kore-template-form__limit">
            {t('templates.form.faqLimit')}
          </p>
        )}
      </div>
    </form>
  );
}

/** Aparência: Nome e os campos da Aparência do Editor, com o contraste (RN04). */
function AppearanceForm({ template, formId, save }: FormProps) {
  const [name, setName] = useState(template?.name ?? '');
  const [error, setError] = useState<TemplateError | undefined>();
  const appearance = useAppearanceDraft({
    initial: template
      ? (() => {
          const content = appearanceOf(template);
          return {
            fontPairKey: content.fontPairKey,
            starterPaletteKey: content.starterPaletteKey ?? null,
            primaryColor: content.primaryColor,
            accentColor: content.accentColor,
            backgroundMode: content.backgroundMode,
          };
        })()
      : DEFAULT_APPEARANCE,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = nameError(name) ?? undefined;
    setError(found);
    if (found || !appearance.canSave) return;
    void save({ name: name.trim(), content: appearance.body }).then((result) => {
      if (!result.ok && result.block) appearance.setServerBlock(result.block);
    });
  }

  return (
    <form id={formId} className="kore-template-form" noValidate onSubmit={submit}>
      <NameField
        value={name}
        tab="appearance"
        error={error}
        onChange={(value) => {
          setName(value);
          setError(undefined);
        }}
      />
      <AppearanceFields state={appearance} sampleNames="Ana & Marcos" audience="planner" />
    </form>
  );
}
