import type { SiteSectionResponse } from '../../shared/api/generated/model';

export type SectionKey =
  'basics' | 'appearance' | 'story' | 'countdown' | 'ceremony' | 'lodging' | 'dress_code' | 'faq';

/** As seções do Editor na ordem da F2 (Dados básicos RN01) e o caminho de cada uma (214). */
export const EDITOR_SECTIONS: readonly { key: SectionKey; slug: string }[] = [
  { key: 'basics', slug: 'dados-basicos' },
  { key: 'appearance', slug: 'aparencia' },
  { key: 'story', slug: 'nossa-historia' },
  { key: 'countdown', slug: 'contagem-regressiva' },
  { key: 'ceremony', slug: 'cerimonia-e-recepcao' },
  { key: 'lodging', slug: 'hospedagem-e-transporte' },
  { key: 'dress_code', slug: 'dress-code' },
  { key: 'faq', slug: 'faq' },
];

export const FIRST_SECTION_SLUG = 'dados-basicos';

export function sectionBySlug(slug: string | undefined) {
  return EDITOR_SECTIONS.find((section) => section.slug === slug);
}

export type SectionState = 'on' | 'off' | 'empty';

/**
 * O estado na lista (Penpot 1.1): Dados básicos e Aparência estão sempre "ligada"; as
 * outras, "desligada" com o Switch desligado e "vazia" ligadas sem conteúdo (Seções RN03).
 */
export function sectionState({
  key,
  sections,
}: {
  key: SectionKey;
  sections: readonly SiteSectionResponse[];
}): SectionState {
  const section = sections.find((item) => item.type === key);
  if (!section) return 'on';
  if (!section.enabled) return 'off';
  return section.empty ? 'empty' : 'on';
}
