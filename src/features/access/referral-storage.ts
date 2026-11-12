/**
 * Código de indicação guardado no aparelho (RN08 do Cadastro, decisão 165): o link
 * kore.com.br/i/{código} chega ao app como ?indicacao={código}; vale o primeiro link aberto
 * e por 30 dias.
 */
export const REFERRAL_STORAGE_KEY = 'kore.referral';

const VALID_FOR_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_PATTERN = /^[a-z0-9-]{1,100}$/;

interface StoredReferral {
  code: string;
  savedAt: string;
}

function read(): StoredReferral | undefined {
  try {
    const raw = window.localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<StoredReferral>;
    return typeof parsed.code === 'string' && typeof parsed.savedAt === 'string'
      ? { code: parsed.code, savedAt: parsed.savedAt }
      : undefined;
  } catch {
    return undefined;
  }
}

/** O código guardado, se ainda vale (30 dias). */
export function storedReferralCode({ now = new Date() }: { now?: Date } = {}) {
  const stored = read();
  if (!stored) return undefined;
  const age = now.getTime() - new Date(stored.savedAt).getTime();
  return age >= 0 && age < VALID_FOR_MS ? stored.code : undefined;
}

function normalize({ code }: { code: string }) {
  const normalized = code.trim().toLowerCase();
  return CODE_PATTERN.test(normalized) ? normalized : undefined;
}

/**
 * O código que vale agora: o guardado (o primeiro link vale) ou, se não houver, o do link
 * que acabou de abrir a página (?indicacao=), antes de ele ser guardado.
 */
export function currentReferralCode({
  urlCode,
  now = new Date(),
}: {
  urlCode: string | null;
  now?: Date;
}) {
  return (
    storedReferralCode({ now }) ?? (urlCode === null ? undefined : normalize({ code: urlCode }))
  );
}

/** Guarda o código do link, se for válido e não houver outro valendo (o primeiro vale). */
export function saveReferralCode({ code, now = new Date() }: { code: string; now?: Date }) {
  const normalized = normalize({ code });
  if (normalized === undefined || storedReferralCode({ now })) return;
  try {
    window.localStorage.setItem(
      REFERRAL_STORAGE_KEY,
      JSON.stringify({ code: normalized, savedAt: now.toISOString() } satisfies StoredReferral),
    );
  } catch {
    // Sem localStorage (navegação privada restrita): o cadastro segue sem a indicação.
  }
}
