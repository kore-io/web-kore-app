/** O site do Kore (Site público RN10): "Feito com Kore", Termos e Privacidade. */
export const KORE_URL = 'https://kore.com.br/';

/**
 * "Feito com Kore" (Site público RN10; Simule RN01): com o simulador ligado, leva ao
 * `/simule?origem=site` (a origem made_with_kore, decisão 135); desligado, ao Kore.
 */
export function madeWithKoreHref(
  enabled: boolean = import.meta.env.VITE_SIMULATOR_ENABLED === 'true',
): string {
  return enabled ? '/simule?origem=site' : KORE_URL;
}
export const TERMS_URL = 'https://kore.com.br/termos';
export const PRIVACY_URL = 'https://kore.com.br/privacidade';

/** A linha da empresa no rodapé, das variáveis do build (decisão 123 D9); vazia, some. */
export function companyLine(env: Partial<ImportMetaEnv> = import.meta.env): string | null {
  const parts = [
    env.VITE_COMPANY_NAME,
    env.VITE_COMPANY_CNPJ && `CNPJ ${env.VITE_COMPANY_CNPJ}`,
    env.VITE_COMPANY_ADDRESS,
  ]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}
