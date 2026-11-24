import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import { parseLoginStep, safeReturnPath } from '../login-navigation';
import type { SignInLocationState } from '../sign-in-location-state';
import { useFinishLogin } from './use-finish-login';

/**
 * Volta do login com Google (/entrar/google?step=&next=, decisão 147): o cookie já veio;
 * segue o `step` como depois do verify. Sem `step` válido, volta ao Entrar com o erro do Google.
 * Segue uma vez só: o StrictMode do dev roda o efeito duas vezes, e a 2ª, sem a marca da
 * reentrada (já consumida pela 1ª), mandaria à Seleção de perfil (Retenção RN08).
 */
export function useGoogleReturn({ step, next }: { step: string | null; next: string | null }) {
  const navigate = useNavigate();
  const finishLogin = useFinishLogin();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const loginStep = parseLoginStep({ step });
    if (!loginStep) {
      const state: SignInLocationState = { notice: { kind: 'google-failed' } };
      void navigate(paths.signIn, { replace: true, state });
      return;
    }
    const returnPath = safeReturnPath({ path: next });
    finishLogin({ next: loginStep, returnPath });
  }, [step, next, navigate, finishLogin]);
}
