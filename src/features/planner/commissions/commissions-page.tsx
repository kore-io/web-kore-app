import {
  Badge,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
  Tab,
  Tabs,
  type BadgeTone,
} from '@kore-io/design';
import type { TFunction } from 'i18next';
import { CreditCard } from 'lucide-react';
import { keepPreviousData } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { paths } from '../../../app/paths';
import type {
  AdjustmentLineResponse,
  CommissionBalancesResponse,
  CommissionLineResponse,
  PayoutsResponse,
  ReferrerCommissionsControllerListV1View,
  WeddingCommissionsResponse,
} from '../../../shared/api/generated/model';
import { useReferrerCommissionsControllerListV1 } from '../../../shared/api/generated/planner/planner';
import { usePayoutsControllerListV1 } from '../../../shared/api/generated/referral/referral';
import { DataTable, DataTableCell, DataTableRow } from '../../../shared/components/data-table';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { Pagination } from '../../../shared/components/pagination';
import { DEFAULT_TIMEZONE } from '../../../shared/date-texts';
import { formatCents } from '../../../shared/money';
import { dayIn, numericDay } from '../../billing/payments/payments-texts';

/** As comissões e o prazo de liberação seguem o fuso de São Paulo (Comissões RN02). */
const TIMEZONE = DEFAULT_TIMEZONE;

type Status = CommissionLineResponse['status'];

/**
 * Os selos (Comissões RN07; textos-f3 B6): Aguardando liberação e Retida em amarelo,
 * Disponível e Paga em verde, Estornada neutra e Bloqueada em vermelho (316, "Fora das 17").
 */
const STATUS_TONES: Record<Status, BadgeTone> = {
  pending: 'warning',
  available: 'success',
  paid: 'success',
  reversed: 'neutral',
  blocked: 'danger',
  held: 'warning',
};

/** O dia curto de um instante, no fuso das comissões: "09/09", com o ano fora do corrente. */
function shortDay({ at, now }: { at: string; now: Date }): string {
  return numericDay({ day: dayIn({ at, timezone: TIMEZONE }), timezone: TIMEZONE, now });
}

/** "28/09", sem o ano, como no "Paga em" (Voz, Comissões). */
function dayMonth({ at }: { at: string }): string {
  const [, month, date] = dayIn({ at, timezone: TIMEZONE }).split('-');
  return `${date}/${month}`;
}

/** O nome do casamento, ou a lápide do expurgado (Retenção RN03; revisão técnica B5-8). */
function WeddingName({
  item,
}: {
  item: Pick<CommissionLineResponse, 'weddingId' | 'coupleNames' | 'weddingPurged' | 'clickable'>;
}) {
  const { t } = useTranslation('planner');
  if (item.weddingPurged || !item.coupleNames) return <>{t('commissions.purged')}</>;
  // O casamento que ela ainda vê abre o detalhe em Meus casamentos (Comissões RN07).
  if (item.clickable && item.weddingId) {
    return (
      <Link
        className="kore-commissions__wedding"
        to={`${paths.plannerArea}?casamento=${encodeURIComponent(item.weddingId)}`}
      >
        {item.coupleNames}
      </Link>
    );
  }
  return <>{item.coupleNames}</>;
}

/**
 * Comissões (`/cerimonialista/comissoes`, a rota dos e-mails; Comissões do indicador RN02 e
 * RN07; App do Cerimonialista, Penpot 07; textos-f3 B6; decisões 266(2), 284(3), 315 e 346):
 * - os saldos Disponível · Aguardando liberação · Já recebido, com "R$ 0,00 (R$ 158,04 em
 *   repasse)" enquanto há pedido e as legendas que os dados já dão (346(2));
 * - o Extrato, nas abas Por pagamento e Por casamento (346(1): as colunas que a API tem);
 * - os selos, as legendas da Retida e da Bloqueada, o ajuste em vermelho, a lápide e o vazio;
 * - sem subtítulo e sem nenhum percentual (315; 346(4)).
 * O Pedir repasse e os Repasses (E19) e os Dados para receber (E17) vêm depois.
 */
