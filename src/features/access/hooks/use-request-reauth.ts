import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import { rememberReauthReturn } from '../reauth';
import type { SignInLocationState } from '../sign-in-location-state';

/**
 * A reentrada do `403 REAUTH_REQUIRED` (Retenção RN08): leva ao Entrar com o aviso da tela
 * (ex.: "Por segurança, entrem de novo para excluir o casamento.") e, depois do login, volta
 * à mesma tela. A ação não se repete sozinha: a pessoa confirma de novo.
 */
export function useRequestReauth() {
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(
    ({ message }: { message: string }) => {
      const path = `${location.pathname}${location.search}`;
      rememberReauthReturn({ path });
      const state: SignInLocationState = { notice: { kind: 'reauth', message } };
      void navigate(`${paths.signIn}?next=${encodeURIComponent(path)}`, { state });
    },
    [location.pathname, location.search, navigate],
  );
}
