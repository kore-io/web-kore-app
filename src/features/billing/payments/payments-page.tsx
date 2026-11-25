import { Badge, Button, EmptyState, PageHeader, Spinner, type BadgeTone } from '@kore-io/design';
import type { TFunction } from 'i18next';
import { CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAreaPaths } from '../../../app/area';
import { usePaymentsControllerBillingV1 } from '../../../shared/api/generated/billing/billing';
import { useMeControllerMeV1 } from '../../../shared/api/generated/me/me';
import type { BillingPaymentDto, BillingResponse } from '../../../shared/api/generated/model';
import { DataTable, DataTableCell, DataTableRow } from '../../../shared/components/data-table';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { oneDot, shortDayMonth } from '../../../shared/date-texts';
import { formatCents } from '../../../shared/money';
import { useActiveWedding } from '../../guests/hooks/use-active-wedding';
import { siteStatus } from '../../site/site-texts';
import { canOpenPublish, publishWaitsCouple } from '../publish/publish-entry';
import { dayIn, numericDay, visibleStatus, type VisibleStatus } from './payments-texts';
import { RefundSection } from './refund';
import { canChangeEndDate } from '../end-date/end-date';
import { lifecycleView } from '../lifecycle/lifecycle';
import { graceLabel } from '../lifecycle/lifecycle-banner';

/** O Selo de pagamento do DS (Penpot 04 e 21, A9), por situação. */
const STATUS_TONES: Record<VisibleStatus, BadgeTone> = {
  paid: 'success',
  pending: 'warning',
  failed: 'danger',
  refund_requested: 'warning',
  refunded: 'neutral',
  disputed: 'warning',
};

/**
 * Cobrança e publicação › Pagamentos (`…/cobranca`; Pagamentos e arrependimento RN01; Penpot
 * 21, A9; decisão 326): o status e as datas, o Publicar o site no rascunho e o histórico. A
 * colaboradora vê só o status e as datas, sem o histórico (decisões 29 e 272(2)).
 */
export function PaymentsPage() {
  const { weddingId, role } = useActiveWedding();
  if (!weddingId) return null;
  return <Payments weddingId={weddingId} owner={role === 'owner'} />;
}

function Payments({ weddingId, owner }: { weddingId: string; owner: boolean }) {
  const { t } = useTranslation('billing');
  const { t: tSite } = useTranslation('site');
  const navigate = useNavigate();
  const paths = useAreaPaths();
  const { data: me } = useMeControllerMeV1();
  const membership = me?.memberships.find((item) => item.weddingId === weddingId);
  const timezone = membership?.timezone ?? null;
  const billing = usePaymentsControllerBillingV1(weddingId);
  const now = new Date();

  if (billing.isError) return <LoadErrorNotice onRetry={() => void billing.refetch()} />;
  if (!billing.data) {
    return (
      <div className="kore-payments__loading">
        <Spinner label={t('payments.loading')} />
      </div>
    );
  }
  const data = billing.data;
  const waits = publishWaitsCouple(data.status);
  const description = subtitleOf({ data, now, t, tSite, timezone });
  // O Mudar a data de saída do ar para o dono, com o site publicado (E11).
  const changeEndDate = owner && canChangeEndDate({ status: data.status });
  return (
    <div className="kore-payments">
      <PageHeader
        title={t('payments.title')}
        {...(description && { description })}
        actions={
          // Decisão 326(1): no rascunho, o Publicar o site; aguardando o casal, desabilitado
          // com o motivo (325). Publicado, o Mudar a data de saída do ar (secundário, Penpot
          // 21), também na carência e no expirado (E11).
          changeEndDate ? (
            <Button variant="secondary" onClick={() => void navigate(paths.billingEndDate)}>
              {t('endDate.title')}
            </Button>
          ) : (
            canOpenPublish(data.status) && (
              <div className="kore-payments__actions">
                <Button
                  disabled={waits}
                  {...(waits && { 'aria-describedby': 'kore-payments-waits' })}
                  onClick={() => void navigate(paths.billingPublish)}
                >
                  {t('payments.publish')}
                </Button>
                {waits && (
                  <p id="kore-payments-waits" className="kore-payments__help">
                    {tSite('publishWaitsCouple')}
                  </p>
                )}
              </div>
            )
          )
        }
      />
      {owner && (
        // O Desistir e as legendas, acima do histórico (Penpot 21, A9; E7).
        <RefundSection
          weddingId={weddingId}
          payments={data.payments ?? []}
          timezone={timezone}
          blocked={membership?.lifecycle.blocked ?? false}
          now={now}
        />
      )}
      {owner && <History payments={data.payments ?? []} timezone={timezone} now={now} />}
    </div>
  );
}

