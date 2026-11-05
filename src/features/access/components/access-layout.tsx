import { Logo } from '@kore-io/design';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Quadro das telas de acesso (Acessos, Penpot): no celular, logo em cima e a linha legal
 * no pé; no tablet, um cartão de 480 px centralizado; no computador, o painel da marca à
 * esquerda e a coluna de 400 px à direita, sem o logo de cima.
 */
export function AccessLayout({
  children,
  showLegal = true,
  pitch = 'default',
}: {
  children: ReactNode;
  /** A Seleção de perfil não tem a linha legal (Penpot e Voz). */
  showLegal?: boolean;
  /** Texto do painel da marca: o do Acessos ou o do casal, no Cadastro (decisão 154). */
  pitch?: 'default' | 'couple';
}) {
  const { t } = useTranslation('access');
  const panel = pitch === 'couple' ? 'brandPanelCouple' : 'brandPanel';
  const { t: tCommon } = useTranslation('common');
  return (
    <div className="kore-access">
      <aside className="kore-access__brand">
        <Logo variant="white" label={tCommon('appName')} />
        <div className="kore-access__pitch">
          <p className="kore-access__headline">{t(`${panel}.headline`)}</p>
          <p className="kore-access__description">{t(`${panel}.description`)}</p>
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
        {showLegal && <p className="kore-access__legal">{t('legal')}</p>}
      </main>
    </div>
  );
}
