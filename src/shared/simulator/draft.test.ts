import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APP_DRAFT_KEY,
  clearDraft,
  decodeDraft,
  emptyDraft,
  encodeDraft,
  isExpired,
  loadDraft,
  parseDraft,
  saveDraft,
  type SimulatorDraft,
} from './draft';

const now = new Date('2026-11-12T12:00:00Z');

function draft(overrides: Partial<SimulatorDraft> = {}): SimulatorDraft {
  return {
    ...emptyDraft({ now, utm: { source: 'instagram' } }),
    names: ['Ana', 'Marcos'],
    eventDate: '2027-05-15',
    city: 'Campinas',
    step: 'style',
    ...overrides,
  };
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('Simule › o rascunho (Simule RN05, RN08)', () => {
  it('o começo: Romântico, Terracota e Creme, sem nomes de exemplo (RN12)', () => {
    expect(emptyDraft({ now })).toMatchObject({
      names: ['', ''],
      fontPairKey: 'romantico',
      starterPaletteKey: 'terracota',
      primaryColor: '#A94F37',
      backgroundMode: 'cream',
      step: 'start',
      origin: 'simulator',
    });
  });

  it('vai e volta pelo fragmento em base64url, com acentos, até 2 KB', () => {
    const original = draft({
      names: ['Ana Júlia', 'Marcos Vinícius'],
      city: 'São José dos Campos',
    });
    const encoded = encodeDraft(original);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeDraft(encoded ?? '')).toEqual(original);
    expect(decodeDraft('x'.repeat(2049))).toBeNull();
    expect(decodeDraft('não-é-base64!')).toBeNull();
  });

  it('um rascunho inválido é ignorado inteiro: tamanho, catálogo, cor, contraste, data, passo', () => {
    expect(parseDraft(draft())).not.toBeNull();
    expect(parseDraft({ ...draft(), names: ['a'.repeat(81), 'Marcos'] })).toBeNull();
    expect(parseDraft({ ...draft(), fontPairKey: 'comic-sans' })).toBeNull();
    expect(parseDraft({ ...draft(), starterPaletteKey: 'neon' })).toBeNull();
    expect(parseDraft({ ...draft(), primaryColor: 'red' })).toBeNull();
    // #777777 no fundo claro: o texto do botão não passa de 4,5:1 (Aparência RN04).
    expect(
      parseDraft({
        ...draft(),
        primaryColor: '#777777',
        backgroundMode: 'light',
        starterPaletteKey: null,
      }),
    ).toBeNull();
    expect(parseDraft({ ...draft(), eventDate: '2027-02-30' })).toBeNull();
    expect(parseDraft({ ...draft(), step: 'pagamento' })).toBeNull();
    expect(parseDraft({ ...draft(), utm: { source: 'a'.repeat(101) } })).toBeNull();
    expect(parseDraft({ ...draft(), utm: { gclid: 'x' } })).toBeNull();
    expect(parseDraft({ ...draft(), v: 2 })).toBeNull();
  });

  it('as cores voltam em maiúsculas', () => {
    expect(parseDraft({ ...draft(), primaryColor: '#a94f37' })?.primaryColor).toBe('#A94F37');
  });

  it('guardado por 7 dias; vencido ou inválido, é apagado', () => {
    saveDraft({ key: APP_DRAFT_KEY, draft: draft() });
    expect(loadDraft({ key: APP_DRAFT_KEY, now })?.names).toEqual(['Ana', 'Marcos']);
    const eightDays = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    expect(loadDraft({ key: APP_DRAFT_KEY, now: eightDays })).toBeNull();
    expect(window.localStorage.getItem(APP_DRAFT_KEY)).toBeNull();
    window.localStorage.setItem(APP_DRAFT_KEY, '{"v":1}');
    expect(loadDraft({ key: APP_DRAFT_KEY, now })).toBeNull();
    expect(window.localStorage.getItem(APP_DRAFT_KEY)).toBeNull();
  });

  it('um savedAt no futuro, além da folga do relógio, conta como vencido', () => {
    const later = (minutes: number) => ({
      ...draft(),
      savedAt: new Date(now.getTime() + minutes * 60 * 1000).toISOString(),
    });
    expect(isExpired({ draft: later(4), now })).toBe(false);
    expect(isExpired({ draft: later(6), now })).toBe(true);
    saveDraft({ key: APP_DRAFT_KEY, draft: later(60 * 24 * 365) });
    expect(loadDraft({ key: APP_DRAFT_KEY, now })).toBeNull();
  });

  it('sem localStorage (navegação privada), não quebra: só não retoma', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => saveDraft({ key: APP_DRAFT_KEY, draft: draft() })).not.toThrow();
    expect(loadDraft({ key: APP_DRAFT_KEY, now })).toBeNull();
    expect(() => clearDraft({ key: APP_DRAFT_KEY })).not.toThrow();
  });
});
