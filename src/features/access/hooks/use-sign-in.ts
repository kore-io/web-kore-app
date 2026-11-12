import { useToast } from '@kore-io/design';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getGoogleLoginControllerStartV1Url,
  useLoginControllerRequestV1,
  useLoginControllerVerifyV1,
} from '../../../shared/api/generated/auth/auth';
import type { RequestLoginChallengeBodyOrigin } from '../../../shared/api/generated/model';
import { apiUrl } from '../../../shared/api/http-client';
import { redirectTo } from '../../../shared/browser/redirect';
import { useCountdown } from '../../../shared/hooks/use-countdown';
import type { SignInNotice } from '../components/sign-in-alert';
import { isValidEmail } from '../email';
import { requestCodeOutcome, verifyOutcome } from '../login-errors';
import { destinationAfterLogin } from '../login-navigation';
import { useGoToDestination } from './use-go-to-destination';

/** RN04 do Login: 60 s entre pedidos (o reinício depois do código novo da RN05). */
const RESEND_INTERVAL_MS = 60_000;

export interface UseSignInOptions {
  /** De onde a pessoa veio (RN06); padrão none (tela Entrar do site). */
  origin?: RequestLoginChallengeBodyOrigin;
  originRef?: string;
  /** Página de volta (RN10), já validada. */
  returnPath?: string;
  /** Aviso ao abrir (sessão expirada, erro do Google, botão do e-mail vencido). */
  initialNotice?: SignInNotice;
}

/**
 * Estado e ações da tela Entrar (Login sem senha e sessão; decisões 150, 151 e 157): pede o
 * código, confirma, reenvia com a contagem da RN04 e começa o login com o Google.
 */
export function useSignIn({
  origin = 'none',
  originRef,
  returnPath,
  initialNotice,
}: UseSignInOptions) {
  const { t } = useTranslation('access');
  const { showToast } = useToast();
  const goTo = useGoToDestination();
  const requestCode = useLoginControllerRequestV1();
  const verify = useLoginControllerVerifyV1();

  /** Com e-mail, a tela está no passo do código. */
  const [email, setEmail] = useState<string>();
  const [notice, setNotice] = useState(initialNotice);
  const [emailError, setEmailError] = useState<string>();
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [codeResetKey, setCodeResetKey] = useState(0);
  const [codeInvalid, setCodeInvalid] = useState(false);
  const resendSecondsLeft = useCountdown({ until: resendAt });

  function sendCode({ to, resend }: { to: string; resend: boolean }) {
    requestCode.mutate(
      { data: { email: to, origin, ...(originRef !== undefined && { originRef }) } },
      {
        onSuccess: ({ resendAvailableAt }) => {
          setEmail(to);
          setNotice(undefined);
          setCodeInvalid(false);
          setResendAt(Date.parse(resendAvailableAt));
          if (resend) {
            setCodeResetKey((key) => key + 1);
            showToast({ tone: 'success', message: t('code.resent', { email: to }) });
          }
        },
        onError: (error) => {
          const outcome = requestCodeOutcome({ error });
          if (outcome.kind === 'invalid-email') setEmailError(t('signIn.emailInvalid'));
          else if (outcome.kind === 'too-soon') {
            // O código anterior segue valendo (RN04): segue no passo do código.
            setEmail(to);
            setResendAt(Date.parse(outcome.resendAvailableAt));
          } else setNotice(outcome.notice);
        },
      },
    );
  }

  return {
    step: email === undefined ? ('email' as const) : ('code' as const),
    email: email ?? '',
    notice,
    emailError,
    submitting: requestCode.isPending || verify.isPending,
    resendSecondsLeft,
    codeResetKey,
    codeInvalid,
    submitEmail({ email: typed }: { email: string }) {
      const value = typed.trim();
      if (!isValidEmail({ email: value })) {
        setEmailError(t('signIn.emailInvalid'));
        return;
      }
      setEmailError(undefined);
      sendCode({ to: value, resend: false });
    },
    submitCode({ code }: { code: string }) {
      if (email === undefined) return;
      verify.mutate(
        { data: { email, code } },
        {
          onSuccess: ({ next }) => goTo(destinationAfterLogin({ next, returnPath })),
          onError: (error) => {
            const outcome = verifyOutcome({ error, email });
            setNotice(outcome.notice);
            setCodeInvalid(outcome.kind === 'notice' && outcome.invalid === true);
            if (outcome.kind === 'new-code') {
              setCodeResetKey((key) => key + 1);
              setResendAt(Date.now() + RESEND_INTERVAL_MS);
            }
          },
        },
      );
    },
    resend() {
      if (email !== undefined) sendCode({ to: email, resend: true });
    },
    useAnotherEmail() {
      setEmail(undefined);
      setNotice(undefined);
      setCodeInvalid(false);
      setResendAt(null);
    },
    continueWithGoogle() {
      const path = getGoogleLoginControllerStartV1Url({
        origin,
        ...(originRef !== undefined && { originRef }),
        ...(returnPath !== undefined && { next: returnPath }),
      });
      redirectTo({ url: apiUrl({ path }) });
    },
  };
}
