import { handleSitePage, type SitePageEnv } from '../../src/site/edge/site-page';

/** kore.com.br/<slug> (Site público RN01). O código fica em src/site/edge/site-page.ts. */
export const onRequestGet = ({ request, env }: { request: Request; env: SitePageEnv }) =>
  handleSitePage({ request, env });
