import { Divider, PageHeader, Tab, Tabs } from '@kore-io/design';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useMatch } from 'react-router';
import { paths } from '../../../app/paths';
import { useDashboardControllerGetV1 } from '../../../shared/api/generated/rsvp/rsvp';
import { oneDot, shortDayMonth } from '../../../shared/date-texts';
import { useActiveWedding } from '../../guests/hooks/use-active-wedding';

const TABS = [
  { path: paths.deliveryInvites, long: 'tabs.invites', short: 'tabs.invitesShort' },
  { path: paths.deliverySaveTheDate, long: 'tabs.saveTheDate', short: 'tabs.saveTheDateShort' },
  { path: paths.deliveryReminder, long: 'tabs.reminder', short: 'tabs.reminderShort' },
  { path: paths.deliveryDeadline, long: 'tabs.deadline', short: 'tabs.deadlineShort' },
] as const;

/**
 * Envios (IA da Área do Casal; Penpot, página 07; decisão 235): o título, o resumo
 * ("52 de 58 grupos já receberam o convite · prazo de resposta: 15 de out.") e as abas
 * Enviar convites · Save the date · Lembrar pendentes · Prazo de resposta (rótulos curtos
 * no celular), em volta da aba aberta.
 */
export function DeliveriesLayout() {
  const { t } = useTranslation('deliveries');
  const { weddingId } = useActiveWedding();
  const dashboard = useDashboardControllerGetV1(weddingId ?? '', {
    query: { enabled: Boolean(weddingId) },
  });
  const data = dashboard.data;
  const delivery = data?.delivery;
  // "Receberam" = enviados (deliveryStatus <> not_sent; Envios RN03). Sem os números, sem o resumo.
  const total = delivery
    ? delivery.notSent + delivery.sent + delivery.viewed + delivery.responded
    : 0;
  const summary =
    data && total > 0
      ? [
          t('summary.sent', { sent: total - (delivery?.notSent ?? 0), count: total }),
          data.rsvpDeadline &&
            oneDot(
              t('summary.deadline', {
                date: shortDayMonth({ day: data.rsvpDeadline, now: new Date() }),
              }),
            ),
        ]
          .filter(Boolean)
          .join(' · ')
      : undefined;
  return (
    <div className="kore-deliveries">
      <PageHeader title={t('title')} {...(summary && { description: summary })} />
      <div className="kore-deliveries__tabs">
        <Tabs aria-label={t('tabs.label')}>
          {TABS.map((tab) => (
            <DeliveryTab key={tab.path} path={tab.path} long={t(tab.long)} short={t(tab.short)} />
          ))}
        </Tabs>
        <Divider />
      </div>
      <Outlet />
    </div>
  );
}

function DeliveryTab({ path, long, short }: { path: string; long: string; short: string }) {
  const current = useMatch(path) !== null;
  return (
    <Tab asChild current={current}>
      <Link to={path}>
        <span className="kore-deliveries__tab-long">{long}</span>
        {/* No celular, o rótulo curto; o nome acessível continua o longo. */}
        <span className="kore-deliveries__tab-short" aria-hidden="true">
          {short}
        </span>
      </Link>
    </Tab>
  );
}
