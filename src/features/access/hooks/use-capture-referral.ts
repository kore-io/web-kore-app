import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { saveReferralCode } from '../referral-storage';

/**
 * Guarda o ?indicacao={código} de qualquer rota (decisão 165(1)) e o tira da URL. O site
 * leva o link kore.com.br/i/{código} até o app com esse parâmetro.
 */
export function useCaptureReferral() {
  const [searchParams, setSearchParams] = useSearchParams();
  const code = searchParams.get('indicacao');

  useEffect(() => {
    if (code === null) return;
    saveReferralCode({ code });
    setSearchParams(
      (params) => {
        params.delete('indicacao');
        return params;
      },
      { replace: true },
    );
  }, [code, setSearchParams]);
}
