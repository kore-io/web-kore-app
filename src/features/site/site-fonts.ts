/**
 * As fontes dos 4 pares da Aparência, servidas pelo próprio Kore (@fontsource, decisão
 * 130). O Editor carrega os 4 para a escolha e a prévia ao vivo (Aparência RN09); o
 * Romântico já vem com o app (Cormorant Garamond e Lato).
 */
export function loadEditorFonts(): Promise<unknown> {
  return Promise.all([
    import('@fontsource/playfair-display/400.css'),
    import('@fontsource/source-sans-3/400.css'),
    import('@fontsource/josefin-sans/400.css'),
    import('@fontsource/nunito-sans/400.css'),
    import('@fontsource/dm-serif-display/400.css'),
    import('@fontsource/inter/400.css'),
    import('@fontsource/lato/400.css'),
    import('@fontsource/cormorant-garamond/400.css'),
  ]);
}
