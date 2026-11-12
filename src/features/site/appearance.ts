import fixture from './appearance-contrast.fixture.json';

/** O catálogo da Aparência (RN01) vem da mesma fixture da API (decisão 207). */
export const FONT_PAIR_KEYS = fixture.fontPairKeys as readonly FontPairKey[];
export type FontPairKey = 'romantico' | 'classico' | 'leve' | 'moderno';
export type PaletteKey = keyof typeof fixture.starterPalettes;
export type BackgroundMode = keyof typeof fixture.backgrounds;
export const PALETTE_KEYS = Object.keys(fixture.starterPalettes) as PaletteKey[];
export const BACKGROUND_MODES: readonly BackgroundMode[] = ['light', 'cream', 'dark'];
export const STARTER_PALETTES = fixture.starterPalettes as Record<
  PaletteKey,
  { primary: string; accent: string; background: BackgroundMode }
>;
export const BACKGROUNDS = fixture.backgrounds;

const WHITE = '#FFFFFF';
const DARK_TEXT = '#1F1F1F';
/** Texto sobre a primária precisa de 4,5:1; a primária e o destaque sobre o fundo, de 3:1 (RN04). */
const TEXT_MIN = 4.5;
const SHAPE_MIN = 3;

export type ContrastBlock = 'primary_foreground' | 'primary_background';

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function channel(value: number) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa da WCAG 2.x (linearização com limiar 0,04045, como na fixture). */
export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * A conta da RN04, igual à da API: o texto sobre a primária (branco ou #1F1F1F, o de mais
 * contraste; no empate, branco), a primária e o destaque sobre o fundo. Compara sem
 * arredondar; com as duas regras falhando, vale o texto sobre a primária.
 */
export function checkAppearance({
  primaryColor,
  accentColor,
  backgroundMode,
}: {
  primaryColor: string;
  accentColor: string;
  backgroundMode: BackgroundMode;
}) {
  const background = BACKGROUNDS[backgroundMode].background;
  const onWhite = contrastRatio(primaryColor, WHITE);
  const onDark = contrastRatio(primaryColor, DARK_TEXT);
  const primaryForeground = onDark > onWhite ? DARK_TEXT : WHITE;
  const primaryForegroundRatio = Math.max(onWhite, onDark);
  const primaryBackgroundRatio = contrastRatio(primaryColor, background);
  const accentBackgroundRatio = contrastRatio(accentColor, background);
  const blocked: ContrastBlock | null =
    primaryForegroundRatio < TEXT_MIN
      ? 'primary_foreground'
      : primaryBackgroundRatio < SHAPE_MIN
        ? 'primary_background'
        : null;
  return {
    primaryForeground,
    primaryForegroundRatio,
    primaryBackgroundRatio,
    accentBackgroundRatio,
    blocked,
    accentLowContrast: accentBackgroundRatio < SHAPE_MIN,
  };
}

/** A razão na tela: uma casa, sempre para baixo (nunca "4,5:1" para 4,47; RN04). */
export function ratioText(ratio: number): string {
  return `${(Math.floor(ratio * 10) / 10).toFixed(1).replace('.', ',')}:1`;
}

/** A paleta de partida fica enquanto a primária e o destaque são os dela (RN07). */
export function matchingPalette({
  key,
  primaryColor,
  accentColor,
}: {
  key: PaletteKey | null;
  primaryColor: string;
  accentColor: string;
}): PaletteKey | null {
  if (!key) return null;
  const palette = STARTER_PALETTES[key];
  return palette.primary.toUpperCase() === primaryColor.toUpperCase() &&
    palette.accent.toUpperCase() === accentColor.toUpperCase()
    ? key
    : null;
}
