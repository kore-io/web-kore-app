import { describe, expect, it } from 'vitest';
import { isValidSlug, suggestSlug } from './wedding-slug';

describe('endereço do site (RN04)', () => {
  it('sugere {nome1}-e-{nome2} com os primeiros nomes, sem acento e em minúsculas', () => {
    expect(suggestSlug({ myName: 'Ana Beatriz Moreira', partnerName: 'Marcos Vinícius' })).toBe(
      'ana-e-marcos',
    );
    expect(suggestSlug({ myName: 'Lúcia', partnerName: "João D'Ávila" })).toBe('lucia-e-joao');
    expect(suggestSlug({ myName: 'Ana', partnerName: '' })).toBe('');
  });

  it('corta em 40 caracteres sem deixar hífen no fim', () => {
    const slug = suggestSlug({ myName: 'a'.repeat(30), partnerName: 'b'.repeat(30) });
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith('-')).toBe(false);
  });

  it.each([
    ['ana-e-marcos', true],
    ['ab', false],
    ['a'.repeat(41), false],
    ['-ana', false],
    ['ana-', false],
    ['ana--marcos', false],
    ['Ana', false],
    ['ana_marcos', false],
    ['casal2026', true],
  ])('%s → %s', (slug, valid) => {
    expect(isValidSlug({ slug })).toBe(valid);
  });
});
