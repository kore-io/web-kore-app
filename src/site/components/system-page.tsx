import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KORE_URL } from '../links';

/**
 * Página de sistema do site (Penpot, Área do Convidado, página 03): na voz e nas cores do
 * Kore, e não nas da Aparência, sem nome do casal. O ícone num círculo, o título, a linha
 * de apoio e "Feito com Kore" no pé.
 */
export function SystemPage({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const { t } = useTranslation('publicSite');
  return (
    <div className="kore-site-system">
      <main id="conteudo" className="kore-site-system__main">
        <span className="kore-site-system__icon" aria-hidden="true">
          {icon}
        </span>
        <h1 className="kore-site-system__title">{title}</h1>
        <p className="kore-site-system__description">{description}</p>
        {action}
      </main>
      <footer className="kore-site-system__footer">
        <a className="kore-site-system__made-with" href={KORE_URL}>
          {t('footer.madeWith')}
        </a>
      </footer>
    </div>
  );
}
