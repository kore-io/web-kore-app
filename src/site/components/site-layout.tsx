import { Menu, X } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PublicSiteResponse } from '../../shared/api/generated/model';
import { LONG_DATE } from '../../features/site/site-texts';
import { EDITOR_SECTIONS } from '../../features/site/sections';
import { companyLine, KORE_URL, PRIVACY_URL, TERMS_URL } from '../links';

/** A âncora de cada seção no Início, pelo caminho do Editor (ex.: `#nossa-historia`). */
export function sectionAnchor(type: string): string {
  return EDITOR_SECTIONS.find((section) => section.key === type)?.slug ?? type;
}

/**
 * O layout do site do casal (Site público RN10 e RN11; Penpot, Início): "Pular para o
 * conteúdo", a Topbar com os nomes (voltam ao topo) e o menu com o título de cada seção
 * ligada e com conteúdo; abaixo de 1024 px, o menu abre por um botão. No rodapé, os
 * nomes, a data e a cidade, "Feito com Kore", Termos, Privacidade e a linha da empresa.
 */
export function SiteLayout({
  site,
  banner,
  children,
}: {
  site: PublicSiteResponse;
  /** O que vem antes da Topbar (a faixa do grupo, a barra da prévia). */
  banner?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation('publicSite');
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  const items = site.sections.filter((section) => section.type !== 'countdown' && section.title);
  const company = companyLine();
  const dateLine = [
    site.eventDate && LONG_DATE.format(new Date(`${site.eventDate}T12:00:00Z`)),
    site.city,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="kore-site">
      <a className="kore-site__skip" href="#conteudo">
        {t('skipToContent')}
      </a>
      {banner}
      <header
        className="kore-site__topbar"
        onKeyDown={(event) => {
          // O Esc fecha o menu aberto e devolve o foco ao botão.
          if (event.key !== 'Escape' || !open) return;
          setOpen(false);
          menuButton.current?.focus();
        }}
      >
        <a className="kore-site__names" href="#topo">
          {site.names}
        </a>
        {items.length > 0 && (
          <>
            <button
              ref={menuButton}
              type="button"
              className="kore-site__menu-button"
              aria-expanded={open}
              aria-controls={menuId}
              aria-label={open ? t('menu.close') : t('menu.open')}
              onClick={() => setOpen((current) => !current)}
            >
              {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
            <nav
              id={menuId}
              aria-label={t('menu.label')}
              className="kore-site__menu"
              data-open={open}
            >
              <ul className="kore-site__menu-list">
                {items.map((section) => (
                  <li key={section.type}>
                    <a
                      className="kore-site__menu-link"
                      href={`#${sectionAnchor(section.type)}`}
                      onClick={() => setOpen(false)}
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </>
        )}
      </header>
      <main id="conteudo" className="kore-site__main" tabIndex={-1}>
        {children}
      </main>
      <footer className="kore-site__footer">
        <p className="kore-site__footer-names">{site.names}</p>
        {dateLine && <p className="kore-site__footer-line">{dateLine}</p>}
        <p className="kore-site__footer-links">
          <a className="kore-site__made-with" href={KORE_URL}>
            {t('footer.madeWith')}
          </a>
          <a href={TERMS_URL}>{t('footer.terms')}</a>
          <a href={PRIVACY_URL}>{t('footer.privacy')}</a>
        </p>
        {company && <p className="kore-site__company">{company}</p>}
      </footer>
    </div>
  );
}
