import { describe, expect, it } from 'vitest';
import type { PlannerTemplateResponse } from '../../../shared/api/generated/model';
import { createdText } from './templates-list';
import {
  cleanText,
  faqBody,
  hasFaqErrors,
  questionsOf,
  textBody,
  textOf,
  validateFaq,
  validateText,
} from './templates-model';

const template = (content: Record<string, unknown>): PlannerTemplateResponse => ({
  id: 't1',
  kind: 'faq',
  sectionType: null,
  locale: 'pt-BR',
  name: 'FAQ',
  content,
  createdAt: '2026-11-18T12:00:00Z',
  updatedAt: '2026-11-18T12:00:00Z',
});

describe('Modelos › o conteúdo e a validação (RN01, RN04)', () => {
  it('lê o conteúdo sem confiar no formato', () => {
    expect(textOf(template({ text: 'Oi' }))).toBe('Oi');
    expect(textOf(template({}))).toBe('');
    expect(questionsOf(template({ questions: [{ question: 'P', answer: 'R' }, {}] }))).toEqual([
      { question: 'P', answer: 'R' },
      { question: '', answer: '' },
    ]);
    expect(questionsOf(template({ questions: 'x' }))).toEqual([]);
  });

  it('limpa o texto como as seções: \\r\\n, controles e espaços nas pontas', () => {
    expect(cleanText('  Linha 1\r\nLinha 2\u0007 ')).toBe('Linha 1\nLinha 2');
  });

  it('Textos: o nome e o texto obrigatórios, o nome até 80 caracteres', () => {
    expect(validateText({ name: ' ', sectionType: 'story', text: '\n' })).toEqual({
      name: 'nameMissing',
      text: 'textMissing',
    });
    expect(validateText({ name: 'a'.repeat(81), sectionType: 'story', text: 'x' })).toEqual({
      name: 'nameTooLong',
    });
    expect(textBody({ name: ' Tom acolhedor ', sectionType: 'story', text: ' {casal} ' })).toEqual({
      name: 'Tom acolhedor',
      content: { text: '{casal}' },
    });
  });

  it('FAQ: pelo menos uma pergunta com resposta, e cada linha começada completa', () => {
    const empty = validateFaq({ name: 'FAQ', questions: [{ question: '', answer: '' }] });
    expect(empty.list).toBe('faqMissing');
    expect(hasFaqErrors(empty)).toBe(true);
    const half = validateFaq({
      name: 'FAQ',
      questions: [
        { question: 'Pode levar criança?', answer: 'Pode.' },
        { question: 'Tem estacionamento?', answer: ' ' },
      ],
    });
    expect(half.list).toBeUndefined();
    expect(half.items).toEqual([{}, { answer: 'answerMissing' }]);
    const ok = {
      name: 'FAQ',
      questions: [
        { question: ' P ', answer: 'R' },
        { question: '', answer: '' },
      ],
    };
    expect(hasFaqErrors(validateFaq(ok))).toBe(false);
    expect(faqBody(ok)).toEqual({
      name: 'FAQ',
      content: { questions: [{ question: 'P', answer: 'R' }] },
    });
  });

  it('a data de criação sem o ano corrente, e com o ano fora dele (Voz)', () => {
    const now = new Date('2026-11-18T12:00:00');
    expect(createdText({ at: '2026-06-12T15:00:00Z', now })).toBe('12/06');
    expect(createdText({ at: '2025-08-21T15:00:00Z', now })).toBe('21/08/2025');
  });
});
