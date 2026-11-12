import { INVITE_TOKEN_STORAGE_KEY } from './login-navigation';

/**
 * O aceite que começou antes do login (decisão 142): a pessoa tocou em Aceitar sem sessão,
 * entrou, e o convite continua de onde parou. Fica na aba (sessionStorage), com o token.
 */
const ACCEPTING_STORAGE_KEY = 'kore.inviteAccepting';

export function saveInviteToken({ token }: { token: string }) {
  try {
    window.localStorage.setItem(INVITE_TOKEN_STORAGE_KEY, token);
  } catch {
    // Sem localStorage: o login cai na Seleção de perfil, e o link do e-mail segue valendo.
  }
}

export function clearInviteToken() {
  try {
    window.localStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(ACCEPTING_STORAGE_KEY);
  } catch {
    // Nada a limpar.
  }
}

export function markAccepting({ token }: { token: string }) {
  try {
    window.sessionStorage.setItem(ACCEPTING_STORAGE_KEY, token);
  } catch {
    // Sem sessionStorage: depois do login, a pessoa toca em Aceitar de novo.
  }
}

export function isAccepting({ token }: { token: string }) {
  try {
    return window.sessionStorage.getItem(ACCEPTING_STORAGE_KEY) === token;
  } catch {
    return false;
  }
}

export function clearAccepting() {
  try {
    window.sessionStorage.removeItem(ACCEPTING_STORAGE_KEY);
  } catch {
    // Nada a limpar.
  }
}
