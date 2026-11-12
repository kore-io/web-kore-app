import type { SiteBackgroundName, SiteColorsName, SiteFontsName } from '@kore-io/design';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
// Corpo do tema padrão do site (romântico: Lato), usado no rótulo, na data e na pílula; o
// título usa a Cormorant, já carregada pelo app. Os outros temas entram com o site.
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';

export interface SitePreviewCardProps {
  couple: string;
  /** Data por extenso e cidade, já formatadas (ex.: "14 de novembro de 2026 · Campinas"). */
  details: string;
  /** Aparência escolhida para o site; sem ela, o padrão do DS. */
  theme?: { fonts?: SiteFontsName; colors?: SiteColorsName; background?: SiteBackgroundName };
  /** Cor própria (o Outra cor do Simule): as variáveis por cima da paleta do tema. */
  customColors?: { primary: string; primaryForeground: string; accent: string };
}

/**
 * Prévia do site no Convite do casal (Penpot): cartão no tema do site do casal (tokens
 * --site-* trocados pelos atributos data-site-* do DS), com os nomes, a data e a pílula
 * de confirmar presença, só ilustrativa.
 */
export function SitePreviewCard({
  couple,
  details,
  theme = {},
  customColors,
}: SitePreviewCardProps) {
  const { t } = useTranslation('access');
  return (
    <div
      className="kore-site-preview"
      {...(customColors && {
        style: {
          '--site-primary': customColors.primary,
          '--site-primary-foreground': customColors.primaryForeground,
          '--site-accent': customColors.accent,
        } as CSSProperties,
      })}
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
