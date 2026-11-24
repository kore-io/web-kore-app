import { apiErrorCode } from '../../shared/api/http-client';
import { safeReturnPath } from './login-navigation';

/**
 * Sessão recente (Retenção RN08; decisão 231, B5-6): as ações sensíveis (Excluir o
 * casamento, a chave Pix, as ações de dinheiro do Backoffice) pedem uma sessão autenticada
 * há no máximo 10 minutos. Fora disso, a API responde `403 REAUTH_REQUIRED`, e o app pede o
 * login e volta à mesma tela. O caminho de volta fica no aparelho porque precisa atravessar
 * a ida e a volta do Google, que só levam o `next`.
 */
export const REAUTH_STORAGE_KEY = 'kore.reauthReturn';

export function isReauthRequired({ error }: { error: unknown }): boolean {
  return apiErrorCode({ error }) === 'REAUTH_REQUIRED';
}

/** Guarda a tela de volta da reentrada (já validada como caminho do app). */
export function rememberReauthReturn({ path }: { path: string }): void {
  try {
    window.sessionStorage.setItem(REAUTH_STORAGE_KEY, path);
  } catch {
    // Sem armazenamento, o login segue o caminho de sempre.
  }
}

/**
 * Se este login é a reentrada para a tela `returnPath`, apaga a marca e responde que sim:
 * a volta vale mesmo para quem tem mais de um perfil, que de outro modo iria à Seleção de
 * perfil (RN14), porque a pessoa já estava naquela tela.
 */
export function consumeReauthReturn({ returnPath }: { returnPath: string | undefined }): boolean {
  try {
    const stored = window.sessionStorage.getItem(REAUTH_STORAGE_KEY);
    if (stored === null) return false;
    window.sessionStorage.removeItem(REAUTH_STORAGE_KEY);
    return returnPath !== undefined && safeReturnPath({ path: stored }) === returnPath;
  } catch {
    return false;
  }
}
