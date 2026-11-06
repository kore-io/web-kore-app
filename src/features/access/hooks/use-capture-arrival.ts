import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { saveReferralCode } from '../referral-storage';
import { originFromUrl, saveSignupOrigin, SIGNUP_ORIGIN_PARAMS } from '../signup-origin-storage';

const ARRIVAL_PARAMS = ['indicacao', ...SIGNUP_ORIGIN_PARAMS];

/**
 * Guarda o que a chegada traz na URL, em qualquer rota, e tira esses parâmetros dela: o
 * ?indicacao={código} (decisão 165(1); o site leva kore.com.br/i/{código} até o app) e a
 * origem do cadastro, as UTM e o ?origem=site (decisão 169(2)).
 */
export function useCaptureArrival() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hasArrivalParams = ARRIVAL_PARAMS.some((name) => searchParams.has(name));

  useEffect(() => {
    if (!hasArrivalParams) return;
    const code = searchParams.get('indicacao');
    if (code !== null) saveReferralCode({ code });
    saveSignupOrigin({ origin: originFromUrl({ params: searchParams }) });
    setSearchParams(
      (params) => {
        for (const name of ARRIVAL_PARAMS) params.delete(name);
        return params;
      },
      { replace: true },
    );
  }, [hasArrivalParams, searchParams, setSearchParams]);
}
