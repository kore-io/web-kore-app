import { Button, EmptyState } from '@kore-io/design';
import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * A tela não carregou (rede fora ou 5xx, decisão 164): o aviso genérico da 157(3) no meio da
 * tela e o Tentar de novo.
 */
export function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('access');
  const { t: tCommon } = useTranslation('common');
  return (
    <main className="kore-load-error">
      <EmptyState
        icon={<WifiOff />}
        title={t('alerts.generic.title')}
        description={t('alerts.generic.description')}
        action={<Button onClick={onRetry}>{tCommon('retry')}</Button>}
      />
    </main>
  );
}
