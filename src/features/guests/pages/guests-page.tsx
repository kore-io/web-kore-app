import { useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import { presetDeliverySelection } from '../../deliveries/hooks/use-delivery-selection';
import { EmptyState, Spinner } from '@kore-io/design';
import { SearchX, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTagsControllerListV1 } from '../../../shared/api/generated/tags/tags';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { useState } from 'react';
import { PartyFilters } from '../components/party-filters';
import { PartyList } from '../components/party-list';
import { PartyRowMenu } from '../components/party-row-menu';
import { SelectionBar } from '../components/selection-bar';
import { TrashDialog } from '../components/trash-dialog';
import { useActiveWedding, type Audience } from '../hooks/use-active-wedding';
import { useApplyTag } from '../hooks/use-apply-tag';
import { useTrash } from '../hooks/use-trash';
import { usePartyFilters } from '../hooks/use-party-filters';
import { usePartyList } from '../hooks/use-party-list';
import { usePartySelection } from '../hooks/use-party-selection';
import { useRowActions } from '../hooks/use-row-actions';

/** Aba Grupos e convidados (RN13 de Grupos e convidados), dentro do GuestsLayout. */
export function GuestsPage() {
  const { weddingId, audience, role } = useActiveWedding();
  if (!weddingId) return null;
  return <PartiesView weddingId={weddingId} audience={audience} role={role} />;
}

function PartiesView({
  weddingId,
  audience,
  role,
}: {
  weddingId: string;
  audience: Audience;
  role: string | undefined;
}) {
  const { t } = useTranslation('guests');
  const navigate = useNavigate();
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
  const trash = useTrash({ weddingId, audience });
  const rowActions = useRowActions({ weddingId });
  const [confirmTrash, setConfirmTrash] = useState(false);
  const marked = list.parties.filter((party) => selection.isSelected(party.id));
  const onlyOne = marked.length === 1 ? marked[0] : undefined;

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
          actionsFor={(party) => (
            <PartyRowMenu
              party={party}
              // A colaboradora não exclui quem já respondeu (Prazo RN08).
              trashLocked={role !== 'owner' && party.counts.confirmed + party.counts.declined > 0}
              onAction={rowActions.onAction}
            />
          )}
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
          audience={audience}
          onRemind={() => {
            presetDeliverySelection({
              weddingId,
              kind: 'reminder',
              ids: marked.map((party) => party.id),
            });
            void navigate(paths.deliveryReminder);
          }}
          tags={tags.data?.data ?? []}
          isApplying={applyTag.isApplying}
          onApplyTag={(tagId) =>
            applyTag.apply({
              tagId,
              partyIds: ids.filter((id) => selection.isSelected(id)),
              onDone: selection.clear,
            })
          }
          onTrash={() => setConfirmTrash(true)}
        />
      )}
      <TrashDialog
        open={rowActions.trashing !== null}
        title={t('trash.party.title', { name: rowActions.trashing?.name ?? '' })}
        description={t('trash.party.description', { count: rowActions.trashing?.named ?? 0 })}
        isPending={trash.isTrashing}
        returnFocusRef={rowActions.trigger}
        onClose={rowActions.closeTrash}
        onConfirm={() => {
          const party = rowActions.trashing;
          if (!party) return;
          trash.trashParty({ partyId: party.id, name: party.name, onDone: rowActions.closeTrash });
        }}
      />
      <TrashDialog
        open={confirmTrash}
        // Com 1 grupo marcado, vale o Dialog do grupo, com o nome (Lixeira RN02).
        title={
          onlyOne
            ? t('trash.party.title', { name: onlyOne.name })
            : t('trash.many.title', { count: marked.length })
        }
        description={
          onlyOne
            ? t('trash.party.description', {
                count: onlyOne.people - onlyOne.counts.pendingPlusOnes,
              })
            : t('trash.many.description')
        }
        isPending={trash.isTrashing}
        onClose={() => setConfirmTrash(false)}
        onConfirm={() =>
          trash.trashMany({
            partyIds: marked.map((party) => party.id),
            onDone: (ok) => {
              setConfirmTrash(false);
              if (ok) selection.clear();
            },
          })
        }
      />
      {content()}
    </>
  );
}
