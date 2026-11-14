import {
  Alert,
  Button,
  DateField,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
  Spinner,
  StatCard,
  useToast,
} from '@kore-io/design';
import { Heart } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { plannerWeddingBase } from '../../../app/area';
import { paths } from '../../../app/paths';
import {
  plannerControllerReferrerV1,
  useMeControllerMeV1,
  usePlannerControllerProfileV1,
} from '../../../shared/api/generated/me/me';
import { useMyWeddingsControllerListV1 } from '../../../shared/api/generated/planner/planner';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import {
  filterWeddings,
  hasFilters,
  NO_FILTERS,
  STATUS_FILTERS,
  type MyWeddingsFilters,
  type StatusFilter,
} from './my-weddings-filters';
import { WeddingsAlerts } from './weddings-alerts';
import { WeddingsList } from './weddings-list';

/** Até o D4b, a linha leva ao casamento dela (o Dashboard, D1); depois, ao detalhe. */
const weddingPath = (weddingId: string) => plannerWeddingBase({ weddingId });

/**
 * Meus casamentos (`/cerimonialista`; Meus casamentos RN01 a RN07, RN12 e RN13; Penpot 03,
 * "sem a F3"; decisão 257): o Alert do perfil mínimo, os alertas, o Resumo (Ativos e
 * Aguardando o casal), a busca e os filtros no app, a lista e os vazios.
 */
export function MyWeddingsPage() {
  const { t } = useTranslation('planner');
  const navigate = useNavigate();
  const list = useMyWeddingsControllerListV1();
  const me = useMeControllerMeV1();
  const profile = usePlannerControllerProfileV1();
  const [filters, setFilters] = useState<MyWeddingsFilters>(NO_FILTERS);

  const newWedding = (
    <Button type="button" onClick={() => void navigate(paths.plannerNewWedding)}>
      {t('myWeddings.newWedding')}
    </Button>
  );

  if (list.isError) {
    return (
      <div className="kore-my-weddings">
        <PageHeader title={t('myWeddings.title')} actions={newWedding} />
        <LoadErrorNotice onRetry={() => void list.refetch()} />
      </div>
    );
  }
  if (!list.data) {
    return (
      <div className="kore-my-weddings__loading">
        <Spinner label={t('myWeddings.loading')} />
      </div>
    );
  }

  const { summary, alerts, weddings } = list.data;
  const organization = me.data?.planner?.organization ?? '';
  const filtered = filterWeddings({ weddings, filters });
  const filtering = hasFilters({ filters });
  const total = t('myWeddings.weddings', { count: weddings.length });
  const description = filtering
    ? t('myWeddings.filtered', { shown: filtered.length, count: weddings.length })
    : t('myWeddings.subtitle', {
        weddings: organization
          ? t('myWeddings.ofOrganization', { weddings: total, organization })
          : total,
        active: t('myWeddings.active', { count: summary.active }),
      });
  const minimalProfile = profile.data?.profileComplete === false;

  return (
    <div className="kore-my-weddings">
      <PageHeader
        title={t('myWeddings.title')}
        {...(weddings.length > 0 && { description })}
        actions={newWedding}
      />
      {minimalProfile && (
        <Alert tone="info" title={t('myWeddings.minimalProfile.title')}>
          <p>{t('myWeddings.minimalProfile.description')}</p>
          <Link className="kore-my-weddings__alert-link" to={paths.plannerProfile}>
            {t('myWeddings.minimalProfile.link')}
          </Link>
        </Alert>
      )}
      {weddings.length === 0 ? (
        <EmptyWeddings />
      ) : (
        <>
          <WeddingsAlerts alerts={alerts} weddingPath={weddingPath} />
          <div className="kore-my-weddings__summary">
            <StatCard
              label={t('myWeddings.summary.active')}
              value={summary.active}
              detail={t('myWeddings.summary.activeDetail', { count: weddings.length })}
            />
            <StatCard
              label={t('myWeddings.summary.awaitingCouple')}
              value={summary.awaitingCouple}
              detail={
                <>
                  <span className="kore-my-weddings__detail-long">
                    {t('myWeddings.summary.awaitingCoupleDetail')}
                  </span>
                  <span className="kore-my-weddings__detail-short">
                    {t('myWeddings.summary.awaitingCoupleDetailShort')}
                  </span>
                </>
              }
            />
          </div>
          <WeddingsFilters filters={filters} onChange={setFilters} filtering={filtering} />
          {filtered.length === 0 ? (
            <div className="kore-my-weddings__no-results">
              <p>{t('myWeddings.filters.noResults')}</p>
              <Button type="button" variant="secondary" onClick={() => setFilters(NO_FILTERS)}>
                {t('myWeddings.filters.clear')}
              </Button>
            </div>
          ) : (
            <WeddingsList weddings={filtered} weddingPath={weddingPath} />
          )}
        </>
      )}
    </div>
  );
}

