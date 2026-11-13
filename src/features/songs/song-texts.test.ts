import { describe, expect, it } from 'vitest';
import { suggestedAtText } from './song-texts';

const SP = 'America/Sao_Paulo';

describe('a data da sugestão (Música RN05; decisão 246)', () => {
  it('dia/mês às hora e minuto no fuso do casamento; na hora cheia, só a hora', () => {
    expect(suggestedAtText({ at: '2026-09-12T23:14:00Z', timezone: SP })).toBe('12/09 às 20h14');
    expect(suggestedAtText({ at: '2026-09-02T12:00:00Z', timezone: SP })).toBe('02/09 às 9h');
    expect(suggestedAtText({ at: '2026-09-02T12:05:00Z', timezone: SP })).toBe('02/09 às 9h05');
  });

  it('no fuso do casamento, e não no do aparelho: a mesma hora em outro fuso', () => {
    // 01h30 UTC do dia 13 é 22h30 do dia 12 em São Paulo e 21h30 em Manaus.
    expect(suggestedAtText({ at: '2026-09-13T01:30:00Z', timezone: SP })).toBe('12/09 às 22h30');
    expect(suggestedAtText({ at: '2026-09-13T01:30:00Z', timezone: 'America/Manaus' })).toBe(
      '12/09 às 21h30',
    );
  });
});
