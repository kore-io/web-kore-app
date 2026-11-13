import { Alert, Badge, Button, EmptyState, PageHeader, StatCard } from '@kore-io/design';
import { Check, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { guestPartyPath, paths, siteSectionPath } from '../../../app/paths';
import { useMeControllerMeV1 } from '../../../shared/api/generated/me/me';
import type {
  ActivityResponse,
  ChecklistItemResponse,
  DashboardResponse,
} from '../../../shared/api/generated/model';
import { useDashboardControllerGetV1 } from '../../../shared/api/generated/rsvp/rsvp';
import { oneDot } from '../../../shared/date-texts';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { deliveryBadges } from '../../guests/components/delivery-badges';
import { useActiveWedding, type Audience } from '../../guests/hooks/use-active-wedding';
import type { sentFilters } from '../../guests/hooks/use-party-filters';
import { useMarkNotificationRead } from '../../notifications/hooks/use-mark-notification-read';
import { isResponseItem } from '../../notifications/notification-shape';
import { siteStatus } from '../../site/site-texts';
import {
  activityDate,
  activityTexts,
  buffetDetail,
  countdownLine,
  guestsDetail,
  longDate,
  rateDetail,
} from '../dashboard-texts';
import { guestsByRespondedAt } from '../../guests/hooks/use-party-filters';

/** O caminho de cada item do Checklist (RN03). */
const CHECKLIST_PATHS: Record<ChecklistItemResponse['key'], string> = {
  guests: paths.guests,
  appearance: siteSectionPath({ section: 'aparencia' }),
  // A tela paga de publicar vem com o front da F3 (decisão 243): até lá, o Editor.
  publish: paths.site,
  invites: paths.deliveryInvites,
  reminders: paths.deliveryReminder,
};

/** O status de envio e o valor do filtro de Envios na URL (RN02). */
const DELIVERY_ROWS = [
  { key: 'notSent', label: 'not_sent', slug: 'nao-enviado' },
  { key: 'sent', label: 'sent', slug: 'enviado' },
  { key: 'viewed', label: 'viewed', slug: 'visualizado' },
  { key: 'responded', label: 'responded', slug: 'respondido' },
] as const satisfies readonly {
  key: keyof DashboardResponse['delivery'];
  label: string;
  slug: keyof typeof sentFilters;
}[];

/**
 * Dashboard do casal (/app; Dashboard RN01 a RN08): a saudação com a contagem, as ações
 * rápidas e os cartões da F5 (Convidados, Buffet, Taxa de resposta, Envios, Status do site,
 * Checklist e Atividade recente). Os números vêm do servidor na hora, e a tela relê ao
 * voltar à aba.
 */
export function DashboardPage() {
  const { weddingId, audience } = useActiveWedding();
  if (!weddingId) return null;
  return <Dashboard weddingId={weddingId} audience={audience} />;
}

function Dashboard({ weddingId, audience }: { weddingId: string; audience: Audience }) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const { data: me } = useMeControllerMeV1();
  const dashboard = useDashboardControllerGetV1(weddingId, {
    query: { refetchOnWindowFocus: true },
  });
  const firstName = me?.user.name?.trim().split(/\s+/)[0];
  const now = new Date();
  const data = dashboard.data;
  const closed = data
    ? data.site.status !== 'published' && data.site.status !== 'post_event'
    : true;

  const header = (
    <PageHeader
      title={firstName ? t('header.greeting', { name: firstName }) : t('title')}
      description={
        data
          ? (countdownLine({
              t,
              daysUntilEvent: data.daysUntilEvent,
              eventDate: data.eventDate,
              now,
            }) ?? undefined)
          : undefined
      }
      actions={
        <div className="kore-dashboard__actions">
          <Button variant="secondary" onClick={() => void navigate(paths.site)}>
            {t('actions.editSite')}
          </Button>
          <Button
            disabled={!data || closed}
            {...(data && closed && { 'aria-describedby': 'kore-dashboard-closed' })}
            onClick={() => void navigate(paths.deliveryInvites)}
          >
            {t('actions.sendInvites')}
          </Button>
          {data && closed && (
            <p id="kore-dashboard-closed" className="kore-dashboard__help">
              {t(`actions.closed.${audience}`)}
            </p>
          )}
        </div>
      }
    />
  );

  if (dashboard.isError) {
    return (
      <div className="kore-dashboard">
        {header}
        <LoadErrorNotice onRetry={() => void dashboard.refetch()} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="kore-dashboard">
        {header}
        <div className="kore-dashboard__grid" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="kore-dashboard__skeleton" />
          ))}
        </div>
      </div>
    );
  }

  const empty = data.stats.partiesTotal === 0;
  return (
    <div className="kore-dashboard">
      {header}
      {data.role === 'collaborator' && <Alert tone="info">{t('header.collaborator')}</Alert>}
      <div className="kore-dashboard__grid">
        {empty ? (
          <EmptyState
            className="kore-dashboard__empty"
            icon={<Users />}
            title={t(`guests.empty.${audience}`)}
            titleAs="h2"
            action={
              <Button onClick={() => void navigate(paths.guestNew)}>{t('guests.add')}</Button>
            }
          />
        ) : (
          <>
            <Link to={paths.guests} className="kore-dashboard__card-link kore-dashboard__stat">
              <StatCard
                label={t('guests.title')}
                value={data.stats.guestsTotal}
                detail={guestsDetail({ t, stats: data.stats })}
              />
            </Link>
            <Link
              to={`${paths.guests}?resposta=confirmados`}
              className="kore-dashboard__card-link kore-dashboard__stat"
            >
              <StatCard
                label={t('buffet.title')}
                value={data.stats.confirmed}
                detail={buffetDetail({ t, stats: data.stats })}
              />
            </Link>
            <Link
              to={paths.deliveryDeadline}
              className="kore-dashboard__card-link kore-dashboard__stat"
            >
              <StatCard
                label={t('rate.title')}
                value={t('rate.value', { percent: data.stats.rsvpPercent })}
                detail={oneDot(
                  rateDetail({ t, stats: data.stats, deadline: data.rsvpDeadline, now }),
                )}
              />
            </Link>
            <DeliveryCard data={data} closed={closed} />
          </>
        )}
        <SiteCard data={data} now={now} />
        <ChecklistCard items={data.checklist} />
        {!empty && <ActivityCard weddingId={weddingId} items={data.recentActivity} now={now} />}
      </div>
    </div>
  );
}

