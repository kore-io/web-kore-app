import { Button, EmptyState, PageHeader, Select, Spinner, useToast } from '@kore-io/design';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type {
  NotificationEntryResponse,
  NotificationResponse,
  NotificationsControllerListV1Type,
} from '../../../shared/api/generated/model';
import {
  getNotificationsControllerListV1QueryKey,
  getNotificationsControllerUnreadV1QueryKey,
  notificationsControllerListV1,
  notificationsControllerReadAllV1,
} from '../../../shared/api/generated/notifications/notifications';
import { getDashboardControllerGetV1QueryKey } from '../../../shared/api/generated/rsvp/rsvp';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { activityDate, activityTexts } from '../../dashboard/dashboard-texts';
import { useActiveWedding } from '../../guests/hooks/use-active-wedding';
import { useMarkNotificationRead } from '../hooks/use-mark-notification-read';
import { isResponseItem, responseGroups } from '../notification-shape';
import { guestsByRespondedAt } from '../../guests/hooks/use-party-filters';
import { useAreaPaths } from '../../../app/area';

type Filter = '' | NotificationsControllerListV1Type;

/** O tipo que a central desenha na F5: a resposta do convite, com ao menos um grupo. */
function isDrawn(item: NotificationResponse): boolean {
  return item.type === 'rsvp' && isResponseItem(item.payload);
}

/**
 * Notificações (/app/notificacoes; Central RN04 a RN06; Penpot 25): as do casamento ativo,
 * mais novas primeiro, com o filtro por tipo (Todas · Respostas na F5), Marcar todas como
 * lidas e Carregar mais (20 por vez). Abrir uma leva ao Painel do grupo (1 grupo) ou à
 * lista (agrupada) e marca como lida.
 */
export function NotificationsPage() {
  const { weddingId, role } = useActiveWedding();
  const { t } = useTranslation('notifications');
  if (!weddingId) return null;
  // A colaboradora, até a F6, não recebe os avisos do casamento (Central RN03, RN06).
  if (role && role !== 'owner') {
    return (
      <div className="kore-notifications">
        <PageHeader title={t('title')} />
        <p className="kore-notifications__filter-empty">{t('collaborator')}</p>
      </div>
    );
  }
  return <Notifications weddingId={weddingId} />;
}

function Notifications({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('notifications');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('');
  const params = { weddingId, ...(filter && { type: filter }) };
  const list = useInfiniteQuery({
    queryKey: getNotificationsControllerListV1QueryKey(params),
    queryFn: ({ pageParam, signal }) =>
      notificationsControllerListV1(
        { ...params, ...(pageParam && { cursor: pageParam }) },
        { signal },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const markAll = useMutation({
    mutationFn: () => notificationsControllerReadAllV1({ weddingId }),
    onSuccess: async () => {
      showToast({ tone: 'success', message: t('markedAll') });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getNotificationsControllerListV1QueryKey() }),
        queryClient.invalidateQueries({
          queryKey: getNotificationsControllerUnreadV1QueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: getDashboardControllerGetV1QueryKey(weddingId),
        }),
      ]);
    },
    onError: () =>
      showToast({
        tone: 'danger',
        message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
      }),
  });
  // Só os tipos que o app desenha (as respostas, Central RN01): a API já grava os de
  // cobrança (Publicar e pagar RN13), que entram com o front da F3.
  const items = (list.data?.pages.flatMap((page) => page.items) ?? []).filter(isDrawn);
  const hasUnread = items.some((item) => item.readAt === null);

  return (
    <div className="kore-notifications">
      <PageHeader
        title={t('title')}
        actions={
          <div className="kore-notifications__actions">
            <Select
              aria-label={t('filter.label')}
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
            >
              <option value="">{t('filter.all')}</option>
              <option value="rsvp">{t('filter.rsvp')}</option>
            </Select>
            <Button
              variant="secondary"
              disabled={!hasUnread || markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              {t('markAll')}
            </Button>
          </div>
        }
      />
      {list.isError && items.length === 0 ? (
        <LoadErrorNotice onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <div className="kore-notifications__loading">
          <Spinner label={t('loading')} />
        </div>
      ) : items.length === 0 ? (
        filter ? (
          <p className="kore-notifications__filter-empty">{t('filterEmpty')}</p>
        ) : (
          <EmptyState
            icon={<Bell />}
            title={t('empty.title')}
            description={t('empty.description')}
          />
        )
      ) : (
        <>
          <ul className="kore-notifications__list">
            {items.map((item) => (
              <NotificationItem key={item.id} weddingId={weddingId} item={item} />
            ))}
          </ul>
          {list.hasNextPage && (
            <div className="kore-notifications__more">
              <Button
                variant="secondary"
                disabled={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                {t('loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Um item (Central RN04; R7): 1 grupo, o título e "3 confirmados, 1 recusado · hoje às
 * 19h40"; agrupada, o título, os nomes e a data numa linha à parte. Não lida, com o ponto
 * e o peso maior, e "não lida" para o leitor de tela.
 */
function NotificationItem({ weddingId, item }: { weddingId: string; item: NotificationResponse }) {
  const area = useAreaPaths();
  const { t } = useTranslation('notifications');
  const { t: tDashboard } = useTranslation('dashboard');
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead({ weddingId });
  // A lista já só tem respostas (isDrawn); aqui, os grupos com o tipo de resposta.
  const groups = (responseGroups(item.payload) ?? []) as NotificationEntryResponse[];
  const texts = activityTexts({ t: tDashboard, item: { count: item.count, groups } });
  const date = activityDate({ t: tDashboard, at: item.updatedAt, now: new Date() });
  const [first] = groups;
  const single = item.count <= 1 && first;
  const unread = item.readAt === null;
  return (
    <li>
      <button
        type="button"
        className="kore-notifications__item"
        data-unread={unread || undefined}
        onClick={() => {
          if (unread) markRead({ id: item.id });
          void navigate(
            single ? area.guestParty({ partyId: first.partyId }) : guestsByRespondedAt(area.guests),
          );
        }}
      >
        {unread && <span className="kore-notifications__dot" aria-hidden="true" />}
        <span className="kore-notifications__text">
          <span className="kore-notifications__title">
            {texts.title}
            {unread && <span className="kore-notifications__sr">, {t('unread')}</span>}
          </span>
          {single ? (
            <span className="kore-notifications__detail">
              {[texts.detail, date].filter(Boolean).join(' · ')}
            </span>
          ) : (
            <>
              <span className="kore-notifications__detail">{texts.detail}</span>
              <span className="kore-notifications__detail">{date}</span>
            </>
          )}
        </span>
      </button>
    </li>
  );
}
