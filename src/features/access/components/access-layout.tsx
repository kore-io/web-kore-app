import { Logo } from '@kore-io/design';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Quadro das telas de acesso (Acessos, Penpot): no celular, logo em cima e a linha legal
 * no pé; no tablet, um cartão de 480 px centralizado; no computador, o painel da marca à
 * esquerda e a coluna de 400 px à direita, sem o logo de cima.
 */
export function AccessLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation('access');
  const { t: tCommon } = useTranslation('common');
  return (
    <div className="kore-access">
      <aside className="kore-access__brand">
        <Logo variant="white" label={tCommon('appName')} />
        <div className="kore-access__pitch">
          <p className="kore-access__headline">{t('brandPanel.headline')}</p>
          <p className="kore-access__description">{t('brandPanel.description')}</p>
        </div>
        <p className="kore-access__site">{t('brandPanel.site')}</p>
      </aside>
      <main className="kore-access__main">
        <div className="kore-access__card">
          <div className="kore-access__top">
            <Logo label={tCommon('appName')} />
          </div>
          {children}
        </div>
        <p className="kore-access__legal">{t('legal')}</p>
      </main>
    </div>
  );
}
