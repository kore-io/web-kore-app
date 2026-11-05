import type { RequestLoginChallengeBodyOrigin } from '../../shared/api/generated/model';
import type { SignInNotice } from './components/sign-in-alert';

/** O que outras telas passam ao Entrar pela navegação (decisão 157). */
export interface SignInLocationState {
  /** Origem do login (RN06): o convite e o cadastro passam a sua. */
  origin?: RequestLoginChallengeBodyOrigin;
  originRef?: string;
  /** Aviso ao chegar (ex.: o botão do e-mail venceu). */
  notice?: SignInNotice;
}

export function readSignInLocationState({ state }: { state: unknown }): SignInLocationState {
  return typeof state === 'object' && state !== null ? (state as SignInLocationState) : {};
}
