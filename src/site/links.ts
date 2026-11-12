/** O site do Kore (Site público RN10): "Feito com Kore", Termos e Privacidade. */
export const KORE_URL = 'https://kore.com.br/';
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
