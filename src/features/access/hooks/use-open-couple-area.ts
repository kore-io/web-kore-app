import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import { getMeControllerMeV1QueryKey } from '../../../shared/api/generated/me/me';
import { useSetActiveProfile } from '../api/me-active-profile';

/**
 * Abre o casamento da pessoa: passa a sessão ao perfil de casal (POST /v1/me/active-profile,
 * RN14 e RN16 do Login) e vai à área do casal. Se a troca falhar, a área do casal manda à
 * Seleção de perfil, como em qualquer sessão sem o perfil de casal.
 */
export function useOpenCoupleArea() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setActiveProfile = useSetActiveProfile();
  return {
    open: () =>
      setActiveProfile.mutate(
        { data: { profile: 'couple' } },
        {
          onSettled: () => {
            void queryClient.resetQueries({ queryKey: getMeControllerMeV1QueryKey() });
            void navigate(paths.coupleArea, { replace: true });
          },
        },
      ),
    opening: setActiveProfile.isPending,
  };
}
