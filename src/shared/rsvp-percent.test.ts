import { describe, expect, it } from 'vitest';
import { formatRsvpPercent } from './rsvp-percent';

describe('a taxa de resposta (decisão 258)', () => {
  it.each([
    [0, '0%'],
    [0.01, '1%'],
    [0.5, '1%'],
    [0.99, '1%'],
    [1, '1%'],
    [61.5, '62%'],
    [62.49, '62%'],
    [66.67, '67%'],
    [99, '99%'],
    [99.01, '99%'],
    [99.5, '99%'],
    [99.99, '99%'],
    [100, '100%'],
  ])('%s vira %s', (percent, text) => {
    expect(formatRsvpPercent({ percent })).toBe(text);
  });
});