/**
 * "Publicado · no ar até 14 de fev. de 2027" e "Pós-evento · …" (RN01; 326(2)); o rascunho
 * sem subtítulo, como no Penpot; o expirado só com o rótulo do selo; a carência com o rótulo
 * do selo, "Vence em N dias" ou "Último dia no ar" (E8).
 */
function subtitleOf({
  data,
  now,
  timezone,
  t,
  tSite,
}: {
  data: BillingResponse;
  now: Date;
  timezone: string | null;
  t: TFunction<'billing'>;
  tSite: TFunction<'site'>;
}): string | null {
  const status = siteStatus(data.status);
  if ((status === 'published' || status === 'post_event') && data.endDate) {
    return oneDot(
      t('payments.live', {
        status: tSite(`status.${status}`),
        date: shortDayMonth({ day: data.endDate, now }),
      }),
    );
  }
  if (status === 'expired') return tSite('status.expired');
  // Na carência, o rótulo do selo: "Vence em N dias" ou "Último dia no ar" (326(2); E8).
  const view = lifecycleView({ lifecycle: data, eventDate: null, timezone, now });
  if (view.kind === 'grace') return graceLabel({ daysLeft: view.daysLeft, t });
  return null;
}

/** O histórico (RN01): sem os `canceled`; o vazio do Penpot. */
function History({
  payments,
  timezone,
  now,
}: {
  payments: BillingPaymentDto[];
  timezone: string | null;
  now: Date;
}) {
  const { t } = useTranslation('billing');
  const rows = payments.flatMap((payment) => {
    const status = visibleStatus(payment.status);
    return status ? [{ payment, status }] : [];
  });
  if (rows.length === 0) {
    return (
      <EmptyState
        className="kore-payments__empty"
        icon={<CreditCard />}
        title={t('payments.empty.title')}
        description={t('payments.empty.description')}
      />
    );
  }
  const day = (value: string) => numericDay({ day: value, timezone, now });
  const header = {
    date: t('payments.columns.date'),
    kind: t('payments.columns.kind'),
    months: t('payments.columns.months'),
    amount: t('payments.columns.amount'),
    method: t('payments.columns.method'),
    status: t('payments.columns.status'),
  };
  const columns = [
    { id: 'date', header: header.date, size: 'xs' as const },
    { id: 'kind', header: header.kind, size: 'sm' as const },
    { id: 'months', header: header.months },
    { id: 'amount', header: header.amount, size: 'sm' as const, align: 'end' as const },
    { id: 'method', header: header.method, size: 'sm' as const },
    { id: 'status', header: header.status, size: 'md' as const },
  ];
  return (
    <section className="kore-payments__history" aria-labelledby="kore-payments-section">
      <h2 id="kore-payments-section" className="kore-payments__section">
        {t('payments.section')}
      </h2>
      <DataTable label={t('payments.section')} columns={columns}>
        {rows.map(({ payment, status }) => (
          <DataTableRow key={payment.id}>
            <DataTableCell label={header.date}>
              {payment.paidAt ? day(dayIn({ at: payment.paidAt, timezone })) : null}
            </DataTableCell>
            <DataTableCell primary>{t(`payments.kind.${payment.kind}`)}</DataTableCell>
            <DataTableCell label={header.months}>
              {t('payments.months', {
                start: day(payment.periodStart),
                end: day(payment.periodEnd),
                count: payment.monthsCovered,
              })}
            </DataTableCell>
            <DataTableCell label={header.amount} align="end">
              <span className="kore-payments__amount">
                {formatCents({ cents: payment.amountCents })}
              </span>
            </DataTableCell>
            <DataTableCell label={header.method}>
              {payment.method === 'pix'
                ? t('payments.method.pix')
                : payment.installments > 1
                  ? t('payments.method.cardInstallments', { count: payment.installments })
                  : t('payments.method.card')}
            </DataTableCell>
            <DataTableCell label={header.status}>
              <Badge tone={STATUS_TONES[status]}>{t(`payments.status.${status}`)}</Badge>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>
    </section>
  );
}
