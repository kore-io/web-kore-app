import { useToast } from '@kore-io/design';
import { useTranslation } from 'react-i18next';
import { sitePreviewsControllerCreateV1 } from '../../../shared/api/generated/site/site';

/**
 * Abre a prévia do site em nova aba (Pré-visualização RN01 e RN02). O app só sabe a `url`
 * depois do token, e um `window.open` depois de um `await` é bloqueado (Safari, Firefox):
 * por isso a aba vazia abre no próprio clique e, com o token, vai para a `url` sem o
 * `opener`. Aba bloqueada: o Toast com Abrir a prévia, que abre num novo clique. Falha no
 * token: a aba vazia fecha e vem o Toast do erro.
 */
export function useOpenPreview({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('site');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();

  return function openPreview(body: { mode: 'visitor' } | { mode: 'party'; partyId: string }) {
    // Precisa ser síncrono, no clique.
    const tab = window.open('', '_blank');
    void (async () => {
      try {
        const { url } = await sitePreviewsControllerCreateV1(weddingId, body);
        if (tab && !tab.closed) {
          tab.opener = null;
          tab.location.href = url;
          return;
        }
        showToast({
          tone: 'danger',
          message: t('previewSite.blocked'),
          action: {
            label: t('previewSite.openAction'),
            onClick: () => window.open(url, '_blank', 'noopener'),
          },
        });
      } catch {
        tab?.close();
        showToast({
          tone: 'danger',
          message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
        });
      }
    })();
  };
}
