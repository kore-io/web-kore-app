import { describe, expect, it, vi } from 'vitest';

// O vi.mock sobe para o topo do arquivo: o registro também (vi.hoisted).
const { loaded, fontMock } = vi.hoisted(() => {
  const loaded: string[] = [];
  return {
    loaded,
    fontMock: (name: string) => () => {
      loaded.push(name);
      return {};
    },
  };
});
vi.mock('@fontsource/cormorant-garamond/400.css', fontMock('cormorant-garamond/400'));
vi.mock('@fontsource/lato/400.css', fontMock('lato/400'));
vi.mock('@fontsource/lato/700.css', fontMock('lato/700'));
vi.mock('@fontsource/playfair-display/400.css', fontMock('playfair-display/400'));
vi.mock('@fontsource/source-sans-3/400.css', fontMock('source-sans-3/400'));
vi.mock('@fontsource/source-sans-3/600.css', fontMock('source-sans-3/600'));
vi.mock('@fontsource/josefin-sans/400.css', fontMock('josefin-sans/400'));
vi.mock('@fontsource/nunito-sans/400.css', fontMock('nunito-sans/400'));
vi.mock('@fontsource/nunito-sans/700.css', fontMock('nunito-sans/700'));
vi.mock('@fontsource/dm-serif-display/400.css', fontMock('dm-serif-display/400'));
vi.mock('@fontsource/inter/400.css', fontMock('inter/400'));
vi.mock('@fontsource/inter/600.css', fontMock('inter/600'));

describe('fontes do site (Aparência RN09)', () => {
  it('o site carrega só os arquivos do par escolhido', async () => {
    const { loadSiteFonts } = await import('./fonts');
    await loadSiteFonts('moderno');
    expect(loaded.sort()).toEqual(['dm-serif-display/400', 'inter/400', 'inter/600']);
  });
});
