import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import { destinationAfterLogin, parseLoginStep, safeReturnPath } from '../login-navigation';
import type { SignInLocationState } from '../sign-in-location-state';
import { useGoToDestination } from './use-go-to-destination';

/**
 * Volta do login com Google (/entrar/google?step=&next=, decisão 147): o cookie já veio;
 * segue o `step` como depois do verify. Sem `step` válido, volta ao Entrar com o erro do Google.
 */
export function useGoogleReturn({ step, next }: { step: string | null; next: string | null }) {
  const navigate = useNavigate();
  const goTo = useGoToDestination();

  useEffect(() => {
    const loginStep = parseLoginStep({ step });
    if (!loginStep) {
      const state: SignInLocationState = { notice: { kind: 'google-failed' } };
      void navigate(paths.signIn, { replace: true, state });
      return;
    }
    const returnPath = safeReturnPath({ path: next });
    goTo(
      destinationAfterLogin({ next: loginStep, ...(returnPath !== undefined && { returnPath }) }),
    );
  }, [step, next, navigate, goTo]);
}
