import { useTranslation } from 'react-i18next';
import type { PublicSiteResponse } from '../../shared/api/generated/model';
import { daysUntil, LONG_DATE } from '../../features/site/site-texts';

/**
 * O topo do Início (Penpot, Início com e sem capa, sem data): "Vamos nos casar", os
 * nomes, a data e a cidade com a UF, e a contagem regressiva no fuso do casamento (Seções
 * RN06), quando ligada. Com capa (alt com os nomes, Imagens RN09), os textos em branco sobre
 * a foto escurecida; sem capa,
 * o fundo do site com um filete no destaque.
 */
export function SiteHero({ site, now }: { site: PublicSiteResponse; now: Date }) {
  const { t } = useTranslation('publicSite');
  const place = [site.city, site.state && `(${site.state})`].filter(Boolean).join(' ');
  const line = [site.eventDate && LONG_DATE.format(new Date(`${site.eventDate}T12:00:00Z`)), place]
    .filter(Boolean)
    .join(' · ');
  const showCountdown = site.sections.some((section) => section.type === 'countdown');
  const days = showCountdown
    ? daysUntil({ eventDate: site.eventDate, timezone: site.timezone, now })
    : null;
  const countdown =
    days === null || days < 0
      ? null
      : days === 0
        ? t('hero.today')
        : t('hero.countdown', { count: days });

  return (
    <section
      id="topo"
      className={site.cover ? 'kore-site-hero kore-site-hero--cover' : 'kore-site-hero'}
      aria-labelledby="kore-site-hero-names"
    >
      {site.cover && (
        <>
          <img className="kore-site-hero__image" src={site.cover.url} alt={site.names} />
          <span className="kore-site-hero__scrim" aria-hidden="true" />
        </>
      )}
      <div className="kore-site-hero__content">
        <p className="kore-site-hero__overline">{t('hero.overline')}</p>
        <h1 id="kore-site-hero-names" className="kore-site-hero__names">
          {site.names}
        </h1>
        {line && <p className="kore-site-hero__line">{line}</p>}
        {countdown && <p className="kore-site-hero__countdown">{countdown}</p>}
      </div>
    </section>
  );
}
