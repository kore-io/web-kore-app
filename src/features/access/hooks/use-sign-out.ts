import { useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { paths } from '../../../app/paths';
import { useAuthControllerLogoutV1 } from '../../../shared/api/generated/auth/auth';

/**
 * Sair (RN09, decisão 163(5)): encerra a sessão do aparelho, limpa o cache e vai ao Entrar.
 * Se falhar, avisa no Toast com o aviso genérico (decisão 157(3)) e fica na tela.
 */
export function useSignOut() {
  const { t } = useTranslation('access');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useAuthControllerLogoutV1();

  return () =>
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        void navigate(paths.signIn, { replace: true });
      },
      onError: () =>
        showToast({
          tone: 'danger',
          message: `${t('alerts.generic.title')}. ${t('alerts.generic.description')}`,
        }),
    });
}
