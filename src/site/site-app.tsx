import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CloudOff, Clock, Globe, Link } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PublicSiteResponse } from '../shared/api/generated/model';
import { PreviewBar } from './components/preview-bar';
import { SiteHero } from './components/site-hero';
import { SiteLayout } from './components/site-layout';
import { SiteSections } from './components/site-sections';
import { SystemPage } from './components/system-page';
import { loadSiteFonts } from './fonts';
import { parseSiteRoute } from './route';
import { applySiteTheme } from './theme';
import { usePartySession } from './use-party-session';
import { usePreviewSession } from './use-preview-session';
import { usePublicSite } from './use-public-site';

/** O site do casal (Site público): o endereço, os estados e o Início. */
export function SiteApp({
  pathname = window.location.pathname,
  search = window.location.search,
}: {
  pathname?: string;
  search?: string;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const route = parseSiteRoute(pathname);
  const previewToken = new URLSearchParams(search).get('previa');
  return (
    <QueryClientProvider client={queryClient}>
      {route.kind === 'none' ? (
        <NotFoundPage />
      ) : route.kind === 'site' && previewToken ? (
        <PreviewEntry slug={route.slug} token={previewToken} />
      ) : route.kind === 'party' ? (
        <PartyEntry slug={route.slug} token={route.token} />
      ) : (
        <SitePage slug={route.slug} />
      )}
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

function DraftPage() {
  const { t } = useTranslation('publicSite');
  return (
    <SystemPage
      icon={<Clock />}
      title={t('states.draft.title')}
      description={t('states.draft.description')}
    />
  );
}

function LoadErrorPage({ retry }: { retry: () => void }) {
  const { t } = useTranslation('publicSite');
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

/** O link do grupo (RN06): troca o token pelo cookie e, então, abre o site. */
function PartyEntry({ slug, token }: { slug: string; token: string }) {
  const { t } = useTranslation('publicSite');
  const entry = usePartySession({ slug, token });
  if (entry.state === 'loading') return <SiteSkeleton />;
  if (entry.state === 'draft') return <DraftPage />;
  if (entry.state === 'notFound') return <NotFoundPage />;
  if (entry.state === 'linkInvalid') {
    return (
      <SystemPage
        icon={<Link />}
        title={t('states.linkInvalid.title')}
        description={t('states.linkInvalid.description')}
      />
    );
  }
  if (entry.state === 'error') return <LoadErrorPage retry={entry.retry} />;
  return <SitePage slug={entry.slug} />;
}

/** A prévia (Pré-visualização RN03 e RN04): troca o token pelo cookie e abre o site. */
function PreviewEntry({ slug, token }: { slug: string; token: string }) {
  const { t } = useTranslation('publicSite');
  const entry = usePreviewSession({ slug, token });
  if (entry.state === 'loading') return <SiteSkeleton />;
  if (entry.state === 'invalid') {
    return (
      <SystemPage
        icon={<Link />}
        title={t('states.previewInvalid.title')}
        description={t('states.previewInvalid.description')}
      />
    );
  }
  if (entry.state === 'error') return <LoadErrorPage retry={entry.retry} />;
  return <SitePage slug={entry.slug} />;
}

function SitePage({ slug }: { slug: string }) {
  const { state, site, retry } = usePublicSite({ slug });
  if (state === 'loading') return <SiteSkeleton />;
  if (state === 'notFound') return <NotFoundPage />;
  if (state === 'draft') return <DraftPage />;
  if (state === 'error' || !site) return <LoadErrorPage retry={retry} />;
  return <SiteHome site={site} />;
}

/** O Início do site, com a Aparência do casal no documento. */
function SiteHome({ site }: { site: PublicSiteResponse }) {
  const { t } = useTranslation('publicSite');
  const { appearance } = site;
  useEffect(() => {
    applySiteTheme({ appearance });
    void loadSiteFonts(appearance.fontPairKey);
  }, [appearance]);
  return (
    <SiteLayout
      site={site}
      banner={
        <>
          {site.viewer.kind === 'preview' && <PreviewBar site={site} />}
          {site.viewer.party && (
            <p className="kore-site__party">
              {t('party.banner', { name: site.viewer.party.name })}
            </p>
          )}
        </>
      }
    >
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
