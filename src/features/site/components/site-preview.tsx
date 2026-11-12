import { siteFonts } from '@kore-io/design';
import { useTranslation } from 'react-i18next';
import type { SiteEditorResponse } from '../../../shared/api/generated/model';
import fixture from '../appearance-contrast.fixture.json';
import { EDITOR_SECTIONS } from '../sections';
import { countdownText, previewDateLine } from '../site-texts';

type Background = keyof typeof fixture.backgrounds;

/**
 * A prévia-resumo ao lado do Editor (decisão 214(2)): os nomes, a data e a cidade, a
 * contagem, os títulos das seções ligadas e com conteúdo, com o fundo e as fontes da
 * Aparência. Sem o Confirmar presença (F4), Presentes nem Mural. "Visão de visitante".
 */
export function SitePreview({ site, now = new Date() }: { site: SiteEditorResponse; now?: Date }) {
  const { t } = useTranslation('site');
  const background =
    fixture.backgrounds[(site.appearance.backgroundMode as Background) ?? 'cream'] ??
    fixture.backgrounds.cream;
  const fonts =
    siteFonts[site.appearance.fontPairKey as keyof typeof siteFonts] ?? siteFonts.romantico;
  const countdownSection = site.sections.find((section) => section.type === 'countdown');
  const countdown =
    countdownSection?.enabled === true
      ? countdownText({ t, eventDate: site.eventDate, timezone: site.timezone, now })
      : null;
  const dateLine = previewDateLine({ eventDate: site.eventDate, city: site.city });
  const titles = EDITOR_SECTIONS.flatMap(({ key }) => {
    const section = site.sections.find((item) => item.type === key);
    if (!section || key === 'countdown' || !section.enabled || section.empty) return [];
    return [section.title ?? t(`sections.names.${key}`)];
  });

  return (
    <figure className="kore-editor-preview">
      <div
        className="kore-editor-preview__card"
        style={{
          backgroundColor: background.background,
          color: background.foreground,
          borderColor: background.border,
          fontFamily: `'${fonts.body}', sans-serif`,
        }}
      >
        <p className="kore-editor-preview__overline" style={{ color: background.mutedForeground }}>
          {t('preview.title')}
        </p>
        <p
          className="kore-editor-preview__names"
          style={{ fontFamily: `'${fonts.display}', serif` }}
        >
          {site.partners.map((partner) => partner.name.split(' ')[0]).join(' & ')}
        </p>
        {dateLine && <p className="kore-editor-preview__date">{dateLine}</p>}
        {countdown && (
          <p
            className="kore-editor-preview__countdown"
            style={{ color: background.mutedForeground }}
          >
            {countdown}
          </p>
        )}
        {titles.length > 0 && (
          <ul className="kore-editor-preview__sections">
            {titles.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        )}
      </div>
      <figcaption className="kore-editor-preview__caption">{t('preview.caption')}</figcaption>
    </figure>
  );
}
