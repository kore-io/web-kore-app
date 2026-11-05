import { useToast } from '@kore-io/design';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccessInvitationsControllerSendV1 } from '../../../shared/api/generated/access-invitations/access-invitations';
import { apiErrorCode } from '../../../shared/api/http-client';
import type { SignInNotice } from '../components/sign-in-alert';
import { isValidEmail } from '../email';

/**
 * Convidar o parceiro depois de criar o casamento (RN10 do Cadastro; Convites de acesso,
 * tipo partner; decisões 155 e 170): envia o convite, avisa no Toast ("Convite enviado
 * para {e-mail}.", da Voz) e segue como o Fazer isso depois.
 */
export function useInvitePartner({ weddingId, onDone }: { weddingId: string; onDone: () => void }) {
  const { t } = useTranslation('access');
  const { showToast } = useToast();
  const send = useAccessInvitationsControllerSendV1();
  const [emailError, setEmailError] = useState<string>();
  const [notice, setNotice] = useState<SignInNotice>();

  function submit({ email }: { email: string }) {
    if (!isValidEmail({ email })) {
      setEmailError(t('weddingDetails.errors.email'));
      return;
    }
    setEmailError(undefined);
    setNotice(undefined);
    send.mutate(
      { weddingId, data: { kind: 'partner', emails: [email] } },
      {
        onSuccess: () => {
          showToast({ tone: 'success', message: t('invitePartner.sent', { email }) });
          onDone();
        },
        onError: (error) => {
          const code = apiErrorCode({ error });
          if (code === 'Bad Request') setEmailError(t('weddingDetails.errors.email'));
          else setNotice({ kind: code === 'RATE_LIMITED' ? 'rate-limited' : 'generic' });
        },
      },
    );
  }

  return { submit, emailError, notice, submitting: send.isPending };
}
