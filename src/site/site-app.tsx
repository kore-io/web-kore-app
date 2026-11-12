import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CloudOff, Clock, Globe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PublicSiteResponse } from '../shared/api/generated/model';
import { SiteHero } from './components/site-hero';
import { SiteLayout } from './components/site-layout';
import { SiteSections } from './components/site-sections';
import { SystemPage } from './components/system-page';
import { loadSiteFonts } from './fonts';
import { parseSiteRoute } from './route';
import { applySiteTheme } from './theme';
import { usePublicSite } from './use-public-site';

/** O site do casal (Site público): o endereço, os estados e o Início. */
export function SiteApp({ pathname = window.location.pathname }: { pathname?: string }) {
  const [queryClient] = useState(() => new QueryClient());
  const route = parseSiteRoute(pathname);
  return (
    <QueryClientProvider client={queryClient}>
      {route.kind === 'none' ? <NotFoundPage /> : <SitePage slug={route.slug} />}
    </QueryClientProvider>
  );
}

function NotFoundPage() {
  const { t } = useTranslation('publicSite');
  return (
    <SystemPage
      icon={<Globe />}
      title={t('states.notFound.title')}
      description={t('states.notFound.description')}
    />
  );
}

function SitePage({ slug }: { slug: string }) {
  const { t } = useTranslation('publicSite');
  const { state, site, retry } = usePublicSite({ slug });
  if (state === 'loading') return <SiteSkeleton />;
  if (state === 'notFound') return <NotFoundPage />;
  if (state === 'draft') {
    return (
      <SystemPage
        icon={<Clock />}
        title={t('states.draft.title')}
        description={t('states.draft.description')}
      />
    );
  }
  if (state === 'error' || !site) {
    return (
      <SystemPage
        icon={<CloudOff />}
        title={t('states.loadError.title')}
        description={t('states.loadError.description')}
        action={
          <button type="button" className="kore-site-system__action" onClick={retry}>
            {t('states.loadError.retry')}
          </button>
        }
      />
    );
  }
  return <SiteHome site={site} />;
}

/** O Início do site, com a Aparência do casal no documento. */
function SiteHome({ site }: { site: PublicSiteResponse }) {
  const { appearance } = site;
  useEffect(() => {
    applySiteTheme({ appearance });
    void loadSiteFonts(appearance.fontPairKey);
  }, [appearance]);
  return (
    <SiteLayout site={site}>
      <SiteHero site={site} now={new Date()} />
      <SiteSections sections={site.sections} />
    </SiteLayout>
  );
}

/** Enquanto carrega (RN01): a Topbar e o Hero em blocos, sem texto. */
function SiteSkeleton() {
  return (
    <div className="kore-site-skeleton" aria-busy="true">
      <div className="kore-site-skeleton__topbar" />
      <div className="kore-site-skeleton__hero" />
    </div>
  );
}
