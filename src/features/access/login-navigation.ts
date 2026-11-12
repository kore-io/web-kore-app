import { externalUrls, paths } from '../../app/paths';
import type { VerifyLoginChallengeResponseNext } from '../../shared/api/generated/model';

/** Onde guardamos o token do convite ao abrir /convite/{token} (decisão 142). */
export const INVITE_TOKEN_STORAGE_KEY = 'kore.inviteToken';

/** Destino depois do login: dentro do app (rota) ou fora (endereço completo). */
export type LoginDestination = { kind: 'route'; path: string } | { kind: 'external'; url: string };

/** Mesmo limite da API (domain/return-path do api-kore-api). */
const MAX_RETURN_PATH_LENGTH = 512;

/**
 * Caminho de volta aceito (RN10, decisão 136(7)), espelhando a regra da API: só caminho
 * relativo do próprio app, começando com uma barra, sem `//`, sem barra invertida, sem
 * caractere de controle, até 512 caracteres e que continue na mesma origem.
 */
export function safeReturnPath({ path }: { path: string | null | undefined }) {
  if (!path || path.length > MAX_RETURN_PATH_LENGTH) return undefined;
  if (!path.startsWith('/') || path.startsWith('//')) return undefined;
  if (path.includes('\\') || [...path].some((character) => character.charCodeAt(0) < 0x20)) {
    return undefined;
  }
  // Resolvida contra uma base qualquer, a URL tem de continuar na mesma origem.
  const resolved = new URL(path, 'https://app.invalid');
  return resolved.origin === 'https://app.invalid' ? path : undefined;
}

function storedInviteToken() {
  try {
    return window.localStorage.getItem(INVITE_TOKEN_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Para onde ir depois de confirmar o e-mail (RN06 e RN10 do Login; decisão 157): o
 * `next` do verify (ou o `step` da volta do Google) e o caminho de volta.
 */
export function destinationAfterLogin({
  next,
  returnPath,
}: {
  next: VerifyLoginChallengeResponseNext;
  returnPath?: string | undefined;
}): LoginDestination {
  // Voltar ao cadastro (o Entrar do Simule, Cadastro RN12) vale sobre a Seleção de perfil:
  // quem só colabora em outros casamentos segue para os Dados do casamento.
  if (returnPath === paths.signUp && next !== 'invite' && next !== 'planner_signup') {
    return { kind: 'route', path: paths.signUp };
  }
  switch (next) {
    case 'home':
      return { kind: 'route', path: returnPath ?? paths.coupleArea };
    case 'choose_profile':
      return { kind: 'route', path: paths.profiles };
    case 'couple_signup':
      return { kind: 'route', path: paths.signUp };
    case 'planner_signup':
      return { kind: 'external', url: externalUrls.plannerPartnership };
    case 'invite': {
      const token = storedInviteToken();
      return token
        ? { kind: 'route', path: paths.invite.replace(':token', encodeURIComponent(token)) }
        : { kind: 'route', path: paths.profiles };
    }
  }
}

const LOGIN_STEPS: readonly string[] = [
  'invite',
  'couple_signup',
  'planner_signup',
  'home',
  'choose_profile',
] satisfies VerifyLoginChallengeResponseNext[];

/** O `step` da volta do Google (decisão 147), se for um dos passos do verify. */
export function parseLoginStep({ step }: { step: string | null }) {
  return step && LOGIN_STEPS.includes(step)
    ? (step as VerifyLoginChallengeResponseNext)
    : undefined;
}
