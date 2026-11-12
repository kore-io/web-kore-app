import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  checkAppearance,
  type BackgroundMode,
  type FontPairKey,
} from '../../features/site/appearance';
import { LONG_DATE } from '../../features/site/site-texts';
import { applySiteTheme } from '../theme';

/**
 * A prévia do Simule (Simule RN02; Penpot "Nosso casamento"; decisão 226(1)): só o que o
 * casal digitou, com blocos vazios no lugar do resto (RN12), a foto na memória da aba, e
 * o botão de exemplo "Abrir no Google Maps" na cor principal. As cores e as fontes vêm por
 * variável no próprio cartão.
 */
export function SimulatorPreview({
  names,
  eventDate,
  city,
  fontPairKey,
  primaryColor,
  accentColor,
  backgroundMode,
  photoUrl,
}: {
  names: [string, string];
  eventDate: string | null;
  city: string;
  fontPairKey: FontPairKey;
  primaryColor: string;
  accentColor: string;
  backgroundMode: BackgroundMode;
  photoUrl: string | null;
}) {
  const { t } = useTranslation('publicSite');
  const card = useRef<HTMLDivElement>(null);
  const { primaryForeground } = checkAppearance({ primaryColor, accentColor, backgroundMode });

  useEffect(() => {
    if (!card.current) return;
    applySiteTheme({
      appearance: { fontPairKey, primaryColor, primaryForeground, accentColor, backgroundMode },
      root: card.current,
    });
  }, [fontPairKey, primaryColor, primaryForeground, accentColor, backgroundMode]);

  const [mine, partner] = names.map((name) => name.trim());
  const coupleNames = mine && partner ? `${mine} & ${partner}` : '';
  const line = [eventDate && LONG_DATE.format(new Date(`${eventDate}T12:00:00Z`)), city.trim()]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="kore-simule-preview" aria-hidden="true">
      <div ref={card} className="kore-simule-preview__card">
        {photoUrl && <img className="kore-simule-preview__photo" src={photoUrl} alt="" />}
        <p className="kore-simule-preview__overline">{t('simulator.preview.overline')}</p>
        {coupleNames ? (
          <p className="kore-simule-preview__names">{coupleNames}</p>
        ) : (
          <span className="kore-simule-preview__blank kore-simule-preview__blank--names" />
        )}
        {line ? (
          <p className="kore-simule-preview__line">{line}</p>
        ) : (
          <span className="kore-simule-preview__blank kore-simule-preview__blank--line" />
        )}
        <span className="kore-simule-preview__button">{t('simulator.preview.button')}</span>
      </div>
    </div>
  );
}
