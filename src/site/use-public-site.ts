import { useQuery } from '@tanstack/react-query';
import { publicSiteControllerGetV1 } from '../shared/api/generated/sites/sites';
import { apiErrorCode } from '../shared/api/http-client';

/** O que a página mostra para o endereço (Site público RN04 e RN12). */
export type SiteState = 'loading' | 'ready' | 'notFound' | 'draft' | 'error';

/**
 * O site pelo `GET /v1/sites/{slug}`, com os cookies da API (`credentials: 'include'`, o
 * do grupo e o da prévia). `404 SITE_DRAFT` é o rascunho e `404 SITE_NOT_FOUND`, o
 * endereço que não existe; rede e 5xx, o erro com Tentar de novo.
 */
export function usePublicSite({ slug }: { slug: string }) {
  const query = useQuery({
    queryKey: ['public-site', slug],
    queryFn: () => publicSiteControllerGetV1(slug),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const code = apiErrorCode({ error: query.error });
  const state: SiteState = query.isPending
    ? 'loading'
    : query.isSuccess
      ? 'ready'
      : code === 'SITE_DRAFT'
        ? 'draft'
        : code === 'SITE_NOT_FOUND'
          ? 'notFound'
          : 'error';
  return { state, site: query.data, retry: () => void query.refetch() };
}
