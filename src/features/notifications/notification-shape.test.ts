import { describe, expect, it } from 'vitest';
import { isResponseGroup, isResponseItem } from './notification-shape';

describe('o formato do grupo de resposta (Central RN04)', () => {
  it('o grupo com partyId e nome conta; o payload de cobrança não', () => {
    expect(isResponseGroup({ partyId: 'p1', name: 'Família Moreira', confirmed: 2 })).toBe(true);
    expect(isResponseGroup({ kind: 'payment_confirmed' })).toBe(false);
    expect(isResponseGroup(null)).toBe(false);
    expect(isResponseItem([{ partyId: 'p1', name: 'A' }])).toBe(true);
    expect(isResponseItem([{ partyId: 'p1', name: 'A' }, { kind: 'refund' }])).toBe(false);
    expect(isResponseItem([])).toBe(false);
  });
});
