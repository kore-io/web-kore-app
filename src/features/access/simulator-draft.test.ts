import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyDraft, encodeDraft } from '../../shared/simulator/draft';
import {
  captureSimulatorDraft,
  clearSimulatorDraft,
  storedSimulatorDraft,
} from './simulator-draft';

const now = new Date('2026-11-12T12:00:00Z');

function arriveWith({ savedAt }: { savedAt: string }) {
  const draft = {
    ...emptyDraft({ now: new Date(savedAt) }),
    names: ['Ana', 'Marcos'] as [string, string],
  };
  window.history.replaceState(null, '', `/cadastro#simule=${encodeDraft(draft) ?? ''}`);
  return draft;
}

describe('rascunho do Simule no app (Simule RN08 e caso de borda do localStorage)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearSimulatorDraft();
    window.localStorage.clear();
  });

  it('com o localStorage bloqueado, o rascunho do fragmento fica na memória da página', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    arriveWith({ savedAt: '2026-11-11T12:00:00Z' });

    expect(captureSimulatorDraft({ now })).toBe(true);
    // O fragmento sai da URL, e o rascunho continua até o fim do cadastro.
    expect(window.location.hash).toBe('');
    expect(storedSimulatorDraft({ now })?.names).toEqual(['Ana', 'Marcos']);

    // Depois do 201, sai também da memória (RN10).
    clearSimulatorDraft();
    expect(storedSimulatorDraft({ now })).toBeNull();
  });

  it('a cópia em memória vence com os 7 dias, como a do localStorage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    arriveWith({ savedAt: '2026-11-11T12:00:00Z' });
    captureSimulatorDraft({ now });
    expect(storedSimulatorDraft({ now: new Date('2026-11-19T12:00:00Z') })).toBeNull();
  });

  it('com o localStorage, o rascunho é lido de lá', () => {
    arriveWith({ savedAt: '2026-11-11T12:00:00Z' });
    captureSimulatorDraft({ now });
    expect(window.localStorage.getItem('kore.simulatorDraft')).toContain('Ana');
    expect(storedSimulatorDraft({ now })?.names).toEqual(['Ana', 'Marcos']);
  });
});
