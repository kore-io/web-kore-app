import { describe, expect, it } from 'vitest';
import { suggestedAtText } from './song-texts';

describe('a data da sugestão (Música RN05)', () => {
  it('dia/mês às hora e minuto; na hora cheia, só a hora', () => {
    expect(suggestedAtText({ at: new Date(2026, 8, 12, 20, 14).toISOString() })).toBe(
      '12/09 às 20h14',
    );
    expect(suggestedAtText({ at: new Date(2026, 8, 2, 9, 0).toISOString() })).toBe('02/09 às 9h');
    expect(suggestedAtText({ at: new Date(2026, 8, 2, 9, 5).toISOString() })).toBe('02/09 às 9h05');
  });
});
