import { Button, Input, Select } from '@kore-io/design';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TagResponse } from '../../../shared/api/generated/model';
import {
  rsvpFilters,
  SEARCH_MAX_LENGTH,
  sentFilters,
  type PartyFilters as Filters,
  type RsvpFilter,
  type SentFilter,
} from '../hooks/use-party-filters';

type SheetFilters = Pick<Filters, 'rsvp' | 'sent' | 'tag'>;

interface SelectsProps {
  value: SheetFilters;
  tags: TagResponse[];
  onChange: (next: Partial<Filters>) => void;
}

/** Os Selects Resposta, Envio e Tag (RN13; Tags RN09; decisão 194(1)). */
function FilterSelects({ value, tags, onChange }: SelectsProps) {
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
      <Select
        aria-label={t('filters.tag.label')}
        value={value.tag}
        onChange={(event) => onChange({ tag: event.target.value })}
      >
        <option value="">{t('filters.tag.all')}</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {t('filters.tag.option', { name: tag.name })}
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
  tags,
  onChange,
}: {
  filters: Filters;
  tags: TagResponse[];
  onChange: (next: Partial<Filters>) => void;
}) {
  const { t } = useTranslation('guests');
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [draft, setDraft] = useState<SheetFilters>(filters);
  const activeCount = [filters.rsvp, filters.sent, filters.tag].filter(Boolean).length;

  function openSheet() {
    setDraft({ rsvp: filters.rsvp, sent: filters.sent, tag: filters.tag });
    dialog.current?.showModal();
  }

  function closeSheet(next: SheetFilters) {
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
        <FilterSelects value={filters} tags={tags} onChange={onChange} />
      </div>
      <Button variant="secondary" className="kore-party-filters__open" onClick={openSheet}>
        {/* "Filtros (n)" com filtro ativo; a busca fica fora da folha e não conta (200(c)). */}
        {activeCount > 0 ? t('filters.openCount', { count: activeCount }) : t('filters.open')}
      </Button>
      <dialog ref={dialog} className="kore-party-filters__sheet" aria-labelledby={titleId}>
        <h2 id={titleId} className="kore-party-filters__title">
          {t('filters.title')}
        </h2>
        <div className="kore-party-filters__fields">
          <FilterSelects
            value={draft}
            tags={tags}
            onChange={(next) => setDraft({ ...draft, ...next })}
          />
        </div>
        <div className="kore-party-filters__actions">
          <Button onClick={() => closeSheet(draft)}>{t('filters.apply')}</Button>
          <Button variant="secondary" onClick={() => closeSheet({ rsvp: '', sent: '', tag: '' })}>
            {t('filters.clear')}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
