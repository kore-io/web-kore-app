import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import { useLoginControllerVerifyV1 } from '../../../shared/api/generated/auth/auth';
import type { SignInNotice } from '../components/sign-in-alert';
import { verifyOutcome } from '../login-errors';
import { destinationAfterLogin } from '../login-navigation';
import type { SignInLocationState } from '../sign-in-location-state';
import { useGoToDestination } from './use-go-to-destination';

/**
 * Botão do e-mail de código (/entrar/confirmar?token=, decisão 139): confirma uma vez e
 * segue; no erro, volta ao Entrar com o aviso (decisão 157(5)).
 */
export function useConfirmSignIn({ token }: { token: string | null }) {
  const navigate = useNavigate();
  const goTo = useGoToDestination();
  const { mutate } = useLoginControllerVerifyV1();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const backToSignIn = (notice?: SignInNotice) => {
      const state: SignInLocationState = notice ? { notice } : {};
      void navigate(paths.signIn, { replace: true, state });
    };
    if (!token) {
      backToSignIn();
      return;
    }
    mutate(
      { data: { token } },
      {
        onSuccess: ({ next }) => goTo(destinationAfterLogin({ next })),
        onError: (error) => {
          const outcome = verifyOutcome({ error, email: '' });
          // Pelo botão não há casas nem e-mail na tela: o código novo da RN05 vira "não vale mais".
          backToSignIn(outcome.kind === 'new-code' ? { kind: 'code-expired' } : outcome.notice);
        },
      },
    );
  }, [token, mutate, navigate, goTo]);
}
