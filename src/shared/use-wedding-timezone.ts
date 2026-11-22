import { useSiteControllerGetV1 } from './api/generated/site/site';

/**
 * O fuso do casamento, para as datas absolutas das telas, como o .xlsx (decisões 246 e
 * 248): vem do GET …/site, que o layout já deixa em cache. Enquanto não chega, nulo (o
 * padrão, America/Sao_Paulo).
 */
export function useWeddingTimezone({
  weddingId,
}: {
  weddingId: string | null | undefined;
}): string | null {
  const site = useSiteControllerGetV1(weddingId ?? '', { query: { enabled: Boolean(weddingId) } });
  return site.data?.timezone ?? null;
}
