import { Divider, EmptyState, PageHeader, Spinner, Tab, Tabs } from '@kore-io/design';
import { SearchX, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { paths } from '../../../app/paths';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { PartyFilters } from '../components/party-filters';
import { PartyList } from '../components/party-list';
import { useActiveWedding, type Audience } from '../hooks/use-active-wedding';
import { usePartyFilters } from '../hooks/use-party-filters';
import { usePartyList } from '../hooks/use-party-list';
import { usePartySelection } from '../hooks/use-party-selection';
import { summaryText } from '../party-texts';

/** Convidados › Grupos e convidados (RN13 de Grupos e convidados; IA da Área do Casal). */
export function GuestsPage() {
  const { weddingId, audience } = useActiveWedding();
  if (!weddingId) return null;
  return <PartiesView weddingId={weddingId} audience={audience} />;
}

function PartiesView({ weddingId, audience }: { weddingId: string; audience: Audience }) {
  const { t } = useTranslation('guests');
  const { filters, setFilters } = usePartyFilters();
  const list = usePartyList({ weddingId, filters });
  const selection = usePartySelection({ ids: list.parties.map((party) => party.id) });

  function content() {
    if (list.isLoading) {
      return (
        <div className="kore-guests__loading">
          <Spinner label={t('loading')} />
        </div>
      );
    }
    if (list.isError) return <LoadErrorNotice onRetry={list.retry} />;
    if (list.parties.length === 0) {
      // Sem grupo no casamento (vazio tipo 3) ou sem resultado na busca (tipo 1, 198(a)(b)).
      return list.isFiltered ? (
        <EmptyState icon={<SearchX />} title={t('noResults')} />
      ) : (
        <EmptyState icon={<Users />} title={t(`empty.${audience}`)} />
      );
    }
    return (
      <>
        <PartyList
          parties={list.parties}
          selection={selection}
          hasMore={list.hasMore}
          isLoadingMore={list.isLoadingMore}
          loadMoreFailed={list.loadMoreFailed}
          onLoadMore={list.loadMore}
        />
        <p className="kore-guests__showing">
          {t('showing', { shown: list.parties.length, count: list.total ?? 0 })}
        </p>
      </>
    );
  }

  return (
    <div className="kore-guests">
      <PageHeader
        title={t('title')}
        description={list.summary && summaryText({ t, summary: list.summary })}
      />
      <div className="kore-guests__tabs">
        <Tabs aria-label={t('tabs.label')}>
          <Tab asChild current>
            <Link to={paths.guests}>
              <span className="kore-guests__tab-long">{t('tabs.parties')}</span>
              <span className="kore-guests__tab-short">{t('tabs.partiesShort')}</span>
            </Link>
          </Tab>
        </Tabs>
        <Divider />
      </div>
      <PartyFilters
        filters={filters}
        onChange={(next) => {
          selection.clear();
          setFilters(next);
        }}
      />
      {selection.count > 0 && (
        <p className="kore-guests__selection" role="status">
          {t('selected', { count: selection.count })}
        </p>
      )}
      {content()}
    </div>
  );
}
