import { Alert } from '@kore-io/design';
import { Trans, useTranslation } from 'react-i18next';

/** Endereço do suporte nos textos de acesso (Voz, decisão 150). */
export const SUPPORT_EMAIL = 'suporte@kore.com.br';

/**
 * Situações do login que viram aviso na tela (Voz & Microcopy, Acessos, decisão 150).
 * Os minutos já chegam arredondados para cima e nunca são 0 (quem calcula é a página).
 */
export type SignInNotice =
  | { kind: 'session-expired' }
  | { kind: 'wrong-code'; attemptsLeft: number }
  | { kind: 'code-expired' }
  | { kind: 'too-many-requests'; minutes: number }
  | { kind: 'new-code-sent'; email: string }
  | { kind: 'locked'; minutes: number }
  | { kind: 'google-unverified' }
  | { kind: 'blocked' }
  | { kind: 'google-failed' }
  /** 429 RATE_LIMITED, o limite por IP (decisões 142(2) e 157(2)). */
  | { kind: 'rate-limited' }
  /** Rede fora, 5xx ou origem recusada (decisão 157(3)). */
  | { kind: 'generic' };

/** O Alert da lib com os textos da Voz para cada situação do login. */
export function SignInAlert({ notice }: { notice: SignInNotice }) {
  const { t } = useTranslation('access');

  switch (notice.kind) {
    case 'session-expired':
      return (
        <Alert tone="info" title={t('sessionExpired.title')}>
          {t('sessionExpired.description')}
        </Alert>
      );
    case 'wrong-code':
      return (
        <Alert tone="danger" role="alert" title={t('alerts.wrongCode.title')}>
          {t('alerts.wrongCode.description', { count: notice.attemptsLeft })}
        </Alert>
      );
    case 'code-expired':
      return (
        <Alert tone="danger" role="alert" title={t('alerts.codeExpired.title')}>
          {t('alerts.codeExpired.description')}
        </Alert>
      );
    case 'too-many-requests':
      return (
        <Alert tone="danger" role="alert" title={t('alerts.tooManyRequests.title')}>
          {t('alerts.tooManyRequests.description', { count: notice.minutes })}
        </Alert>
      );
    case 'new-code-sent':
      return (
        <Alert tone="info" role="alert" title={t('alerts.newCodeSent.title')}>
          {t('alerts.newCodeSent.description', { email: notice.email })}
        </Alert>
      );
    case 'locked':
      return (
        <Alert tone="danger" role="alert" title={t('alerts.locked.title')}>
          {t('alerts.locked.description', { count: notice.minutes })}
        </Alert>
      );
    case 'google-unverified':
      return (
        <Alert tone="danger" role="alert" title={t('alerts.googleUnverified.title')}>
          {t('alerts.googleUnverified.description')}
        </Alert>
      );
    case 'blocked':
      return (
        <Alert tone="danger" role="alert" title={t('alerts.blocked.title')}>
          <Trans
            t={t}
            i18nKey="alerts.blocked.description"
            values={{ supportEmail: SUPPORT_EMAIL }}
            components={{
              supportLink: (
                // O texto do link vem do catálogo, pelo Trans.
                <a className="kore-sign-in__link" href={`mailto:${SUPPORT_EMAIL}`} />
              ),
            }}
          />
        </Alert>
      );
    case 'google-failed':
      return (
        <Alert tone="danger" role="alert" title={t('alerts.googleFailed.title')}>
          {t('alerts.googleFailed.description')}
        </Alert>
      );
    case 'rate-limited':
      return (
        <Alert tone="danger" role="alert" title={t('alerts.rateLimited.title')}>
          {t('alerts.rateLimited.description')}
        </Alert>
      );
    case 'generic':
      return (
        <Alert tone="danger" role="alert" title={t('alerts.generic.title')}>
          {t('alerts.generic.description')}
        </Alert>
      );
  }
}
