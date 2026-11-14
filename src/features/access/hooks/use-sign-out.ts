import { useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { paths } from '../../../app/paths';
import {
  useAuthControllerLogoutAllV1,
  useAuthControllerLogoutV1,
} from '../../../shared/api/generated/auth/auth';
import { ApiError } from '../../../shared/api/http-client';
import { forgetPushOnSignOut } from '../../notifications/push';
import type { SignInLocationState } from '../sign-in-location-state';

/**
 * Sair (RN09, decisão 163(5)): encerra a sessão do aparelho, limpa o cache e vai ao Entrar.
 * Um 401 quer dizer que a sessão já tinha acabado (venceu, ou "sair de todos" em outro
 * aparelho): vale como saído. O `signInState` vai ao Entrar (ex.: a origem do convite). Só a falha de rede ou da API (5xx) mostra o aviso genérico
 * (decisão 157(3)) no Toast e deixa a pessoa na tela.
 */
export function useSignOut({ signInState }: { signInState?: SignInLocationState } = {}) {
  const logout = useAuthControllerLogoutV1();
  const finish = useFinishSignOut({ signInState });
  return () => logout.mutate(undefined, finish);
}

/**
 * Sair de todos os aparelhos, inclusive este (Login RN09; Configurações › Acesso da
 * cerimonialista, Cadastro e perfil RN11): a API encerra todas as sessões da conta, e este
 * aparelho sai como no Sair. Devolve a ação e se ela está em andamento.
 */
export function useSignOutEverywhere() {
  const logoutAll = useAuthControllerLogoutAllV1();
  const finish = useFinishSignOut({});
  return {
    signOutEverywhere: () => logoutAll.mutate(undefined, finish),
    pending: logoutAll.isPending,
  };
}

/** O fim comum do Sair: limpa o cache, esquece o push e vai ao Entrar; 401 vale como saído. */
function useFinishSignOut({ signInState }: { signInState?: SignInLocationState | undefined }) {
  const { t } = useTranslation('access');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signedOut = () => {
    queryClient.clear();
    // A API apaga o push da sessão (Notificações e push RN08); o navegador esquece o dele.
    void forgetPushOnSignOut();
    // O Entrar com outra conta do convite volta ao convite depois (origem invite, RN06).
    void navigate(paths.signIn, { replace: true, state: signInState });
  };

  return {
    onSuccess: signedOut,
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        signedOut();
        return;
      }
      showToast({
        tone: 'danger',
        message: `${t('alerts.generic.title')}. ${t('alerts.generic.description')}`,
      });
    },
  };
}