/** Envios (RN02): os grupos por status; cada um abre Enviar convites com o filtro. */
function DeliveryCard({ data, closed }: { data: DashboardResponse; closed: boolean }) {
  const { t } = useTranslation('dashboard');
  return (
    <section
      className="kore-dashboard__card kore-dashboard__card--half"
      aria-labelledby="kore-dashboard-delivery"
    >
      <h2 id="kore-dashboard-delivery" className="kore-dashboard__card-title">
        {t('delivery.title')}
      </h2>
      <ul className="kore-dashboard__delivery">
        {DELIVERY_ROWS.map((row) => {
          const badge = deliveryBadges[row.label];
          const content = (
            <>
              <Badge tone={badge.tone} icon={badge.icon}>
                {t(`delivery.${row.label}`)}
              </Badge>
              <span className="kore-dashboard__delivery-value">
                {t('delivery.parties', { count: data.delivery[row.key] })}
              </span>
            </>
          );
          return (
            <li key={row.key}>
              {/* Antes de publicar, os números ficam, sem levar aos envios (RN01). */}
              {closed ? (
                <span className="kore-dashboard__delivery-row">{content}</span>
              ) : (
                <Link
                  to={`${paths.deliveryInvites}?envio=${row.slug}`}
                  className="kore-dashboard__delivery-row"
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {closed && <p className="kore-dashboard__card-caption">{t('delivery.closed')}</p>}
    </section>
  );
}

/** Status do site (RN02, RN07): o selo, o endereço e "No ar até {data}.", e o botão. */
function SiteCard({ data, now }: { data: DashboardResponse; now: Date }) {
  const { t } = useTranslation('dashboard');
  const { t: tSite } = useTranslation('site');
  const navigate = useNavigate();
  const status = siteStatus(data.site.status);
  const live = status === 'published' || status === 'post_event';
  return (
    <section
      className="kore-dashboard__card kore-dashboard__card--half kore-dashboard__site"
      aria-labelledby="kore-dashboard-site"
    >
      <h2 id="kore-dashboard-site" className="kore-dashboard__card-title">
        {t('site.title')}
      </h2>
      {status && (
        <Badge
          tone={live ? 'success' : 'neutral'}
          {...(live && { icon: <Check strokeWidth={2.4} /> })}
          className="kore-dashboard__badge"
        >
          {tSite(`status.${status}`)}
        </Badge>
      )}
      {data.site.slug && (
        <p className="kore-dashboard__site-address">{tSite('address', { slug: data.site.slug })}</p>
      )}
      {live && data.site.endDate && (
        <p className="kore-dashboard__card-caption">
          {oneDot(t('site.endDate', { date: longDate({ day: data.site.endDate, now }) }))}
        </p>
      )}
      {status === 'awaiting_couple' && (
        <p className="kore-dashboard__card-text">{t('site.awaitingCouple')}</p>
      )}
      <div className="kore-dashboard__card-actions">
        {/* O Publicar volta com a tela paga do front da F3 (Publicar e pagar RN17; 243). */}
        <Button size="sm" variant="secondary" onClick={() => void navigate(paths.site)}>
          {t('site.edit')}
        </Button>
      </div>
    </section>
  );
}

/** Checklist (RN03): na ordem do servidor; o feito com o ícone e riscado. */
function ChecklistCard({ items }: { items: ChecklistItemResponse[] }) {
  const { t } = useTranslation('dashboard');
  const next = items.find((item) => !item.done)?.key;
  const label = (item: ChecklistItemResponse) => {
    // Sem grupos, sem a contagem "(0 de 0 grupos)": só "Enviar os convites".
    if (!item.done && item.progress && item.progress.total > 0 && item.key === 'invites') {
      return t('checklist.invitesProgress', {
        done: item.progress.done,
        total: item.progress.total,
      });
    }
    if (!item.done && item.progress && item.key === 'reminders') {
      return t('checklist.remindersProgress', {
        count: item.progress.total - item.progress.done,
      });
    }
    return t(`checklist.${item.key}`);
  };
  return (
    <section
      className="kore-dashboard__card kore-dashboard__card--half"
      aria-labelledby="kore-dashboard-checklist"
    >
      <h2 id="kore-dashboard-checklist" className="kore-dashboard__card-title">
        {t('checklist.title')}
      </h2>
      <ol className="kore-dashboard__checklist">
        {items.map((item) => (
          <li
            key={item.key}
            className="kore-dashboard__check"
            data-state={item.done ? 'done' : item.key === next ? 'next' : 'todo'}
          >
            <span className="kore-dashboard__check-box" aria-hidden="true">
              {item.done && <Check strokeWidth={2.4} />}
            </span>
            <Link to={CHECKLIST_PATHS[item.key]} className="kore-dashboard__check-link">
              {label(item)}
              {/* O estado para o leitor de tela; na tela, a caixa marcada (decisão 239(B2)). */}
              {item.done && (
                <>
                  {' '}
                  <span className="kore-dashboard__sr">{t('checklist.done')}</span>
                </>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Atividade recente (RN04): as 5 últimas, com o texto da central e a data; abrir leva ao
 * Painel do grupo (1 grupo) ou à lista (vários) e marca a notificação como lida.
 */
function ActivityCard({
  weddingId,
  items: all,
  now,
}: {
  weddingId: string;
  items: ActivityResponse[];
  now: Date;
}) {
  const { t } = useTranslation('dashboard');
  // Só as respostas: a API monta os grupos do payload da notificação, e a central do casal
  // já recebe os avisos de cobrança (outro formato), que o app desenha no front da F3.
  const items = all.filter((item) => isResponseItem(item.groups));
  const markRead = useMarkNotificationRead({ weddingId });
  return (
    <section
      className="kore-dashboard__card kore-dashboard__card--half"
      aria-labelledby="kore-dashboard-activity"
    >
      <h2 id="kore-dashboard-activity" className="kore-dashboard__card-title">
        {t('activity.title')}
      </h2>
      {items.length === 0 ? (
        <p className="kore-dashboard__card-text">{t('activity.empty')}</p>
      ) : (
        <ul className="kore-dashboard__activity">
          {items.map((item) => {
            const texts = activityTexts({ t, item });
            const [first] = item.groups;
            const to =
              item.count <= 1 && first
                ? guestPartyPath({ partyId: first.partyId })
                : guestsByRespondedAt(paths.guests);
            return (
              <li key={item.id}>
                <Link
                  to={to}
                  className="kore-dashboard__activity-item"
                  onClick={() => {
                    // Abrir marca como lida (Central RN05); a da colaboradora não tem o que marcar.
                    if (item.source === 'notification' && item.readAt === null) {
                      markRead({ id: item.id });
                    }
                  }}
                >
                  <span className="kore-dashboard__activity-title">{texts.title}</span>
                  <span className="kore-dashboard__activity-date">
                    {activityDate({ t, at: item.at, now })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
