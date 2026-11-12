/**
 * Só as fontes do par escolhido (Aparência RN09), servidas pelo próprio Kore (@fontsource,
 * decisão 130): o site carrega um par, e não os quatro.
 */
const PAIRS: Record<string, () => Promise<unknown>> = {
  romantico: () =>
    Promise.all([
      import('@fontsource/cormorant-garamond/400.css'),
      import('@fontsource/lato/400.css'),
      import('@fontsource/lato/700.css'),
    ]),
  classico: () =>
    Promise.all([
      import('@fontsource/playfair-display/400.css'),
      import('@fontsource/source-sans-3/400.css'),
      import('@fontsource/source-sans-3/600.css'),
    ]),
  leve: () =>
    Promise.all([
      import('@fontsource/josefin-sans/400.css'),
      import('@fontsource/nunito-sans/400.css'),
      import('@fontsource/nunito-sans/700.css'),
    ]),
  moderno: () =>
    Promise.all([
      import('@fontsource/dm-serif-display/400.css'),
      import('@fontsource/inter/400.css'),
      import('@fontsource/inter/600.css'),
    ]),
};

export function loadSiteFonts(fontPairKey: string): Promise<unknown> {
  return (PAIRS[fontPairKey] ?? PAIRS.romantico)?.() ?? Promise.resolve();
}
