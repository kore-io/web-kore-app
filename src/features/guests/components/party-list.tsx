import {
  Badge,
  Button,
  Checkbox,
  GroupRow,
  GroupTable,
  GroupTableHeader,
  Spinner,
  Tag,
  type BadgeTone,
} from '@kore-io/design';
import { Check, Clock, Send } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { guestPartyPath } from '../../../app/paths';
import type {
  PartyListItemResponse,
  PartyListItemResponseDeliveryStatus,
} from '../../../shared/api/generated/model';
import { contactText, respondedAtText, responsesText } from '../party-texts';
import { useLoadMoreOnScroll } from '../hooks/use-load-more-on-scroll';
import type { usePartySelection } from '../hooks/use-party-selection';

/** Selo do envio, como no Badge do DS (o ícone de 14 px, traço 2,4 no Check). */
const deliveryBadges: Record<
  PartyListItemResponseDeliveryStatus,
  { tone: BadgeTone; icon?: ReactNode }
> = {
  not_sent: { tone: 'neutral' },
  sent: { tone: 'info', icon: <Send /> },
  viewed: { tone: 'warning', icon: <Clock /> },
  responded: { tone: 'success', icon: <Check strokeWidth={2.4} /> },
};

interface PartyListProps {
  parties: PartyListItemResponse[];
  selection: ReturnType<typeof usePartySelection>;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreFailed: boolean;
  onLoadMore: () => void;
  /** O ⋮ de cada grupo (decisão 199(2)). */
  actionsFor: (party: PartyListItemResponse) => ReactNode;
}

/**
 * Tabela de grupos (RN13) com a seleção múltipla e a rolagem infinita (decisão 197); o
 * nome do grupo abre o Painel do grupo (RN13).
 */
export function PartyList({
  parties,
  selection,
  hasMore,
  isLoadingMore,
  loadMoreFailed,
  onLoadMore,
  actionsFor,
}: PartyListProps) {
  const { t } = useTranslation('guests');
  const { t: tCommon } = useTranslation('common');
  // Com a próxima página em erro, o marcador para; volta pelo Tentar de novo (200(d)).
  const sentinel = useLoadMoreOnScroll({ enabled: hasMore && !loadMoreFailed, onLoadMore });

  return (
    <>
      <GroupTable
        label={t('table.label')}
        header={
          <GroupTableHeader
            selectAll={
              <Checkbox
                aria-label={t('table.selectAll')}
                checked={selection.allSelected}
                indeterminate={selection.someSelected}
                onChange={selection.toggleAll}
              />
            }
            labels={{
              group: t('table.columns.group'),
              people: t('table.columns.people'),
              responses: t('table.columns.responses'),
              delivery: t('table.columns.delivery'),
              respondedAt: t('table.columns.respondedAt'),
              tags: t('table.columns.tags'),
              actions: t('table.columns.actions'),
            }}
          />
        }
      >
        {parties.map((party) => {
          const badge = deliveryBadges[party.deliveryStatus];
          return (
            <GroupRow
              key={party.id}
              select={
                <Checkbox
                  aria-label={t('table.select', { name: party.name })}
                  checked={selection.isSelected(party.id)}
                  onChange={() => selection.toggle(party.id)}
                />
              }
              name={
                <Link to={guestPartyPath({ partyId: party.id })} className="kore-party-list__name">
                  {party.name}
                </Link>
              }
              contact={contactText({ t, party })}
              people={{ value: party.people, label: t('row.people', { count: party.people }) }}
              responses={responsesText({ t, counts: party.counts })}
              delivery={
                <Badge tone={badge.tone} icon={badge.icon}>
                  {t(`row.delivery.${party.deliveryStatus}`)}
                </Badge>
              }
              respondedAt={respondedAtText({ t, party })}
              tags={party.tags.map((tag) => (
                <Tag key={tag.id} color={tag.color}>
                  {tag.name}
                </Tag>
              ))}
              actions={actionsFor(party)}
            />
          );
        })}
      </GroupTable>
      {hasMore && !loadMoreFailed && (
        <div ref={sentinel} className="kore-party-list__sentinel" aria-hidden="true" />
      )}
      {loadMoreFailed && !isLoadingMore && (
        <div className="kore-party-list__loading">
          <Button variant="secondary" onClick={onLoadMore}>
            {tCommon('retry')}
          </Button>
        </div>
      )}
      {isLoadingMore && (
        <div className="kore-party-list__loading">
          <Spinner label={t('loadingMore')} />
        </div>
      )}
    </>
  );
}
