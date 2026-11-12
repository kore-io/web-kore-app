import { handleSitePage, type SitePageEnv } from '../../../../src/site/edge/site-page';

/**
 * kore.com.br/<slug>/grupo/<token> (Site público RN06): o mesmo HTML; o token fica no
 * caminho para o site trocar pelo cookie e não é lido nem registrado aqui.
 */
export const onRequestGet = ({ request, env }: { request: Request; env: SitePageEnv }) =>
  handleSitePage({ request, env });