/** A busca, o status e a data (decisão 257(2) e (3)); o Limpar filtros com algum ligado. */
function WeddingsFilters({
  filters,
  onChange,
  filtering,
}: {
  filters: MyWeddingsFilters;
  onChange: (filters: MyWeddingsFilters) => void;
  filtering: boolean;
}) {
  const { t } = useTranslation('planner');
  const fromId = useId();
  const toId = useId();
  const set = (patch: Partial<MyWeddingsFilters>) => onChange({ ...filters, ...patch });
  return (
    <div className="kore-my-weddings__filters">
      <Input
        type="search"
        className="kore-my-weddings__search"
        aria-label={t('myWeddings.filters.search')}
        placeholder={t('myWeddings.filters.search')}
        value={filters.search}
        onChange={(event) => set({ search: event.target.value })}
      />
      <Select
        aria-label={t('myWeddings.filters.status')}
        value={filters.status}
        onChange={(event) => set({ status: event.target.value as StatusFilter })}
      >
        <option value="all">{t('myWeddings.filters.allStatuses')}</option>
        {STATUS_FILTERS.map((status) => (
          <option key={status} value={status}>
            {t(`myWeddings.status.${status}`)}
          </option>
        ))}
      </Select>
      <Select
        aria-label={t('myWeddings.filters.date')}
        value={filters.dateMode}
        onChange={(event) =>
          set({ dateMode: event.target.value as MyWeddingsFilters['dateMode'], from: '', to: '' })
        }
      >
        <option value="any">{t('myWeddings.filters.anyDate')}</option>
        <option value="period">{t('myWeddings.filters.period')}</option>
      </Select>
      {filters.dateMode === 'period' && (
        <div className="kore-my-weddings__period">
          <div className="kore-my-weddings__period-field">
            <Label htmlFor={fromId}>{t('myWeddings.filters.from')}</Label>
            <DateField
              id={fromId}
              value={filters.from}
              onChange={(event) => set({ from: event.target.value })}
            />
          </div>
          <div className="kore-my-weddings__period-field">
            <Label htmlFor={toId}>{t('myWeddings.filters.to')}</Label>
            <DateField
              id={toId}
              value={filters.to}
              onChange={(event) => set({ to: event.target.value })}
            />
          </div>
        </div>
      )}
      {filtering && (
        <Button type="button" variant="ghost" onClick={() => onChange(NO_FILTERS)}>
          {t('myWeddings.filters.clear')}
        </Button>
      )}
    </div>
  );
}

/** O vazio (RN12; decisão 257(4)): Criar casamento e Copiar link de indicação, ali mesmo. */
function EmptyWeddings() {
  const { t } = useTranslation('planner');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const genericError = () =>
    showToast({
      tone: 'danger',
      message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
    });
  const copyLink = () =>
    void plannerControllerReferrerV1()
      .then(({ link }) => navigator.clipboard.writeText(link))
      .then(() => showToast({ tone: 'success', message: t('myWeddings.empty.copied') }))
      .catch(genericError);
  return (
    <EmptyState
      icon={<Heart />}
      title={t('myWeddings.empty.title')}
      description={t('myWeddings.empty.description')}
      action={
        <div className="kore-my-weddings__empty-actions">
          <Button type="button" onClick={() => void navigate(paths.plannerNewWedding)}>
            {t('myWeddings.empty.create')}
          </Button>
          <Button type="button" variant="secondary" onClick={copyLink}>
            {t('myWeddings.empty.copyLink')}
          </Button>
        </div>
      }
    />
  );
}
