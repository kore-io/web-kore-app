import { encodeDraft, type SimulatorDraft } from '../../shared/simulator/draft';

/** O endereço do app (Simule RN08); no local, a 5173. */
export const APP_URL = import.meta.env.VITE_APP_URL ?? 'http://localhost:5173';

/**
 * Os botões do Pronto levam o rascunho, sem a foto, no fragmento da URL, que não vai a
 * servidor nem ao Referer (Simule RN08): Criar com e-mail, Continuar com Google e Já têm
 * conta? Entrar.
 */
export function handoffLinks(draft: SimulatorDraft): {
  email: string;
  google: string;
  signIn: string;
} {
  const encoded = encodeDraft(draft);
  const fragment = encoded ? `#simule=${encoded}` : '';
  return {
    email: `${APP_URL}/cadastro${fragment}`,
    google: `${APP_URL}/cadastro?google=1${fragment}`,
    signIn: `${APP_URL}/entrar?next=couple_signup${fragment}`,
  };
}

/** O simulador só existe com a variável ligada (Simule RN01): fora do local, desligado. */
export const SIMULATOR_ENABLED = import.meta.env.VITE_SIMULATOR_ENABLED === 'true';
