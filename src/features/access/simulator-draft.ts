import {
  APP_DRAFT_KEY,
  clearDraft,
  decodeDraft,
  loadDraft,
  saveDraft,
  type SimulatorDraft,
} from '../../shared/simulator/draft';

const FRAGMENT_PREFIX = '#simule=';

/**
 * O rascunho do Simule que chega no fragmento (Simule RN08): validado inteiro (um rascunho
 * inválido é ignorado, sem aviso), guardado em `kore.simulatorDraft` com o mesmo prazo de
 * 7 dias e tirado da URL na hora. Devolve se havia o fragmento.
 */
export function captureSimulatorDraft({ now = new Date() }: { now?: Date } = {}): boolean {
  const { hash, pathname, search } = window.location;
  if (!hash.startsWith(FRAGMENT_PREFIX)) return false;
  const draft = decodeDraft(hash.slice(FRAGMENT_PREFIX.length));
  if (draft && now.getTime() - Date.parse(draft.savedAt) <= 7 * 24 * 60 * 60 * 1000) {
    saveDraft({ key: APP_DRAFT_KEY, draft });
  }
  window.history.replaceState(window.history.state, '', `${pathname}${search}`);
  return true;
}

/** O rascunho guardado no app, se ainda vale (7 dias desde a última mudança no Simule). */
export function storedSimulatorDraft({
  now = new Date(),
}: { now?: Date } = {}): SimulatorDraft | null {
  return loadDraft({ key: APP_DRAFT_KEY, now });
}

/** Depois do 201 do cadastro, o rascunho vira o casamento e sai do aparelho (RN10). */
export function clearSimulatorDraft(): void {
  clearDraft({ key: APP_DRAFT_KEY });
}
