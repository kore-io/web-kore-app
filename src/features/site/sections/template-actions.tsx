import { createContext, useContext, type ComponentType, type ReactNode } from 'react';
import type { SiteEditorResponse } from '../../../shared/api/generated/model';
import type { AppearanceDraft } from '../components/appearance-fields';

/** As seções de texto que aceitam modelo (Modelos RN01). */
export type TemplateTextSection = 'story' | 'lodging' | 'dress_code';

/**
 * As ações de modelo que o Editor mostra nas seções (Modelos RN08). O Editor não conhece
 * quem as oferece: quem monta a rota passa as da cerimonialista, e cada ação decide se
 * aparece (só para quem colabora e tem o perfil de cerimonialista). Sem provedor, nenhuma.
 */
export interface SectionTemplateActions {
  Text: ComponentType<{
    site: SiteEditorResponse;
    sectionType: TemplateTextSection;
    onText: (text: string) => void;
  }>;
  Faq: ComponentType<{ onQuestions: (questions: { question: string; answer: string }[]) => void }>;
  Appearance: ComponentType<{ onAppearance: (draft: AppearanceDraft) => void }>;
}

const Context = createContext<SectionTemplateActions | null>(null);

export function SectionTemplateActionsProvider({
  actions,
  children,
}: {
  actions: SectionTemplateActions;
  children: ReactNode;
}) {
  return <Context.Provider value={actions}>{children}</Context.Provider>;
}

export function useSectionTemplateActions(): SectionTemplateActions | null {
  return useContext(Context);
}
