import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import { useMeControllerMeV1 } from '../../../shared/api/generated/me/me';
import { ApiError } from '../../../shared/api/http-client';

/**
 * Sessão da área do casal pelo GET /v1/me (decisão 163(4)): sem sessão, vai à Sessão
 * expirada com a página atual no ?next= (RN10); com outro perfil ativo (ou nenhum), vai à
 * Seleção de perfil (RN14), porque /app é a área do casal.
 */
export function useCoupleSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const me = useMeControllerMeV1();

  const sessionExpired = me.error instanceof ApiError && me.error.status === 401;
  const otherProfile = me.data !== undefined && me.data.activeProfile !== 'couple';

  useEffect(() => {
    if (sessionExpired) {
      const next = `${location.pathname}${location.search}`;
      void navigate(`${paths.sessionExpired}?next=${encodeURIComponent(next)}`, { replace: true });
    } else if (otherProfile) {
      void navigate(paths.profiles, { replace: true });
    }
  }, [sessionExpired, otherProfile, location.pathname, location.search, navigate]);

  return me.data?.activeProfile === 'couple' ? me.data : undefined;
}
