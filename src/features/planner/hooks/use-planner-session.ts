import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import { useMeControllerMeV1 } from '../../../shared/api/generated/me/me';
import { ApiError } from '../../../shared/api/http-client';

/**
 * Sessão da Área do cerimonialista pelo GET /v1/me. O gate é pelo perfil que a conta
 * **tem**, e não pelo perfil ativo (Colaboradora RN01; decisão 224, recomendação 3):
 * - sem sessão, vai à Sessão expirada com a página atual no `?next=` (Login RN10);
 * - sem o perfil de cerimonialista, vai ao casamento dela em `/app` (o mesmo destino do
 *   `403 PROFILE_NOT_OWNED`); a Área do Casal manda à Seleção quem também não é casal;
 * - a falha por rede ou 5xx avisa a tela para mostrar o Tentar de novo (decisão 164).
 */
export function usePlannerSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const me = useMeControllerMeV1();

  const sessionExpired = me.error instanceof ApiError && me.error.status === 401;
  // Com o /me sendo relido (ex.: logo depois de criar o perfil), espera a resposta nova.
  const notPlanner =
    me.data !== undefined && !me.isFetching && !me.data.profiles.includes('planner');

  useEffect(() => {
    if (sessionExpired) {
      const next = `${location.pathname}${location.search}`;
      void navigate(`${paths.sessionExpired}?next=${encodeURIComponent(next)}`, { replace: true });
    } else if (notPlanner) {
      void navigate(paths.coupleArea, { replace: true });
    }
  }, [sessionExpired, notPlanner, location.pathname, location.search, navigate]);

  return {
    me: me.data?.profiles.includes('planner') === true ? me.data : undefined,
    failed: me.isError && !sessionExpired,
    retry: () => void me.refetch(),
  };
}
