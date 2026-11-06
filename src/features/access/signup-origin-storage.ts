import { CreateWeddingBodySignupSource } from '../../shared/api/generated/model';

/**
 * Origem do cadastro guardada no aparelho (decisões 135 e 169(2)): as UTM e o
 * ?origem=site (o "Feito com Kore" do rodapé dos sites) da primeira chegada, por 30 dias,
 * para irem no POST /v1/weddings. O simulator entra quando o Simule existir.
 */
export const SIGNUP_ORIGIN_STORAGE_KEY = 'kore.signupOrigin';

const VALID_FOR_MS = 30 * 24 * 60 * 60 * 1000;
const UTM_MAX_LENGTH = 200;

export interface SignupOrigin {
  signupSource?: CreateWeddingBodySignupSource;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

interface StoredOrigin extends SignupOrigin {
  savedAt: string;
}

function read(): StoredOrigin | undefined {
  try {
    const raw = window.localStorage.getItem(SIGNUP_ORIGIN_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<StoredOrigin>;
    return typeof parsed.savedAt === 'string' ? (parsed as StoredOrigin) : undefined;
  } catch {
    return undefined;
  }
}

/** A origem guardada, se ainda vale (30 dias). */
export function storedSignupOrigin({ now = new Date() }: { now?: Date } = {}): SignupOrigin {
  const stored = read();
  if (!stored) return {};
  const age = now.getTime() - new Date(stored.savedAt).getTime();
  if (age < 0 || age >= VALID_FOR_MS) return {};
  // O aparelho pode ter qualquer coisa guardada: só volta o que o POST aceita, para um valor
  // estragado não dar 400 em todo cadastro por 30 dias.
  const signupSource = validSignupSource({ value: stored.signupSource });
  const utmSource = validUtm({ value: stored.utmSource });
  const utmMedium = validUtm({ value: stored.utmMedium });
  const utmCampaign = validUtm({ value: stored.utmCampaign });
  return {
    ...(signupSource && { signupSource }),
    ...(utmSource && { utmSource }),
    ...(utmMedium && { utmMedium }),
    ...(utmCampaign && { utmCampaign }),
  };
}

function validSignupSource({ value }: { value: unknown }) {
  return Object.values(CreateWeddingBodySignupSource).find((source) => source === value);
}

function validUtm({ value }: { value: unknown }) {
  return typeof value === 'string' && value.trim() !== '' && value.length <= UTM_MAX_LENGTH
    ? value
    : undefined;
}

function utm({ value }: { value: string | null }) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, UTM_MAX_LENGTH) : undefined;
}

/** A origem que a URL traz (utm_* e origem=site), ou vazia. */
export function originFromUrl({ params }: { params: URLSearchParams }): SignupOrigin {
  const utmSource = utm({ value: params.get('utm_source') });
  const utmMedium = utm({ value: params.get('utm_medium') });
  const utmCampaign = utm({ value: params.get('utm_campaign') });
  return {
    ...(params.get('origem') === 'site' && { signupSource: 'made_with_kore' as const }),
    ...(utmSource && { utmSource }),
    ...(utmMedium && { utmMedium }),
    ...(utmCampaign && { utmCampaign }),
  };
}

/** Guarda a origem da chegada, se houver e se não houver outra valendo (a primeira vale). */
export function saveSignupOrigin({
  origin,
  now = new Date(),
}: {
  origin: SignupOrigin;
  now?: Date;
}) {
  if (Object.keys(origin).length === 0 || Object.keys(storedSignupOrigin({ now })).length > 0)
    return;
  try {
    window.localStorage.setItem(
      SIGNUP_ORIGIN_STORAGE_KEY,
      JSON.stringify({ ...origin, savedAt: now.toISOString() } satisfies StoredOrigin),
    );
  } catch {
    // Sem localStorage: o cadastro segue com a origem direct.
  }
}

/** Parâmetros da URL que pertencem à origem do cadastro (saem da URL depois de guardados). */
export const SIGNUP_ORIGIN_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'origem'] as const;
