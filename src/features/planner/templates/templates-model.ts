import type { PlannerTemplateResponse } from '../../../shared/api/generated/model';
import type { AppearanceDraft } from '../../site/components/appearance-fields';

/** As abas da página Modelos e o `kind` de cada uma (Modelos RN01, RN06). */
export const TEMPLATE_TABS = ['texts', 'faq', 'appearance'] as const;
export type TemplateTab = (typeof TEMPLATE_TABS)[number];

export const KIND_BY_TAB = {
  texts: 'section_content',
  faq: 'faq',
  appearance: 'appearance',
} as const satisfies Record<TemplateTab, PlannerTemplateResponse['kind']>;

/** As seções que aceitam modelo de Textos, na ordem da Voz (RN01). */
export const TEXT_SECTIONS = ['story', 'lodging', 'dress_code'] as const;
export type TextSection = (typeof TEXT_SECTIONS)[number];

/** Os limites das seções da F2 (RN04; Seções do site). */
export const NAME_MAX = 80;
export const TEXT_MAX: Record<TextSection, number> = {
  story: 5000,
  lodging: 5000,
  dress_code: 2000,
};
export const FAQ_MAX_QUESTIONS = 30;
export const QUESTION_MAX = 200;
export const ANSWER_MAX = 1000;

export interface FaqQuestion {
  question: string;
  answer: string;
}

/** O `content` de cada tipo, como a API grava (Contrato de API). */
export interface TextContent {
  text: string;
}
export interface FaqContent {
  questions: FaqQuestion[];
}
export interface AppearanceContent {
  fontPairKey: string;
  starterPaletteKey?: string | null;
  primaryColor: string;
  accentColor: string;
  backgroundMode: string;
}

/** Lê o `content` livre (additionalProperties) de cada tipo, sem confiar no formato. */
export function textOf(template: PlannerTemplateResponse): string {
  const { text } = template.content as Partial<TextContent>;
  return typeof text === 'string' ? text : '';
}

export function questionsOf(template: PlannerTemplateResponse): FaqQuestion[] {
  const { questions } = template.content as Partial<FaqContent>;
  if (!Array.isArray(questions)) return [];
  return questions.map((item: Partial<FaqQuestion>) => ({
    question: typeof item.question === 'string' ? item.question : '',
    answer: typeof item.answer === 'string' ? item.answer : '',
  }));
}

export function appearanceOf(template: PlannerTemplateResponse): AppearanceContent {
  const content = template.content as Partial<AppearanceContent>;
  return {
    fontPairKey: String(content.fontPairKey ?? ''),
    starterPaletteKey: content.starterPaletteKey ?? null,
    primaryColor: String(content.primaryColor ?? ''),
    accentColor: String(content.accentColor ?? ''),
    backgroundMode: String(content.backgroundMode ?? ''),
  };
}

/** A limpeza da RN04 de Seções do site: \r\n → \n, sem caracteres de controle, com trim. */
export function cleanText(value: string): string {
  return (
    value
      .replace(/\r\n?/g, '\n')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim()
  );
}

export type TemplateError =
  | 'nameMissing'
  | 'nameTooLong'
  | 'textMissing'
  | 'textTooLong'
  | 'faqMissing'
  | 'questionMissing'
  | 'answerMissing';

export interface TextDraft {
  name: string;
  sectionType: TextSection;
  text: string;
}
export interface FaqDraft {
  name: string;
  questions: FaqQuestion[];
}
export interface AppearanceTemplateDraft {
  name: string;
}

/** Erros de nome comuns aos três tipos (RN04). */
export function nameError(name: string): TemplateError | null {
  const value = name.trim();
  if (!value) return 'nameMissing';
  if (value.length > NAME_MAX) return 'nameTooLong';
  return null;
}

/** Os erros do modelo de Textos, por campo (RN04). */
export function validateText(draft: TextDraft): Partial<Record<'name' | 'text', TemplateError>> {
  const errors: Partial<Record<'name' | 'text', TemplateError>> = {};
  const name = nameError(draft.name);
  if (name) errors.name = name;
  const text = cleanText(draft.text);
  if (!text) errors.text = 'textMissing';
  // O maxLength não corta o que já está no campo ao trocar a Seção (ex.: para o Dress code).
  else if (text.length > TEXT_MAX[draft.sectionType]) errors.text = 'textTooLong';
  return errors;
}

/**
 * Os erros do FAQ (RN04): o nome, "Adicione pelo menos uma pergunta com resposta." quando
 * não há nenhuma completa, e a pergunta ou a resposta que falta em cada linha começada.
 */
export function validateFaq(draft: FaqDraft): {
  name?: TemplateError;
  list?: TemplateError;
  items: Partial<Record<'question' | 'answer', TemplateError>>[];
} {
  const name = nameError(draft.name);
  const items = draft.questions.map((item) => {
    const question = item.question.trim();
    const answer = item.answer.trim();
    const found: Partial<Record<'question' | 'answer', TemplateError>> = {};
    if (!question && answer) found.question = 'questionMissing';
    if (question && !answer) found.answer = 'answerMissing';
    return found;
  });
  const complete = draft.questions.some((item) => item.question.trim() && item.answer.trim());
  return {
    ...(name && { name }),
    ...(!complete && { list: 'faqMissing' as const }),
    items,
  };
}

export function hasFaqErrors(errors: ReturnType<typeof validateFaq>): boolean {
  return (
    errors.name !== undefined ||
    errors.list !== undefined ||
    errors.items.some((item) => Object.keys(item).length > 0)
  );
}

/** O corpo do POST e do PATCH, por tipo; as linhas vazias do FAQ ficam de fora. */
export function textBody(draft: TextDraft) {
  return {
    name: draft.name.trim(),
    content: { text: cleanText(draft.text) },
  };
}

export function faqBody(draft: FaqDraft) {
  return {
    name: draft.name.trim(),
    content: {
      questions: draft.questions
        .map((item) => ({ question: cleanText(item.question), answer: cleanText(item.answer) }))
        .filter((item) => item.question && item.answer),
    },
  };
}

export function appearanceBody({ name, body }: { name: string; body: AppearanceDraft | object }) {
  return { name: name.trim(), content: body };
}
