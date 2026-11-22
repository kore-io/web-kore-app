import { Button, EmptyState, PageHeader, Select, Spinner, useToast } from '@kore-io/design';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarCheck, Globe, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import { getMeControllerMeV1QueryKey, meControllerMeV1 } from '../../../shared/api/generated/me/me';
import type { MeResponse, NotificationResponse } from '../../../shared/api/generated/model';
import {
  getNotificationsControllerListV1QueryKey,
  getNotificationsControllerUnreadV1QueryKey,
  notificationsControllerListV1,
  notificationsControllerReadAllV1,
} from '../../../shared/api/generated/notifications/notifications';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { useMarkNotificationRead } from '../../notifications/hooks/use-mark-notification-read';
import {
  isPlannerItem,
  PLANNER_TYPES,
  plannerNotificationDate,
  plannerNotificationTitle,
  type PlannerType,
} from './planner-notification-texts';

type Filter = '' | PlannerType;

const ICONS: Record<PlannerType, typeof Bell> = {
  rsvp: CalendarCheck,
  wedding_published: Globe,
  membership_removed: Users,
};

/**
 * Notificações da cerimonialista (/cerimonialista/notificacoes; RN05; decisão 300; Penpot
 * 13): uma página com todos os casamentos dela (`scope=planner`), mais novas primeiro, com o
 * filtro Todas · Novas respostas · Casamento publicado · Colaboração encerrada (sem Comissão
 * até a F3), Marcar todas como lidas (só no escopo dela) e Carregar mais.
 */
export function PlannerNotificationsPage() {
  const { t } = useTranslation('planner');
  const { t: tAccess } = useTranslation('access');
  const { t: tNotifications } = useTranslation('notifications');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('');
  const params = { scope: 'planner' as const, ...(filter && { type: filter }) };
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
    mutationFn: () => notificationsControllerReadAllV1({ scope: 'planner' }),
    onSuccess: async () => {
      showToast({ tone: 'success', message: tNotifications('markedAll') });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getNotificationsControllerListV1QueryKey() }),
        queryClient.invalidateQueries({
          queryKey: getNotificationsControllerUnreadV1QueryKey(),
        }),
      ]);
    },
    onError: () =>
      showToast({
        tone: 'danger',
        message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
      }),
  });
  const items = (list.data?.pages.flatMap((page) => page.items) ?? []).filter(isPlannerItem);
  const hasUnread = items.some((item) => item.readAt === null);
  // O filtro e o Marcar todas só com itens ou com um filtro escolhido: a vazia de verdade não
  // os mostra (Penpot 13), e a central não pisca com eles enquanto carrega (sugestão do Crivo).
  const empty = items.length === 0 && !filter;

  return (
    <div className="kore-notifications">
      <PageHeader
        title={tNotifications('title')}
        description={t('notifications.subtitle')}
        {...(!empty && {
          actions: (
            <Button
              variant="secondary"
              disabled={!hasUnread || markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              {tNotifications('markAll')}
            </Button>
          ),
        })}
      />
      {!empty && (
        <div className="kore-notifications__filter">
          <Select
            aria-label={tNotifications('filter.label')}
            value={filter}
            onChange={(event) => setFilter(event.target.value as Filter)}
          >
            <option value="">{tNotifications('filter.all')}</option>
            {PLANNER_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`notifications.types.${type}`)}
              </option>
            ))}
          </Select>
        </div>
      )}
      {list.isError && items.length === 0 ? (
        <LoadErrorNotice onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <div className="kore-notifications__loading">
          <Spinner label={tNotifications('loading')} />
        </div>
      ) : items.length === 0 ? (
        filter ? (
          <p className="kore-notifications__filter-empty">{tNotifications('filterEmpty')}</p>
        ) : (
          <EmptyState
            icon={<Bell />}
            title={t('notifications.empty.title')}
            description={t('notifications.empty.description')}
          />
        )
      ) : (
        <>
          <ul className="kore-notifications__list">
            {items.map((item) => (
              <PlannerNotificationItem key={item.id} item={item} />
            ))}
          </ul>
          {list.hasNextPage && (
            <div className="kore-notifications__more">
              <Button
                variant="secondary"
                disabled={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                {tNotifications('loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Um item (Penpot 13; decisão 300(4) e (5)): o ícone do tipo, o título e "{Tipo} · 26/09 às
 * 9h12"; não lida, com o ponto e o peso maior. Abrir marca como lida e leva ao destino:
 * Novas respostas e Casamento publicado, onde ela ainda colabora (pelo /me), ao detalhe do
 * casamento; o publicado de quem só indicou, ao Link de indicação; a colaboração encerrada,
 * a Meus casamentos.
 */
function PlannerNotificationItem({ item }: { item: NotificationResponse }) {
  const { t } = useTranslation('planner');
  const { t: tNotifications } = useTranslation('notifications');
  const { t: tDashboard } = useTranslation('dashboard');
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();
  const queryClient = useQueryClient();
  const type = item.type as PlannerType;
  const Icon = ICONS[type];
  const unread = item.readAt === null;
  const detail = `${paths.plannerArea}?casamento=${encodeURIComponent(item.weddingId)}`;

  /**
   * O destino na hora do toque. No publicado, "ainda colabora" pede o /me novo (o vínculo pode
   * ter acabado desde a última leitura; sugestão do Crivo); se a leitura falhar, vale a que
   * está em cache.
   */
  async function target(): Promise<string> {
    if (type === 'membership_removed') return paths.plannerArea;
    if (type !== 'wedding_published') return detail;
    const me = await queryClient
      .fetchQuery({
        queryKey: getMeControllerMeV1QueryKey(),
        queryFn: ({ signal }) => meControllerMeV1({ signal }),
        staleTime: 0,
      })
      .catch(() => queryClient.getQueryData<MeResponse>(getMeControllerMeV1QueryKey()));
    const collaborating = Boolean(
      me?.memberships.some(
        (membership) =>
          membership.weddingId === item.weddingId && membership.role === 'collaborator',
      ),
    );
    return collaborating ? detail : paths.plannerReferral;
  }
  const date = plannerNotificationDate({ t: tDashboard, at: item.updatedAt, now: new Date() });
  return (
    <li>
      <button
        type="button"
        className="kore-notifications__item kore-notifications__item--icon"
        data-unread={unread || undefined}
        onClick={() => {
          if (unread) markRead({ id: item.id });
          void target().then((to) => navigate(to));
        }}
      >
        <span className="kore-notifications__icon" aria-hidden="true">
          <Icon size={20} strokeWidth={1.75} />
        </span>
        <span className="kore-notifications__text">
          <span className="kore-notifications__title">
            {plannerNotificationTitle({ t, item })}
            {unread && <span className="kore-notifications__sr">, {tNotifications('unread')}</span>}
          </span>
          <span className="kore-notifications__detail">
            {`${t(`notifications.types.${type}`)} · ${date}`}
          </span>
        </span>
        {unread && (
          <span
            className="kore-notifications__dot kore-notifications__dot--end"
            aria-hidden="true"
          />
        )}
      </button>
    </li>
  );
}
