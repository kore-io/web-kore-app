import { SignInPage } from './sign-in-page';

/** Sessão expirada (RN10): o Entrar com o aviso "Sua sessão terminou" e a volta pelo ?next=. */
export function SessionExpiredPage() {
  return <SignInPage initialNotice={{ kind: 'session-expired' }} />;
}
