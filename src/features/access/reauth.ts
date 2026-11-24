import { apiErrorCode } from '../../shared/api/http-client';
import type { ProfileKind } from './api/me-active-profile';
import { safeReturnPath } from './login-navigation';

/**
 * Sessão recente (Retenção RN08; decisão 231, B5-6): as ações sensíveis (Excluir o
 * casamento, a chave Pix, as ações de dinheiro do Backoffice) pedem uma sessão autenticada
 * há no máximo 10 minutos. Fora disso, a API responde `403 REAUTH_REQUIRED`, e o app pede o
 * login e volta à mesma tela. A marca fica no aparelho porque precisa atravessar a ida e a
 * volta do Google, que só levam o `next`. Ela guarda também o perfil ativo: a sessão nova
 * nasce sem perfil, e as áreas mandariam à Seleção de perfil.
 */
export const REAUTH_STORAGE_KEY = 'kore.reauthReturn';

/** A tela de volta e o perfil que estava ativo (nulo: sem perfil, ex.: o staff). */
export interface ReauthReturn {
  path: string;
  profile: ProfileKind | null;
}

export function isReauthRequired({ error }: { error: unknown }): boolean {
  return apiErrorCode({ error }) === 'REAUTH_REQUIRED';
}

export function rememberReauthReturn({ path, profile }: ReauthReturn): void {
  try {
    window.sessionStorage.setItem(REAUTH_STORAGE_KEY, JSON.stringify({ path, profile }));
  } catch {
    // Sem armazenamento, o login segue o caminho de sempre.
  }
}

function isProfile(value: unknown): value is ProfileKind | null {
  return value === null || value === 'couple' || value === 'planner' || value === 'seller';
}

/**
 * Se este login é a reentrada para a tela `returnPath`, apaga a marca e devolve a volta:
 * vale uma vez, só para o mesmo caminho e só para um caminho do próprio app.
 */
export function consumeReauthReturn({
  returnPath,
}: {
  returnPath: string | undefined;
}): ReauthReturn | undefined {
  try {
    const stored = window.sessionStorage.getItem(REAUTH_STORAGE_KEY);
    if (stored === null) return undefined;
    window.sessionStorage.removeItem(REAUTH_STORAGE_KEY);
    const parsed = JSON.parse(stored) as Partial<ReauthReturn>;
    if (returnPath === undefined || safeReturnPath({ path: parsed.path }) !== returnPath) {
      return undefined;
    }
    return isProfile(parsed.profile) ? { path: returnPath, profile: parsed.profile } : undefined;
  } catch {
    return undefined;
  }
}
