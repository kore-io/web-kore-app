import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { getMeControllerMeV1QueryKey } from '../../../shared/api/generated/me/me';
import { redirectTo } from '../../../shared/browser/redirect';
import type { LoginDestination } from '../login-navigation';

/**
 * Vai ao destino do login: rota do app (sem voltar ao Entrar) ou endereço de fora. Antes,
 * zera o GET /v1/me em cache: o de antes do login (401) faria a área do casal voltar à
 * Sessão expirada e o Cadastro ficar no Início; zerado, quem estiver na tela lê de novo.
 */
export function useGoToDestination() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useCallback(
    (destination: LoginDestination) => {
      void queryClient.resetQueries({ queryKey: getMeControllerMeV1QueryKey() });
      if (destination.kind === 'external') redirectTo({ url: destination.url });
      else void navigate(destination.path, { replace: true });
    },
    [navigate, queryClient],
  );
}