export function CommissionsPage() {
  const { t } = useTranslation('planner');
  const [view, setView] = useState<ReferrerCommissionsControllerListV1View>('payment');
  const [page, setPage] = useState(1);
  // Ao trocar de aba ou de página, a tela segue com os dados de antes até os novos chegarem:
  // as abas não somem e o foco fica no botão (sugestão do Crivo).
  const list = useReferrerCommissionsControllerListV1(
    { view, page },
    { query: { placeholderData: keepPreviousData } },
  );
  // O que o Pedir repasse exige (Repasse RN04): o mínimo, os repasses ligados e o intervalo.
  const payouts = usePayoutsControllerListV1();
  const data = list.data;

  return (
    <div className="kore-commissions">
      <PageHeader title={t('commissions.title')} />
      {list.isError ? (
        <LoadErrorNotice onRetry={() => void list.refetch()} />
      ) : !data ? (
        <div className="kore-commissions__loading">
          <Spinner label={t('commissions.loading')} />
        </div>
      ) : (
        <>
          <Balances balances={data.balances} payouts={payouts.data} />
          <section
            className="kore-commissions__statement"
            aria-labelledby="kore-commissions-statement"
          >
            <h2 id="kore-commissions-statement" className="kore-commissions__title">
              {t('commissions.statement')}
            </h2>
            <Tabs aria-label={t('commissions.tabs.label')}>
              {(['payment', 'wedding'] as const).map((tab) => (
                <Tab key={tab} asChild current={view === tab}>
                  <button
                    type="button"
                    onClick={() => {
                      setView(tab);
                      setPage(1);
                    }}
                  >
                    {t(`commissions.tabs.${tab}`)}
                  </button>
                </Tab>
              ))}
            </Tabs>
            {data.total === 0 ? (
              <EmptyState
                icon={<CreditCard />}
                title={t('commissions.empty.title')}
                description={t('commissions.empty.description')}
              />
            ) : data.view === 'payment' ? (
              // A tabela segue a resposta, e não a aba: na troca, os dados de antes ficam na
              // tela até os novos chegarem (keepPreviousData).
              <ByPayment
                items={data.items as (CommissionLineResponse | AdjustmentLineResponse)[]}
              />
            ) : (
              <ByWedding
                items={data.items as WeddingCommissionsResponse[]}
                canRequest={canRequestPayout({ balances: data.balances, payouts: payouts.data })}
              />
            )}
            {data.total > data.pageSize && (
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={setPage}
                labels={{
                  navigation: t('commissions.pagination.navigation'),
                  summary: (range) => t('commissions.pagination.summary', range),
                  previous: t('commissions.pagination.previous'),
                  next: t('commissions.pagination.next'),
                }}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}

/**
 * "já pode pedir o repasse" só quando o pedido é possível (Repasse RN04; bloqueante do Crivo
 * no E16): os repasses ligados, o saldo a partir do mínimo, sem repasse em aberto e fora do
 * intervalo entre pedidos. Sem a leitura dos repasses, a legenda não aparece.
 */
export function canRequestPayout({
  balances,
  payouts,
}: {
  balances: CommissionBalancesResponse;
  payouts: PayoutsResponse | undefined;
}): boolean {
  if (!payouts) return false;
  return (
    payouts.payoutsEnabled &&
    balances.inPayoutCents === 0 &&
    balances.availableCents >= payouts.minimumCents &&
    payouts.nextRequestAt === null
  );
}

/** O ajuste com o sinal: "−R$ 50,02" e "+R$ 50,02" (351(2)). */
function signedCents({ cents }: { cents: number }): string {
  const text = formatCents({ cents });
  return cents > 0 ? `+${text}` : text;
}

/** Os saldos (Comissões RN02 e RN07; 266(2); 346(2)). */
function Balances({
  balances,
  payouts,
}: {
  balances: CommissionBalancesResponse;
  payouts: PayoutsResponse | undefined;
}) {
  const { t } = useTranslation('planner');
  const now = new Date();
  const available = formatCents({ cents: balances.availableCents });
  return (
    <div className="kore-commissions__balances">
      <StatCard
        label={t('commissions.balances.available')}
        value={
          balances.inPayoutCents > 0
            ? t('commissions.balances.inPayout', {
                available,
                inPayout: formatCents({ cents: balances.inPayoutCents }),
              })
            : available
        }
        detail={
          // O ajuste sem repasse já está no saldo (346(2)) e vem antes da legenda do pedido,
          // as duas juntas por " · " (350(9); 351(2)); o ajuste positivo leva o "+".
          balances.adjustmentsCents !== 0
            ? t(
                canRequestPayout({ balances, payouts })
                  ? 'commissions.balances.withAdjustmentCanRequest'
                  : 'commissions.balances.withAdjustment',
                { amount: signedCents({ cents: balances.adjustmentsCents }) },
              )
            : canRequestPayout({ balances, payouts })
              ? t('commissions.balances.canRequest')
              : undefined
        }
      />
      <StatCard
        label={t('commissions.balances.pending')}
        value={formatCents({ cents: balances.pendingCents })}
        detail={
          // A próxima liberação (346(2); 349(1)): a data mais próxima das comissões que ainda
          // aguardam, que a API manda pronta no fuso de São Paulo (nextReleaseAt).
          balances.pendingCents === 0
            ? t('commissions.balances.nothingPending')
            : balances.nextReleaseAt
              ? t('commissions.caption.pending', {
                  date: numericDay({ day: balances.nextReleaseAt, timezone: TIMEZONE, now }),
                })
              : undefined
        }
      />
      <StatCard
        label={t('commissions.balances.received')}
        value={formatCents({ cents: balances.receivedCents })}
        detail={
          balances.paidPayouts > 0
            ? t('commissions.balances.payouts', { count: balances.paidPayouts })
            : undefined
        }
      />
    </div>
  );
}

/** O selo e a legenda de uma comissão (Comissões RN02, RN06 e RN07; 284(3)). */
function statusCaption({
  item,
  now,
  t,
}: {
  item: CommissionLineResponse;
  now: Date;
  t: TFunction<'planner'>;
}): { label: string; caption: string | null } {
  switch (item.status) {
    case 'pending':
      return {
        label: t('commissions.status.pending'),
        caption: t('commissions.caption.pending', {
          date: shortDay({ at: item.availableAt, now }),
        }),
      };
    case 'paid':
      return {
        label: t('commissions.status.paid', {
          date: item.paidAt ? dayMonth({ at: item.paidAt }) : '',
        }),
        caption: null,
      };
    case 'blocked':
      return { label: t('commissions.status.blocked'), caption: t('commissions.caption.blocked') };
    case 'held':
      return { label: t('commissions.status.held'), caption: t('commissions.caption.held') };
    default:
      return { label: t(`commissions.status.${item.status}`), caption: null };
  }
}

/** Por pagamento (Comissões RN07): uma linha por comissão e por ajuste. */
function ByPayment({ items }: { items: (CommissionLineResponse | AdjustmentLineResponse)[] }) {
  const { t } = useTranslation('planner');
  const now = new Date();
  const header = {
    wedding: t('commissions.columns.wedding'),
    payment: t('commissions.columns.payment'),
    base: t('commissions.columns.base'),
    commission: t('commissions.columns.commission'),
    status: t('commissions.columns.status'),
    date: t('commissions.columns.date'),
  };
  return (
    <DataTable
      label={t('commissions.tabs.payment')}
      columns={[
        { id: 'wedding', header: header.wedding },
        { id: 'payment', header: header.payment, size: 'sm' },
        { id: 'base', header: header.base, size: 'sm', align: 'end' },
        { id: 'commission', header: header.commission, size: 'sm', align: 'end' },
        { id: 'status', header: header.status, size: 'lg' },
        { id: 'date', header: header.date, size: 'xs' },
      ]}
    >
      {items.map((item) =>
        item.kind === 'adjustment' ? (
          // O ajuste: linha negativa, em vermelho, sem selo (Comissões RN07).
          <DataTableRow key={item.adjustmentId} className="kore-commissions__adjustment">
            {/* O casal do ajuste (347(2)); o manual não tem casamento, e fica "—". */}
            <DataTableCell primary>
              {item.weddingPurged ? t('commissions.purged') : (item.coupleNames ?? '—')}
            </DataTableCell>
            <DataTableCell label={header.payment}>
              {t(`commissions.adjustment.${item.reason}`)}
            </DataTableCell>
            <DataTableCell label={header.base} align="end">
              —
            </DataTableCell>
            <DataTableCell label={header.commission} align="end">
              {/* O ajuste positivo leva o "+", como na legenda do Disponível (357(1)). */}
              <span className={item.amountCents < 0 ? 'kore-commissions__negative' : undefined}>
                {signedCents({ cents: item.amountCents })}
              </span>
            </DataTableCell>
            <DataTableCell label={header.status}>
              {/* Sem repasse, o ajuste desconta ou soma no próximo (RN07; 351(6)). */}
              {item.payoutStatus === null && item.amountCents !== 0 && (
                <span className="kore-commissions__caption">
                  {t(
                    item.amountCents < 0
                      ? 'commissions.adjustment.next'
                      : 'commissions.adjustment.nextAdd',
                  )}
                </span>
              )}
            </DataTableCell>
            <DataTableCell label={header.date}>
              {shortDay({ at: item.createdAt, now })}
            </DataTableCell>
          </DataTableRow>
        ) : (
          <CommissionRow key={item.commissionId} item={item} now={now} header={header} />
        ),
      )}
    </DataTable>
  );
}

function CommissionRow({
  item,
  now,
  header,
}: {
  item: CommissionLineResponse;
  now: Date;
  header: Record<'payment' | 'base' | 'commission' | 'status' | 'date', string>;
}) {
  const { t } = useTranslation('planner');
  const { label, caption } = statusCaption({ item, now, t });
  return (
    <DataTableRow>
      <DataTableCell primary>
        <WeddingName item={item} />
      </DataTableCell>
      <DataTableCell label={header.payment}>
        {t(`commissions.paymentKind.${item.paymentKind}`)}
      </DataTableCell>
      <DataTableCell label={header.base} align="end">
        {formatCents({ cents: item.baseAmountCents })}
      </DataTableCell>
      <DataTableCell label={header.commission} align="end">
        {formatCents({ cents: item.amountCents })}
      </DataTableCell>
      <DataTableCell label={header.status}>
        <span className="kore-commissions__status">
          <Badge tone={STATUS_TONES[item.status]}>{label}</Badge>
          {caption && <span className="kore-commissions__caption">{caption}</span>}
        </span>
      </DataTableCell>
      <DataTableCell label={header.date}>{shortDay({ at: item.createdAt, now })}</DataTableCell>
    </DataTableRow>
  );
}

/**
 * Por casamento (Comissões RN07; 346(1)): a soma por casal, com as legendas "já pode pedir o
 * repasse", "Libera em 09/09" (com várias, "libera em 02/10 e em 10/10") e "nada a liberar
 * agora"; e Origem, Pagamentos, Já recebido e o Total em destaque (346(1); Penpot 07).
 */
function ByWedding({
  items,
  canRequest,
}: {
  items: WeddingCommissionsResponse[];
  /** O pedido é possível pelo saldo total (347(3)): senão, a linha disponível fica só no valor. */
  canRequest: boolean;
}) {
  const { t } = useTranslation('planner');
  const now = new Date();
  const header = {
    wedding: t('commissions.columns.wedding'),
    origin: t('commissions.columns.origin'),
    payments: t('commissions.columns.payments'),
    pending: t('commissions.columns.pending'),
    available: t('commissions.columns.available'),
    received: t('commissions.columns.received'),
    total: t('commissions.columns.total'),
  };
  const money = (cents: number) => (cents > 0 ? formatCents({ cents }) : '—');
  return (
    // As 7 colunas não cabem no computador estreito com a Sidebar: cartões até 1280 px.
    <DataTable
      wide
      label={t('commissions.tabs.wedding')}
      columns={[
        { id: 'wedding', header: header.wedding },
        { id: 'origin', header: header.origin, size: 'sm' },
        { id: 'payments', header: header.payments, size: 'sm', align: 'end' },
        { id: 'pending', header: header.pending, size: 'sm', align: 'end' },
        { id: 'available', header: header.available, size: 'sm', align: 'end' },
        { id: 'received', header: header.received, size: 'sm', align: 'end' },
        { id: 'total', header: header.total, size: 'sm', align: 'end' },
      ]}
    >
      {items.map((item, index) => {
        const dates = item.releaseDates.map((at) => shortDay({ at, now }));
        const legend =
          item.availableCents > 0 && canRequest
            ? t('commissions.wedding.canRequest')
            : dates.length > 0
              ? t('commissions.wedding.releases', {
                  count: dates.length,
                  dates: dates.join(' e em '),
                })
              : item.availableCents > 0
                ? null
                : t('commissions.wedding.nothing');
        return (
          <DataTableRow key={item.weddingId ?? `apagado-${index}`}>
            <DataTableCell primary>
              <span className="kore-commissions__status">
                <WeddingName item={item} />
                {legend && <span className="kore-commissions__caption">{legend}</span>}
              </span>
            </DataTableCell>
            <DataTableCell label={header.origin}>
              {item.referralSource ? t(`commissions.origin.${item.referralSource}`) : '—'}
            </DataTableCell>
            {/* No cartão, "1 pagamento" (Voz; decisão 350(13)); na tabela, o número. */}
            <DataTableCell
              label={header.payments}
              align="end"
              cardText={t('commissions.wedding.payments', { count: item.paymentsCount })}
            >
              {item.paymentsCount}
            </DataTableCell>
            <DataTableCell label={header.pending} align="end">
              {money(item.pendingCents)}
            </DataTableCell>
            <DataTableCell label={header.available} align="end">
              {/* O negativo (o ajuste do casal a descontar) em vermelho, sem legenda; o "—" só
                  no zero (353(1)). */}
              {item.availableCents < 0 ? (
                <span className="kore-commissions__negative">
                  {formatCents({ cents: item.availableCents })}
                </span>
              ) : (
                money(item.availableCents)
              )}
            </DataTableCell>
            <DataTableCell label={header.received} align="end">
              {money(item.receivedCents)}
            </DataTableCell>
            <DataTableCell label={header.total} align="end">
              <strong className="kore-commissions__total">
                {formatCents({ cents: item.totalCents })}
              </strong>
            </DataTableCell>
          </DataTableRow>
        );
      })}
    </DataTable>
  );
}
