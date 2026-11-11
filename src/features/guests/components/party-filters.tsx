import { Button, Input, Select } from '@kore-io/design';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  rsvpFilters,
  SEARCH_MAX_LENGTH,
  sentFilters,
  type PartyFilters as Filters,
  type RsvpFilter,
  type SentFilter,
} from '../hooks/use-party-filters';

interface SelectsProps {
  value: Pick<Filters, 'rsvp' | 'sent'>;
  onChange: (next: Partial<Filters>) => void;
}

/** Os Selects Resposta e Envio (RN13); o de Tag chega com as tags. */
function FilterSelects({ value, onChange }: SelectsProps) {
  const { t } = useTranslation('guests');
  return (
    <>
      <Select
        aria-label={t('filters.rsvp.label')}
        value={value.rsvp}
        onChange={(event) => onChange({ rsvp: event.target.value as RsvpFilter | '' })}
      >
        <option value="">{t('filters.rsvp.all')}</option>
        {(Object.keys(rsvpFilters) as RsvpFilter[]).map((key) => (
          <option key={key} value={key}>
            {t(`filters.rsvp.${rsvpFilters[key]}`)}
          </option>
        ))}
      </Select>
      <Select
        aria-label={t('filters.sent.label')}
        value={value.sent}
        onChange={(event) => onChange({ sent: event.target.value as SentFilter | '' })}
      >
        <option value="">{t('filters.sent.all')}</option>
        {(Object.keys(sentFilters) as SentFilter[]).map((key) => (
          <option key={key} value={key}>
            {t(`filters.sent.${sentFilters[key]}`)}
          </option>
        ))}
      </Select>
    </>
  );
}

/**
 * Busca e filtros da lista (RN13). Tablet e computador: a busca e os Selects na linha.
 * Celular: a busca e o botão Filtros, que abre a folha com os Selects, Mostrar resultados
 * e Limpar (decisão 194(2)); a escolha só vale no Mostrar resultados.
 */
export function PartyFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (next: Partial<Filters>) => void;
}) {
  const { t } = useTranslation('guests');
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [draft, setDraft] = useState<Pick<Filters, 'rsvp' | 'sent'>>(filters);

  function openSheet() {
    setDraft({ rsvp: filters.rsvp, sent: filters.sent });
    dialog.current?.showModal();
  }

  function closeSheet(next: Pick<Filters, 'rsvp' | 'sent'>) {
    onChange(next);
    dialog.current?.close();
  }

  return (
    <div className="kore-party-filters">
      <Input
        type="search"
        className="kore-party-filters__search"
        aria-label={t('filters.search')}
        placeholder={t('filters.search')}
        maxLength={SEARCH_MAX_LENGTH}
        value={filters.q}
        onChange={(event) => onChange({ q: event.target.value })}
      />
      <div className="kore-party-filters__selects">
        <FilterSelects value={filters} onChange={onChange} />
      </div>
      <Button variant="secondary" className="kore-party-filters__open" onClick={openSheet}>
        {t('filters.open')}
      </Button>
      <dialog ref={dialog} className="kore-party-filters__sheet" aria-labelledby={titleId}>
        <h2 id={titleId} className="kore-party-filters__title">
          {t('filters.title')}
        </h2>
        <div className="kore-party-filters__fields">
          <FilterSelects value={draft} onChange={(next) => setDraft({ ...draft, ...next })} />
        </div>
        <div className="kore-party-filters__actions">
          <Button onClick={() => closeSheet(draft)}>{t('filters.apply')}</Button>
          <Button variant="secondary" onClick={() => closeSheet({ rsvp: '', sent: '' })}>
            {t('filters.clear')}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
