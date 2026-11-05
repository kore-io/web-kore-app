import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMeControllerMeV1 } from '../../../shared/api/generated/me/me';
import { useReferralControllerReferralV1 } from '../../../shared/api/generated/referrals/referrals';
import { ApiError } from '../../../shared/api/http-client';
import { currentReferralCode } from '../referral-storage';
import { useSignIn } from './use-sign-in';

/**
 * Em que passo o Cadastro abre: só o 401 (sem sessão) leva ao Início; com a rede fora ou
 * 5xx, quem já estava conectado não pode cair no login: a tela mostra o aviso (decisão 164).
 */
function stageOf({ me }: { me: { isPending: boolean; data?: unknown; error: unknown } }) {
  if (me.isPending) return 'loading' as const;
  if (me.data) return 'details' as const;
  return me.error instanceof ApiError && me.error.status === 401
    ? ('start' as const)
    : ('failed' as const);
}

/**
 * Cadastro do casal (/cadastro, decisão 165): sem sessão, o Início com o login do Entrar
 * (origem referral com o código guardado, ou couple_signup) e a caixa de indicação; com
 * sessão, os Dados do casamento.
 */
export function useSignUp() {
  const [searchParams] = useSearchParams();
  // Lido uma vez: o ?indicacao= sai da URL logo depois de ser guardado.
  const [code] = useState(() => currentReferralCode({ urlCode: searchParams.get('indicacao') }));
  const me = useMeControllerMeV1({ query: { retry: false } });
  const referral = useReferralControllerReferralV1(code ?? '', {
    query: { enabled: code !== undefined, retry: false },
  });
  const signIn = useSignIn(
    code ? { origin: 'referral', originRef: code } : { origin: 'couple_signup' },
  );

  // A caixa só com o indicador ativo e o desconto ligado (RN08 e RN09; decisões 155(4) e
  // 165(2)): 404 ou desconto null seguem o cadastro normal, sem a caixa.
  const discountPercent = referral.data?.discountPercent;
  const referralBox =
    referral.data && typeof discountPercent === 'number'
      ? { name: referral.data.referrerName, discountPercent }
      : undefined;

  return {
    stage: stageOf({ me }),
    retry: () => void me.refetch(),
    referral: referralBox,
    signIn,
  };
}
