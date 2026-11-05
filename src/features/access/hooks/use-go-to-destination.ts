import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { redirectTo } from '../../../shared/browser/redirect';
import type { LoginDestination } from '../login-navigation';

/** Vai ao destino do login: rota do app (sem voltar ao Entrar) ou endereço de fora. */
export function useGoToDestination() {
  const navigate = useNavigate();
  return useCallback(
    (destination: LoginDestination) => {
      if (destination.kind === 'external') redirectTo({ url: destination.url });
      else void navigate(destination.path, { replace: true });
    },
    [navigate],
  );
}
