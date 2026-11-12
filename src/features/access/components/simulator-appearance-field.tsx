import { siteColors, siteFonts } from '@kore-io/design';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { SimulatorDraft } from '../../../shared/simulator/draft';

/**
 * A Aparência do simulador no Dados do casamento (Penpot, "Dados do casamento — com
 * rascunho"; Cadastro RN12; decisão 226(6)): as duas bolinhas (a cor principal e o
 * destaque), "Terracota · Romântico" ou, com cor própria, "Cor própria · Romântico", e a
 * ajuda. Só para conferir: a foto não vem (Simule RN04).
 */
export function SimulatorAppearanceField({ draft }: { draft: SimulatorDraft }) {
  const { t } = useTranslation('access');
  const labelId = useId();
  const hintId = useId();
  const palette = draft.starterPaletteKey
    ? siteColors[draft.starterPaletteKey].label
    : t('weddingDetails.ownColor');
  return (
    <div
      className="kore-simulator-appearance"
      role="group"
      aria-labelledby={labelId}
      aria-describedby={hintId}
    >
      <p id={labelId} className="kore-simulator-appearance__label">
        {t('weddingDetails.simulatorAppearance')}
      </p>
      <div className="kore-simulator-appearance__box">
        <span className="kore-simulator-appearance__dots" aria-hidden="true">
          <span
            className="kore-simulator-appearance__dot"
            style={{ backgroundColor: draft.primaryColor }}
          />
          <span
            className="kore-simulator-appearance__dot"
            style={{ backgroundColor: draft.accentColor }}
          />
        </span>
        <span className="kore-simulator-appearance__text">
          {palette} · {siteFonts[draft.fontPairKey].label}
        </span>
      </div>
      <p id={hintId} className="kore-simulator-appearance__hint">
        {t('weddingDetails.simulatorAppearanceHint')}
      </p>
    </div>
  );
}
