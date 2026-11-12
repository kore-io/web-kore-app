import {
  BACKGROUND_MODES,
  checkAppearance,
  FONT_PAIR_KEYS,
  isHexColor,
  PALETTE_KEYS,
  type BackgroundMode,
  type FontPairKey,
  type PaletteKey,
} from '../../features/site/appearance';

/**
 * O rascunho do Simule (Simule RN05 e RN08): sem a foto, que fica só na memória da aba.
 * O site guarda em `kore.simulator` (kore.com.br) e leva ao app pelo fragmento da URL,
 * que o guarda em `kore.simulatorDraft`. Vale 7 dias a partir da última mudança.
 */
export interface SimulatorDraft {
  v: 1;
  names: [string, string];
  /** aaaa-mm-dd, ou nulo com `noDate` ("Ainda não sabemos a data") ou sem resposta. */
  eventDate: string | null;
  noDate: boolean;
  city: string;
  fontPairKey: FontPairKey;
  starterPaletteKey: PaletteKey | null;
  primaryColor: string;
  accentColor: string;
  backgroundMode: BackgroundMode;
  step: SimulatorStep;
  origin: 'simulator' | 'made_with_kore';
  utm: { source?: string; medium?: string; campaign?: string };
  savedAt: string;
}

export type SimulatorStep = 'start' | 'names' | 'when' | 'style' | 'photo' | 'done';
export const SIMULATOR_STEPS: readonly SimulatorStep[] = [
  'start',
  'names',
  'when',
  'style',
  'photo',
  'done',
];

export const SITE_DRAFT_KEY = 'kore.simulator';
export const APP_DRAFT_KEY = 'kore.simulatorDraft';
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** O limite do rascunho no fragmento (RN08). */
export const DRAFT_MAX_BYTES = 2048;
const NAME_MAX = 80;
const UTM_MAX = 100;

/** O começo: Romântico, Terracota e Creme (Aparência RN02), sem nomes de exemplo (RN12). */
export function emptyDraft({
  now,
  origin = 'simulator',
  utm = {},
}: {
  now: Date;
  origin?: SimulatorDraft['origin'];
  utm?: SimulatorDraft['utm'];
}): SimulatorDraft {
  return {
    v: 1,
    names: ['', ''],
    eventDate: null,
    noDate: false,
    city: '',
    fontPairKey: 'romantico',
    starterPaletteKey: 'terracota',
    primaryColor: '#A94F37',
    accentColor: '#7A8B69',
    backgroundMode: 'cream',
    step: 'start',
    origin,
    utm,
    savedAt: now.toISOString(),
  };
}

const isString = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max;

const isDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

/**
 * Confere o rascunho que veio de fora (o `localStorage` ou o fragmento): os tamanhos, as
 * chaves do catálogo, o formato e o contraste das cores pela mesma conta da Aparência.
 * Qualquer coisa errada e o rascunho inteiro é ignorado (nulo), sem aviso (RN08).
 */
export function parseDraft(value: unknown): SimulatorDraft | null {
  if (typeof value !== 'object' || value === null) return null;
  const draft = value as Record<string, unknown>;
  const names = draft.names;
  const utm = (draft.utm ?? {}) as Record<string, unknown>;
  if (draft.v !== 1) return null;
  if (
    !Array.isArray(names) ||
    names.length !== 2 ||
    !names.every((name) => isString(name, NAME_MAX))
  )
    return null;
  if (draft.eventDate !== null && !isDate(draft.eventDate)) return null;
  if (typeof draft.noDate !== 'boolean') return null;
  if (!isString(draft.city, NAME_MAX)) return null;
  if (!FONT_PAIR_KEYS.includes(draft.fontPairKey as FontPairKey)) return null;
  if (
    draft.starterPaletteKey !== null &&
    !PALETTE_KEYS.includes(draft.starterPaletteKey as PaletteKey)
  )
    return null;
  if (!BACKGROUND_MODES.includes(draft.backgroundMode as BackgroundMode)) return null;
  if (typeof draft.primaryColor !== 'string' || !isHexColor(draft.primaryColor)) return null;
  if (typeof draft.accentColor !== 'string' || !isHexColor(draft.accentColor)) return null;
  if (!SIMULATOR_STEPS.includes(draft.step as SimulatorStep)) return null;
  if (draft.origin !== 'simulator' && draft.origin !== 'made_with_kore') return null;
  if (typeof utm !== 'object' || Array.isArray(utm)) return null;
  for (const key of Object.keys(utm)) {
    if (!['source', 'medium', 'campaign'].includes(key) || !isString(utm[key], UTM_MAX))
      return null;
  }
  if (typeof draft.savedAt !== 'string' || Number.isNaN(Date.parse(draft.savedAt))) return null;
  const check = checkAppearance({
    primaryColor: draft.primaryColor,
    accentColor: draft.accentColor,
    backgroundMode: draft.backgroundMode as BackgroundMode,
  });
  if (check.blocked) return null;
  return {
    v: 1,
    names: [names[0] as string, names[1] as string],
    eventDate: draft.eventDate as string | null,
    noDate: draft.noDate,
    city: draft.city,
    fontPairKey: draft.fontPairKey as FontPairKey,
    starterPaletteKey: draft.starterPaletteKey as PaletteKey | null,
    primaryColor: draft.primaryColor.toUpperCase(),
    accentColor: draft.accentColor.toUpperCase(),
    backgroundMode: draft.backgroundMode as BackgroundMode,
    step: draft.step as SimulatorStep,
    origin: draft.origin,
    utm: utm as SimulatorDraft['utm'],
    savedAt: draft.savedAt,
  };
}

/** Vencido: mais de 7 dias desde a última mudança (RN05). */
export function isExpired({ draft, now }: { draft: SimulatorDraft; now: Date }): boolean {
  return now.getTime() - Date.parse(draft.savedAt) > DRAFT_TTL_MS;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** O rascunho no fragmento: JSON em base64url, até 2 KB (RN08); maior, nulo. */
export function encodeDraft(draft: SimulatorDraft): string | null {
  const encoded = toBase64Url(JSON.stringify(draft));
  return encoded.length <= DRAFT_MAX_BYTES ? encoded : null;
}

export function decodeDraft(encoded: string): SimulatorDraft | null {
  if (encoded.length > DRAFT_MAX_BYTES) return null;
  try {
    return parseDraft(JSON.parse(fromBase64Url(encoded)));
  } catch {
    return null;
  }
}

/**
 * O rascunho guardado no navegador, com tratamento de erro: sem `localStorage` (navegação
 * privada), o simulador funciona e só não retoma (RN05). Vencido ou inválido, é apagado.
 */
export function loadDraft({ key, now }: { key: string; now: Date }): SimulatorDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const draft = parseDraft(JSON.parse(raw));
    if (!draft || isExpired({ draft, now })) {
      window.localStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function saveDraft({ key, draft }: { key: string; draft: SimulatorDraft }): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Sem armazenamento, o simulador segue sem retomar.
  }
}

export function clearDraft({ key }: { key: string }): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Idem.
  }
}
