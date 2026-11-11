import { EmptyState, Spinner } from '@kore-io/design';
import { SearchX, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTagsControllerListV1 } from '../../../shared/api/generated/tags/tags';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { PartyFilters } from '../components/party-filters';
import { PartyList } from '../components/party-list';
import { SelectionBar } from '../components/selection-bar';
import { useActiveWedding, type Audience } from '../hooks/use-active-wedding';
import { useApplyTag } from '../hooks/use-apply-tag';
import { usePartyFilters } from '../hooks/use-party-filters';
import { usePartyList } from '../hooks/use-party-list';
import { usePartySelection } from '../hooks/use-party-selection';

/** Aba Grupos e convidados (RN13 de Grupos e convidados), dentro do GuestsLayout. */
export function GuestsPage() {
  const { weddingId, audience } = useActiveWedding();
  if (!weddingId) return null;
  return <PartiesView weddingId={weddingId} audience={audience} />;
}

function PartiesView({ weddingId, audience }: { weddingId: string; audience: Audience }) {
  const { t } = useTranslation('guests');
  const { filters: urlFilters, setFilters } = usePartyFilters();
  const tags = useTagsControllerListV1(weddingId);
  // A tag da URL só vale se for uma tag ativa (excluída ou de um link antigo, cai).
  const tagKnown = tags.data?.data.some((tag) => tag.id === urlFilters.tag) ?? false;
  const filters = { ...urlFilters, tag: tagKnown ? urlFilters.tag : '' };
  const list = usePartyList({
    weddingId,
    filters,
    enabled: !urlFilters.tag || !tags.isPending,
  });
  const ids = list.parties.map((party) => party.id);
  const selection = usePartySelection({ ids });
  const applyTag = useApplyTag({ weddingId });

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
    <>
      <PartyFilters
        filters={filters}
        tags={tags.data?.data ?? []}
        onChange={(next) => {
          selection.clear();
          setFilters(next);
        }}
      />
      {selection.count > 0 && (
        <SelectionBar
          count={selection.count}
          tags={tags.data?.data ?? []}
          isApplying={applyTag.isApplying}
          onApplyTag={(tagId) =>
            applyTag.apply({
              tagId,
              partyIds: ids.filter((id) => selection.isSelected(id)),
              onDone: selection.clear,
            })
          }
        />
      )}
      {content()}
    </>
  );
}
