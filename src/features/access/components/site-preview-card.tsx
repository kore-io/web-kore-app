import type { SiteBackgroundName, SiteColorsName, SiteFontsName } from '@kore-io/design';
import { useTranslation } from 'react-i18next';

export interface SitePreviewCardProps {
  couple: string;
  /** Data por extenso e cidade, já formatadas (ex.: "14 de novembro de 2026 · Campinas"). */
  details: string;
  /** Aparência escolhida para o site; sem ela, o padrão do DS. */
  theme?: { fonts?: SiteFontsName; colors?: SiteColorsName; background?: SiteBackgroundName };
}

/**
 * Prévia do site no Convite do casal (Penpot): cartão no tema do site do casal (tokens
 * --site-* trocados pelos atributos data-site-* do DS), com os nomes, a data e a pílula
 * de confirmar presença, só ilustrativa.
 */
export function SitePreviewCard({ couple, details, theme = {} }: SitePreviewCardProps) {
  const { t } = useTranslation('access');
  return (
    <div
      className="kore-site-preview"
      {...(theme.fonts && { 'data-site-fonts': theme.fonts })}
      {...(theme.colors && { 'data-site-colors': theme.colors })}
      {...(theme.background && { 'data-site-background': theme.background })}
    >
      <p className="kore-site-preview__label">{t('coupleInvite.previewLabel')}</p>
      <p className="kore-site-preview__couple">{couple}</p>
      <p className="kore-site-preview__details">{details}</p>
      <span className="kore-site-preview__rsvp" aria-hidden="true">
        {t('coupleInvite.rsvp')}
      </span>
    </div>
  );
}
