import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import { getMeControllerMeV1QueryKey } from '../../../shared/api/generated/me/me';
import type { MeResponse } from '../../../shared/api/generated/model';
import { rememberReauthReturn } from '../reauth';
import type { SignInLocationState } from '../sign-in-location-state';

/**
 * A reentrada do `403 REAUTH_REQUIRED` (Retenção RN08): leva ao Entrar com o aviso da tela
 * (ex.: "Por segurança, entrem de novo para excluir o casamento.") e, depois do login, volta
 * à mesma tela, com o perfil que estava ativo (lido do /me em cache). A ação não se repete
 * sozinha: a pessoa confirma de novo.
 */
export function useRequestReauth() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useCallback(
    ({ message }: { message: string }) => {
      const path = `${location.pathname}${location.search}`;
      const me = queryClient.getQueryData<MeResponse>(getMeControllerMeV1QueryKey());
      rememberReauthReturn({ path, profile: me?.activeProfile ?? null });
      const state: SignInLocationState = { notice: { kind: 'reauth', message } };
      void navigate(`${paths.signIn}?next=${encodeURIComponent(path)}`, { state });
    },
    [location.pathname, location.search, navigate, queryClient],
  );
}
