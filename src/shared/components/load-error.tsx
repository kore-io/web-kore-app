import { Button, EmptyState } from '@kore-io/design';
import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * O aviso de que algo não carregou (rede fora ou 5xx, decisão 164): o texto genérico da
 * 157(3) e o Tentar de novo. Dentro de uma página que já tem o AppShell.
 */
export function LoadErrorNotice({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('access');
  const { t: tCommon } = useTranslation('common');
  return (
    <EmptyState
      icon={<WifiOff />}
      title={t('alerts.generic.title')}
      description={t('alerts.generic.description')}
      action={<Button onClick={onRetry}>{tCommon('retry')}</Button>}
    />
  );
}

/** A tela inteira não carregou: o aviso no meio da tela, sem o AppShell (decisão 164). */
export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="kore-load-error">
      <LoadErrorNotice onRetry={onRetry} />
    </main>
  );
}
