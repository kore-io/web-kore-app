import {
  APP_DRAFT_KEY,
  clearDraft,
  decodeDraft,
  isExpired,
  loadDraft,
  saveDraft,
  type SimulatorDraft,
} from '../../shared/simulator/draft';

const FRAGMENT_PREFIX = '#simule=';

/**
 * A cópia em memória do rascunho do fragmento (caso de borda do Simule): num navegador que
 * bloqueia o `localStorage`, o rascunho fica na página até o fim do cadastro pelo e-mail. O
 * Google recarrega a página e o perde, como a spec aceita.
 */
let memoryDraft: SimulatorDraft | null = null;

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
    memoryDraft = draft;
  }
  window.history.replaceState(window.history.state, '', `${pathname}${search}`);
  return true;
}

/** O rascunho guardado no app, se ainda vale (7 dias desde a última mudança no Simule). */
export function storedSimulatorDraft({
  now = new Date(),
}: { now?: Date } = {}): SimulatorDraft | null {
  const stored = loadDraft({ key: APP_DRAFT_KEY, now });
  if (stored) return stored;
  if (memoryDraft && isExpired({ draft: memoryDraft, now })) memoryDraft = null;
  return memoryDraft;
}

/** Depois do 201 do cadastro, o rascunho vira o casamento e sai do aparelho (RN10). */
export function clearSimulatorDraft(): void {
  clearDraft({ key: APP_DRAFT_KEY });
  memoryDraft = null;
}
