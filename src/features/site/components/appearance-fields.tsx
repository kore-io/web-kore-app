import { Alert, Badge, Input, siteFonts } from '@kore-io/design';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SiteEditorAppearanceResponse } from '../../../shared/api/generated/model';
import type { Audience } from '../../guests/hooks/use-active-wedding';
import {
  BACKGROUND_MODES,
  BACKGROUNDS,
  checkAppearance,
  FONT_PAIR_KEYS,
  isHexColor,
  matchingPalette,
  PALETTE_KEYS,
  ratioText,
  STARTER_PALETTES,
  type BackgroundMode,
  type ContrastBlock,
  type FontPairKey,
  type PaletteKey,
} from '../appearance';

export interface AppearanceDraft {
  fontPairKey: FontPairKey;
  paletteKey: PaletteKey | null;
  primaryColor: string;
  accentColor: string;
  backgroundMode: BackgroundMode;
}

export function draftFrom(appearance: SiteEditorAppearanceResponse): AppearanceDraft {
  return {
    fontPairKey: appearance.fontPairKey as FontPairKey,
    paletteKey: (appearance.starterPaletteKey as PaletteKey | null) ?? null,
    primaryColor: appearance.primaryColor.toUpperCase(),
    accentColor: appearance.accentColor.toUpperCase(),
    backgroundMode: appearance.backgroundMode as BackgroundMode,
  };
}

/**
 * O rascunho da Aparência (Aparência do site RN05 a RN08), com o contraste conferido no app
 * e o bloqueio que o servidor devolver (422 CONTRAST_TOO_LOW). Serve ao Editor, que grava
 * pelo PUT, e ao passo 2 do Novo casamento, que manda no POST (D6a).
 */
export function useAppearanceDraft({ initial }: { initial: SiteEditorAppearanceResponse }) {
  const [draft, setDraft] = useState(() => draftFrom(initial));
  const [serverBlock, setServerBlock] = useState<ContrastBlock | null>(null);

  const colorsValid = isHexColor(draft.primaryColor) && isHexColor(draft.accentColor);
  const check = colorsValid
    ? checkAppearance({
        primaryColor: draft.primaryColor,
        accentColor: draft.accentColor,
        backgroundMode: draft.backgroundMode,
      })
    : null;
  const blocked = check?.blocked ?? serverBlock;
  const starterPaletteKey = matchingPalette({
    key: draft.paletteKey,
    primaryColor: draft.primaryColor,
    accentColor: draft.accentColor,
  });

  // A prévia acompanha cada mudança, mas fica na última combinação válida (RN05, RN08).
  const [lastValid, setLastValid] = useState<SiteEditorAppearanceResponse>(initial);
  const candidate: SiteEditorAppearanceResponse | null =
    check && !check.blocked
      ? {
          fontPairKey: draft.fontPairKey,
          starterPaletteKey,
          primaryColor: draft.primaryColor.toUpperCase(),
          accentColor: draft.accentColor.toUpperCase(),
          backgroundMode: draft.backgroundMode,
        }
      : null;
  // Guarda a combinação válida mais nova durante o render (estado derivado, sem efeito).
  if (candidate && JSON.stringify(candidate) !== JSON.stringify(lastValid)) setLastValid(candidate);

  function update(patch: Partial<AppearanceDraft>) {
    setServerBlock(null);
    setDraft((current) => ({ ...current, ...patch }));
  }

  /** O corpo do PUT e do POST: as cores em maiúsculas e a paleta só quando bate. */
  const body = {
    fontPairKey: draft.fontPairKey,
    starterPaletteKey,
    primaryColor: draft.primaryColor.toUpperCase(),
    accentColor: draft.accentColor.toUpperCase(),
    backgroundMode: draft.backgroundMode,
  };

  return {
    draft,
    setDraft,
    update,
    check,
    blocked,
    setServerBlock,
    starterPaletteKey,
    lastValid,
    canSave: colorsValid && blocked === null,
    body,
  };
}

export type AppearanceDraftState = ReturnType<typeof useAppearanceDraft>;

