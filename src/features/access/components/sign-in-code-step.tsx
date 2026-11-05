import { Button, CodeInput } from '@kore-io/design';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** O código de acesso tem 6 números (RN01 do Login). */
export const CODE_LENGTH = 6;

export interface SignInCodeStepProps {
  email: string;
  /** Aviso acima do título (SignInAlert: código errado, vencido, muitos pedidos…). */
  notice?: ReactNode;
  onSubmit: (values: { code: string }) => void;
  submitting?: boolean;
  /** Segundos até poder reenviar; 0 libera o link. `null`: reenvio bloqueado (RN04). */
  resendSecondsLeft: number | null;
  onResend: () => void;
  onUseAnotherEmail: () => void;
  /** Muda para limpar as casas (depois de reenviar ou de um código novo). */
  resetKey?: string | number;
  invalid?: boolean;
}

/** m:ss, como em "Reenviar código em 0:42". */
export function formatCountdown({ seconds }: { seconds: number }) {
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

/**
 * Passo do código da tela Entrar (Acessos, Penpot; Voz, decisão 150): título, e-mail,
 * 6 casas, Entrar só com os 6 números, o controle único de reenviar e "Usar outro
 * e-mail". Visual por props; a contagem e a API ficam com a página.
 */
export function SignInCodeStep({
  email,
  notice,
  onSubmit,
  submitting = false,
  resendSecondsLeft,
  onResend,
  onUseAnotherEmail,
  resetKey,
  invalid = false,
}: SignInCodeStepProps) {
  const { t } = useTranslation('access');
  const [code, setCode] = useState('');
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setCode('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length === CODE_LENGTH) onSubmit({ code });
  }

  const canResend = resendSecondsLeft === 0;

  return (
    <div className="kore-sign-in">
      {notice}
      <div className="kore-sign-in__heading">
        <h1 className="kore-sign-in__title">{t('code.title')}</h1>
        <p className="kore-sign-in__description">{t('code.description', { email })}</p>
      </div>
      <form className="kore-sign-in__form" onSubmit={handleSubmit} noValidate>
        <CodeInput
          length={CODE_LENGTH}
          value={code}
          onValueChange={({ value }) => setCode(value)}
          aria-label={t('code.inputLabel')}
          digitLabel={({ index, length }) => t('code.digitLabel', { n: index + 1, length })}
          invalid={invalid}
          autoFocus
        />
        <Button
          type="submit"
          size="lg"
          className="kore-sign-in__submit"
          disabled={code.length < CODE_LENGTH || submitting}
        >
          {t('code.submit')}
        </Button>
      </form>
      <div className="kore-sign-in__links">
        {/* Um só controle: desabilitado com a contagem, link no zero. A contagem não é
            anunciada a cada segundo (sem aria-live). */}
        <button
          type="button"
          className="kore-sign-in__resend"
          disabled={!canResend}
          onClick={onResend}
        >
          {canResend || resendSecondsLeft === null
            ? t('code.resend')
            : t('code.resendIn', { time: formatCountdown({ seconds: resendSecondsLeft }) })}
        </button>
        <button type="button" className="kore-sign-in__link" onClick={onUseAnotherEmail}>
          {t('code.useAnotherEmail')}
        </button>
      </div>
    </div>
  );
}
