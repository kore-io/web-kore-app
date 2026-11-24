import { useCallback } from 'react';
import type { VerifyLoginChallengeResponseNext } from '../../../shared/api/generated/model';
import { useSetActiveProfile } from '../api/me-active-profile';
import { destinationAfterLogin } from '../login-navigation';
import { consumeReauthReturn } from '../reauth';
import { useGoToDestination } from './use-go-to-destination';

/**
 * Depois de confirmar o login (o código ou a volta do Google): segue o destino do login
 * (`destinationAfterLogin`). Na reentrada do `REAUTH_REQUIRED` (Retenção RN08), volta à tela
 * de antes com o perfil de antes: a sessão nova nasce sem perfil ativo, e as áreas mandariam
 * à Seleção de perfil. Então ativa o perfil guardado (POST /v1/me/active-profile) e só depois
 * navega. Se a ativação falhar, segue o destino de sempre.
 */
export function useFinishLogin() {
  const goTo = useGoToDestination();
  const { mutate: setActiveProfile } = useSetActiveProfile();

  return useCallback(
    ({
      next,
      returnPath,
    }: {
      next: VerifyLoginChallengeResponseNext;
      returnPath: string | undefined;
    }) => {
      const usual = destinationAfterLogin({ next, returnPath });
      const reauth = consumeReauthReturn({ returnPath });
      // Só no login comum, sem convite nem cadastro pela frente.
      if (!reauth || (next !== 'home' && next !== 'choose_profile')) {
        goTo(usual);
        return;
      }
      const back = { kind: 'route', path: reauth.path } as const;
      if (reauth.profile === null) {
        goTo(back);
        return;
      }
      setActiveProfile(
        { data: { profile: reauth.profile } },
        { onSuccess: () => goTo(back), onError: () => goTo(usual) },
      );
    },
    [goTo, setActiveProfile],
  );
}
