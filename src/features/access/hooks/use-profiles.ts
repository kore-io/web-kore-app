import { useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import {
  getMeControllerMeV1QueryKey,
  useMeControllerMeV1,
} from '../../../shared/api/generated/me/me';
import { ApiError } from '../../../shared/api/http-client';
import { safeReturnPath } from '../login-navigation';
import { useSetActiveProfile, type ProfileKind } from '../api/me-active-profile';

/**
 * Seleção de perfil (/perfis; RN14 a RN16 do Login; decisões 152, 173(e), 174(7) e 176): lê os
 * perfis do /me, entra direto com um perfil só, e escolhe pelo POST /v1/me/active-profile.
 */
export function useProfiles() {
  const { t } = useTranslation('access');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useMeControllerMeV1();
  const setActiveProfile = useSetActiveProfile();
  const enteredDirectly = useRef(false);

  const signedOut = me.error instanceof ApiError && me.error.status === 401;
  const data = me.data;
  const profiles = data?.profiles ?? [];

  useEffect(() => {
    if (signedOut) void navigate(paths.signIn, { replace: true });
  }, [signedOut, navigate]);

  function choose({ profile }: { profile: ProfileKind }) {
    setActiveProfile.mutate(
      { data: { profile } },
      {
        onSuccess: ({ home }) => {
          void queryClient.resetQueries({ queryKey: getMeControllerMeV1QueryKey() });
          // O app segue o home da API: /app para o casal, /cerimonialista para o
          // cerimonialista (Cadastro e perfil RN07, que revê a 176(1)). Só caminho do app.
          void navigate(safeReturnPath({ path: home }) ?? paths.profiles, { replace: true });
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 401) {
            void navigate(paths.signIn, { replace: true });
            return;
          }
          // 403 PROFILE_NOT_OWNED, rede ou 5xx: o aviso genérico (decisão 157(3)).
          enteredDirectly.current = false;
          showToast({
            tone: 'danger',
            message: `${t('alerts.generic.title')}. ${t('alerts.generic.description')}`,
          });
        },
      },
    );
  }

  // RN14: com um perfil só, entra direto nele.
  const onlyProfile = profiles.length === 1 ? profiles[0] : undefined;
  useEffect(() => {
    if (!onlyProfile || enteredDirectly.current) return;
    enteredDirectly.current = true;
    choose({ profile: onlyProfile });
    // choose muda a cada render; entra uma vez só, quando o perfil único aparece.
  }, [onlyProfile]);

  const owned = data?.memberships?.find((membership) => membership.role === 'owner');

  return {
    loading: me.isPending || signedOut || onlyProfile !== undefined,
    failed: me.isError && !signedOut,
    retry: () => void me.refetch(),
    me: data,
    profiles,
    couple: owned,
    planner: data?.planner ?? undefined,
    lastUsed: data?.lastProfileOnDevice ?? undefined,
    choosing: setActiveProfile.isPending,
    choose,
    createWedding: () => void navigate(paths.signUp),
    partnership: () => void navigate(paths.plannerSignUp),
  };
}
