import { Button, EmptyState, Select, Spinner } from '@kore-io/design';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import type { PartiesControllerListV1Params } from '../../../shared/api/generated/model';
import { usePartiesControllerListV1Infinite } from '../../../shared/api/generated/parties/parties';
import { useTagsControllerListV1 } from '../../../shared/api/generated/tags/tags';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { PartyList } from '../../guests/components/party-list';
import type { Audience } from '../../guests/hooks/use-active-wedding';
import { sentFilters } from '../../guests/hooks/use-party-filters';
import type { DeliveryKind } from '../delivery-texts';
import { DELIVERY_LIMIT, useDeliverySelection } from '../hooks/use-delivery-selection';
import { ClosedNotice, type Closed } from './send-page';

type SentFilter = '' | 'not_sent' | 'sent' | 'viewed' | 'responded';
type SaveTheDateFilter = '' | 'not_sent' | 'sent';

/**
 * A etapa Grupos (Envios RN03 e RN04; Penpot A2 a A4): o convite com os filtros Envio (abre
 * em "não enviado") e Tag; o save the date com "Todos · Não enviado · Enviado"; o lembrete
 * só com a fila (enviados com convidado com nome pendente). "{n} grupos marcados" e
 * Continuar, até 200 (RN10); fechado, a legenda (RN01).
 */
export function GroupsStep({
  weddingId,
  audience,
  kind,
  closed,
}: {
  weddingId: string;
  audience: Audience;
  kind: DeliveryKind;
  closed: Closed;
}) {
  const { t } = useTranslation('deliveries');
  const { t: tGuests } = useTranslation('guests');
  const [search, setSearch] = useSearchParams();
  // O cartão Envios do Dashboard abre o convite com o status tocado (?envio=visualizado,
  // Dashboard RN02); sem ele, "não enviado" (Envios RN04).
  const [sent, setSent] = useState<SentFilter>(() => {
    const fromUrl = search.get('envio');
    return fromUrl && fromUrl in sentFilters
      ? sentFilters[fromUrl as keyof typeof sentFilters]
      : 'not_sent';
  });
  const [saveTheDate, setSaveTheDate] = useState<SaveTheDateFilter>('');
  const [tag, setTag] = useState('');
  const tags = useTagsControllerListV1(weddingId, { query: { enabled: kind !== 'save_the_date' } });
  const params: PartiesControllerListV1Params = {
    limit: 100,
    ...(kind === 'invite' && sent && { sent }),
    ...(kind !== 'save_the_date' && tag && { tag }),
    ...(kind === 'save_the_date' && saveTheDate && { saveTheDate }),
    ...(kind === 'reminder' && { remind: 'true' }),
  };
  const query = usePartiesControllerListV1Infinite(weddingId, params, {
    query: {
      initialPageParam: undefined,
      getNextPageParam: (page) => page.nextCursor ?? undefined,
    },
  });
  const pages = query.data?.pages ?? [];
  const parties = pages.flatMap((page) => page.data);
  const total = pages[0]?.total ?? 0;
  const selection = useDeliverySelection({
    weddingId,
    kind,
    visibleIds: parties.map((party) => party.id),
  });
  // Lembrar pendentes vindo da lista (A9): os marcados que não estão na fila do lembrete
  // ficam de fora, com a linha; conta só quando a fila inteira está carregada.
  const listed = new Set(parties.map((party) => party.id));
  const outside =
    kind === 'reminder' && !query.hasNextPage && !query.isPending
      ? selection.ids.filter((id) => !listed.has(id))
      : [];
  const entering = selection.ids.filter((id) => !outside.includes(id));
  const over = entering.length > DELIVERY_LIMIT;
  const blocked = closed !== null || entering.length === 0 || over;

  function list() {
    if (query.isPending) {
      return (
        <div className="kore-send__loading">
          <Spinner label={t('title')} />
        </div>
      );
    }
    if (query.isError && pages.length === 0) {
      return <LoadErrorNotice onRetry={() => void query.refetch()} />;
    }
    if (kind === 'reminder' && parties.length === 0) {
      return (
        <EmptyState
          icon={<CheckCircle2 />}
          title={t('reminder.emptyTitle')}
          description={t('reminder.emptyDescription')}
        />
      );
    }
    return (
      <PartyList
        parties={parties}
        selection={selection}
        hasMore={query.hasNextPage}
        isLoadingMore={query.isFetchingNextPage}
        loadMoreFailed={query.isFetchNextPageError}
        onLoadMore={() => void query.fetchNextPage()}
        actionsFor={() => null}
      />
    );
  }

  return (
    <div className="kore-send">
      {kind === 'reminder' && total > 0 && (
        <p className="kore-send__header">{t('reminder.header', { count: total })}</p>
      )}
      {kind !== 'save_the_date' && (
        <div className="kore-send__filters">
          {kind === 'invite' && (
            <Select
              aria-label={tGuests('filters.sent.label')}
              value={sent}
              onChange={(event) => setSent(event.target.value as SentFilter)}
            >
              {(['', 'not_sent', 'sent', 'viewed', 'responded'] as const).map((value) => (
                <option key={value} value={value}>
                  {tGuests(`filters.sent.${value || 'all'}`)}
                </option>
              ))}
            </Select>
          )}
          <Select
            aria-label={tGuests('filters.tag.label')}
            value={tag}
            onChange={(event) => setTag(event.target.value)}
          >
            <option value="">{tGuests('filters.tag.all')}</option>
            {(tags.data?.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {tGuests('filters.tag.option', { name: item.name })}
              </option>
            ))}
          </Select>
        </div>
      )}
      {kind === 'save_the_date' && (
        <div className="kore-send__filters">
          <Select
            aria-label={t('tabs.saveTheDate')}
            value={saveTheDate}
            onChange={(event) => setSaveTheDate(event.target.value as SaveTheDateFilter)}
          >
            {(['', 'not_sent', 'sent'] as const).map((value) => (
              <option key={value} value={value}>
                {t(`groups.saveTheDateFilter.${value || 'all'}`)}
              </option>
            ))}
          </Select>
        </div>
      )}
      {list()}
      {outside.length > 0 && (
        <p className="kore-send__note">{t('reminder.outside', { count: outside.length })}</p>
      )}
      <div className="kore-send__bar">
        <p className="kore-send__count" aria-live="polite">
          {t('groups.marked', { count: entering.length })}
        </p>
        {over && (
          <p className="kore-send__error" id="kore-send-limit">
            {t(`groups.limit.${audience}`, { count: entering.length })}
          </p>
        )}
        <ClosedNotice audience={audience} closed={closed} />
        <Button
          disabled={blocked}
          {...(closed === 'not_published'
            ? { 'aria-describedby': 'kore-send-closed' }
            : over && { 'aria-describedby': 'kore-send-limit' })}
          onClick={() => {
            // Seguem só os que entram (A9).
            if (outside.length > 0) selection.setIds(entering);
            setSearch({ etapa: 'canal' });
          }}
        >
          {t('groups.continue')}
        </Button>
      </div>
    </div>
  );
}