/** Os campos da Aparência (S2): fontes, paleta, cor principal e destaque, e o fundo. */
export function AppearanceFields({
  state,
  sampleNames,
  audience,
}: {
  state: AppearanceDraftState;
  /** "Ana & Marcos", na amostra de cada par de fontes. */
  sampleNames: string;
  audience: Audience;
}) {
  const { t } = useTranslation('site');
  const { draft, update, check, blocked, starterPaletteKey } = state;

  const primaryLegend = check
    ? t(`appearance.primaryLegend.${check.primaryForeground === '#FFFFFF' ? 'white' : 'dark'}`, {
        text: ratioText(check.primaryForegroundRatio),
        background: ratioText(check.primaryBackgroundRatio),
      })
    : undefined;

  return (
    <div className="kore-site-appearance">
      {blocked && (
        <Alert tone="danger" role="alert">
          {t(`appearance.blocked.${blocked}.${audience}`)}
        </Alert>
      )}

      <fieldset className="kore-site-appearance__group">
        <legend className="kore-site-appearance__title">{t('appearance.typography')}</legend>
        <div className="kore-site-appearance__fonts">
          {FONT_PAIR_KEYS.map((key) => {
            const pair = siteFonts[key];
            const selected = draft.fontPairKey === key;
            return (
              <label key={key} className="kore-site-appearance__card" data-selected={selected}>
                <input
                  type="radio"
                  name="font-pair"
                  className="kore-site-appearance__radio"
                  checked={selected}
                  onChange={() => update({ fontPairKey: key })}
                />
                <span className="kore-site-appearance__card-head">
                  <span>{t(`appearance.fonts.${key}`)}</span>
                  {selected && (
                    <Badge tone="success" icon={<Check strokeWidth={2.4} />}>
                      {t('appearance.inUse')}
                    </Badge>
                  )}
                </span>
                <span
                  className="kore-site-appearance__sample"
                  style={{ fontFamily: `'${pair.display}', serif` }}
                  aria-hidden="true"
                >
                  {sampleNames}
                </span>
                <span className="kore-site-appearance__families">
                  {pair.display} · {pair.body}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="kore-site-appearance__group">
        <legend className="kore-site-appearance__title">{t('appearance.colors')}</legend>
        <p className="kore-site-appearance__help">{t(`appearance.colorsHelp.${audience}`)}</p>
        <div
          className="kore-site-appearance__palettes"
          role="radiogroup"
          aria-label={t('appearance.palettesLabel')}
        >
          {PALETTE_KEYS.map((key) => {
            const palette = STARTER_PALETTES[key];
            const selected = starterPaletteKey === key;
            return (
              <label key={key} className="kore-site-appearance__palette" data-selected={selected}>
                <input
                  type="radio"
                  name="palette"
                  className="kore-site-appearance__radio"
                  checked={selected}
                  onChange={() =>
                    update({
                      paletteKey: key,
                      primaryColor: palette.primary,
                      accentColor: palette.accent,
                      backgroundMode: palette.background,
                    })
                  }
                />
                <span
                  className="kore-site-appearance__dot"
                  style={{ backgroundColor: palette.primary }}
                  aria-hidden="true"
                />
                <span
                  className="kore-site-appearance__dot"
                  style={{ backgroundColor: palette.accent }}
                  aria-hidden="true"
                />
                {t(`appearance.palettes.${key}`)}
              </label>
            );
          })}
        </div>

        <ColorField
          label={t('appearance.primary')}
          pickerLabel={t('appearance.colorPicker', { label: t('appearance.primary') })}
          value={draft.primaryColor}
          invalid={!isHexColor(draft.primaryColor) || blocked !== null}
          legend={primaryLegend}
          legendTone={blocked ? 'danger' : 'success'}
          onChange={(primaryColor) => update({ primaryColor })}
        />
        <ColorField
          label={t('appearance.accent')}
          pickerLabel={t('appearance.colorPicker', { label: t('appearance.accent') })}
          value={draft.accentColor}
          invalid={!isHexColor(draft.accentColor)}
          legend={
            check
              ? check.accentLowContrast
                ? `${t('appearance.accentLegend', { ratio: ratioText(check.accentBackgroundRatio) })} · ${t('appearance.accentLow')}`
                : t('appearance.accentLegend', { ratio: ratioText(check.accentBackgroundRatio) })
              : undefined
          }
          legendTone={check?.accentLowContrast ? 'warning' : 'success'}
          onChange={(accentColor) => update({ accentColor })}
        />
      </fieldset>

      <fieldset className="kore-site-appearance__group">
        <legend className="kore-site-appearance__title">{t('appearance.background')}</legend>
        <div className="kore-site-appearance__backgrounds">
          {BACKGROUND_MODES.map((mode) => (
            <label
              key={mode}
              className="kore-site-appearance__card kore-site-appearance__card--row"
              data-selected={draft.backgroundMode === mode}
            >
              <input
                type="radio"
                name="background"
                className="kore-site-appearance__radio"
                checked={draft.backgroundMode === mode}
                onChange={() => update({ backgroundMode: mode })}
              />
              <span
                className="kore-site-appearance__swatch"
                style={{ backgroundColor: BACKGROUNDS[mode].background }}
                aria-hidden="true"
              />
              {t(`appearance.backgrounds.${mode}`)}
            </label>
          ))}
        </div>
        <p className="kore-site-appearance__help">{t('appearance.help')}</p>
      </fieldset>
    </div>
  );
}

function ColorField({
  label,
  pickerLabel,
  value,
  invalid,
  legend,
  legendTone,
  onChange,
}: {
  label: string;
  pickerLabel: string;
  value: string;
  invalid: boolean;
  legend: string | undefined;
  legendTone: 'success' | 'warning' | 'danger';
  onChange: (value: string) => void;
}) {
  const id = `kore-color-${label.replace(/\W+/g, '-')}`;
  const legendId = `${id}-legend`;
  return (
    <div className="kore-site-appearance__color">
      <label htmlFor={id} className="kore-site-appearance__color-label">
        {label}
      </label>
      <div className="kore-site-appearance__color-row">
        <input
          type="color"
          className="kore-site-appearance__picker"
          aria-label={pickerLabel}
          value={isHexColor(value) ? value.toLowerCase() : '#000000'}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
        <Input
          id={id}
          className="kore-site-appearance__hex"
          invalid={invalid}
          maxLength={7}
          autoCapitalize="characters"
          spellCheck={false}
          {...(legend !== undefined && { 'aria-describedby': legendId })}
          value={value}
          onChange={(event) => {
            // Um "#" só, na frente, e o resto em maiúsculas (RN06).
            onChange(`#${event.target.value.replace(/[#\s]/g, '').toUpperCase()}`);
          }}
        />
      </div>
      {legend !== undefined && (
        <p
          id={legendId}
          className={`kore-site-appearance__legend kore-site-appearance__legend--${legendTone}`}
        >
          {legend}
        </p>
      )}
    </div>
  );
}
