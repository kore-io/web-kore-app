import { describe, expect, it } from 'vitest';
import fixture from './appearance-contrast.fixture.json';
import { checkAppearance, matchingPalette, ratioText, type BackgroundMode } from './appearance';

const twoDown = (ratio: number) => Math.floor(ratio * 100) / 100;

describe('contraste da Aparência, igual ao da API (RN01, RN04, RN05; decisão 207)', () => {
  it.each(fixture.cases.map((item) => [item.name, item] as const))('%s', (_name, item) => {
    const result = checkAppearance({
      primaryColor: item.primaryColor,
      accentColor: item.accentColor,
      backgroundMode: item.backgroundMode as BackgroundMode,
    });
    expect({
      primaryForeground: result.primaryForeground,
      primaryForegroundRatio: twoDown(result.primaryForegroundRatio),
      primaryBackgroundRatio: twoDown(result.primaryBackgroundRatio),
      accentBackgroundRatio: twoDown(result.accentBackgroundRatio),
      blocked: result.blocked,
      accentLowContrast: result.accentLowContrast,
    }).toEqual(item.expected);
  });

  it('a fixture tem os 27 pares das 9 paletas nos 3 fundos', () => {
    const pairs = fixture.cases.filter((item) => / · (light|cream|dark)$/.test(item.name));
    expect(pairs).toHaveLength(27);
  });

  it('na tela, uma casa para baixo: 4,47 é "4,4:1"', () => {
    expect(ratioText(4.47)).toBe('4,4:1');
    expect(ratioText(5.43)).toBe('5,4:1');
    expect(ratioText(3)).toBe('3,0:1');
  });

  it('a paleta fica só com a primária e o destaque dela, sem diferenciar maiúsculas (RN07)', () => {
    expect(
      matchingPalette({ key: 'terracota', primaryColor: '#a94f37', accentColor: '#7A8B69' }),
    ).toBe('terracota');
    expect(
      matchingPalette({ key: 'terracota', primaryColor: '#A94F38', accentColor: '#7A8B69' }),
    ).toBeNull();
    expect(
      matchingPalette({ key: null, primaryColor: '#A94F37', accentColor: '#7A8B69' }),
    ).toBeNull();
  });
});
