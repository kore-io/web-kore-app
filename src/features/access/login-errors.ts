import { ApiError, apiErrorCode } from '../../shared/api/http-client';
import type { SignInNotice } from './components/sign-in-alert';

/** Em que deu o pedido de código, para a tela. */
export type RequestCodeOutcome =
  | { kind: 'notice'; notice: SignInNotice }
  | { kind: 'invalid-email' }
  /** TOO_SOON: o código anterior segue valendo; vai ao passo do código com a contagem. */
  | { kind: 'too-soon'; resendAvailableAt: string };

/** Em que deu a confirmação do código (ou do botão do e-mail), para a tela. */
export type VerifyOutcome =
  | { kind: 'notice'; notice: SignInNotice; invalid?: boolean }
  /** CHALLENGE_LOCKED com código novo: avisa, limpa as casas e reinicia a contagem. */
  | { kind: 'new-code'; notice: SignInNotice };

function body(error: unknown): Record<string, unknown> {
  return error instanceof ApiError && typeof error.body === 'object' && error.body !== null
    ? (error.body as Record<string, unknown>)
    : {};
}

/** Minutos para a tela: inteiro, para cima, nunca 0 (decisão 150(2)). */
function minutes(value: unknown) {
  return Math.max(1, Math.ceil(typeof value === 'number' ? value : 1));
}

const GENERIC: SignInNotice = { kind: 'generic' };

/** Erro do POST /v1/auth/login-challenges (RN04 do Login; decisões 142(2) e 157). */
export function requestCodeOutcome({ error }: { error: unknown }): RequestCodeOutcome {
  switch (apiErrorCode({ error })) {
    case 'Bad Request':
      return { kind: 'invalid-email' };
    case 'TOO_SOON': {
      const resendAvailableAt = body(error).resendAvailableAt;
      return typeof resendAvailableAt === 'string'
        ? { kind: 'too-soon', resendAvailableAt }
        : { kind: 'notice', notice: GENERIC };
    }
    case 'TOO_MANY_REQUESTS':
      return {
        kind: 'notice',
        notice: { kind: 'too-many-requests', minutes: minutes(body(error).retryAfterMinutes) },
      };
    case 'RATE_LIMITED':
      return { kind: 'notice', notice: { kind: 'rate-limited' } };
    default:
      return { kind: 'notice', notice: GENERIC };
  }
}

/** Erro do POST /v1/auth/login-challenges/verify (RN02, RN05 e RN11 do Login). */
export function verifyOutcome({ error, email }: { error: unknown; email: string }): VerifyOutcome {
  const errorBody = body(error);
  switch (apiErrorCode({ error })) {
    case 'INVALID_CODE':
      return {
        kind: 'notice',
        notice: { kind: 'wrong-code', attemptsLeft: Number(errorBody.attemptsLeft ?? 0) },
        invalid: true,
      };
    case 'CHALLENGE_EXPIRED':
      return { kind: 'notice', notice: { kind: 'code-expired' } };
    case 'CHALLENGE_LOCKED':
      return errorBody.newCodeSent === true
        ? { kind: 'new-code', notice: { kind: 'new-code-sent', email } }
        : {
            kind: 'notice',
            notice: { kind: 'locked', minutes: minutes(errorBody.retryAfterMinutes) },
          };
    case 'USER_BLOCKED':
      return { kind: 'notice', notice: { kind: 'blocked' } };
    case 'RATE_LIMITED':
      return { kind: 'notice', notice: { kind: 'rate-limited' } };
    default:
      return { kind: 'notice', notice: GENERIC };
  }
}

/** `?error=` da volta do Google (decisões 147 e 150). */
export function noticeFromGoogleError({
  error,
}: {
  error: string | null;
}): SignInNotice | undefined {
  switch (error) {
    case 'google_unverified':
      return { kind: 'google-unverified' };
    case 'blocked':
      return { kind: 'blocked' };
    case 'google_failed':
      return { kind: 'google-failed' };
    default:
      return undefined;
  }
}
