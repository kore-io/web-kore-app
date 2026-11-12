import { handleSitePage, type SitePageEnv } from '../../../src/site/edge/site-page';

/**
 * kore.com.br/<slug>/confirmar-presenca (Confirmar presença RN01; decisão 232(1)): o mesmo
 * HTML com a prévia do link do casamento; o código fica em src/site/edge/site-page.ts.
 */
export const onRequestGet = ({ request, env }: { request: Request; env: SitePageEnv }) =>
  handleSitePage({ request, env });
