import { Button, Dialog, Input, Select } from '@kore-io/design';
import { useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { usePartiesControllerListV1 } from '../../../shared/api/generated/parties/parties';
import { useDebouncedValue } from '../../../shared/hooks/use-debounced-value';
import type { Audience } from '../hooks/use-active-wedding';
import { SEARCH_MAX_LENGTH } from '../hooks/use-party-filters';

/** Quantos grupos a escolha mostra de uma vez (o máximo do GET /parties). */
const GROUP_OPTIONS_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 300;

interface MoveGuestDialogProps {
  weddingId: string;
  audience: Audience;
  guest: { id: string; name: string } | null;
  fromPartyId: string;
  isMoving: boolean;
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onMove: (toParty: { id: string; name: string }) => void;
}

/**
 * Dialog do Mover de grupo (decisão 201): "Mover {nome} para outro grupo", a busca pelo
 * nome e o Select dos grupos (sem o atual, em ordem alfabética, até 100; com mais, a linha
 * de apoio da decisão 203), Cancelar · Mover.
 */
export function MoveGuestDialog({
  weddingId,
  audience,
  guest,
  fromPartyId,
  isMoving,
  returnFocusRef,
  onClose,
  onMove,
}: MoveGuestDialogProps) {
  const { t } = useTranslation('guests');
  const [search, setSearch] = useState('');
  const [toPartyId, setToPartyId] = useState('');
  const q = useDebouncedValue({ value: search.trim(), delayMs: SEARCH_DEBOUNCE_MS });
  const groups = usePartiesControllerListV1(
    weddingId,
    { ...(q && { q }), limit: GROUP_OPTIONS_LIMIT },
    { query: { enabled: guest !== null } },
  );
  const options = (groups.data?.data ?? []).filter((party) => party.id !== fromPartyId);
  const toParty = options.find((party) => party.id === toPartyId);
  // Mais grupos do que cabem no Select: a linha de apoio pede a busca (decisão 203).
  // O Select tira o grupo atual: a conta mostra só as opções (e o total sem o atual).
  const shown = options.length;
  const listedCurrent = (groups.data?.data.length ?? 0) > options.length;
  const total = Math.max((groups.data?.total ?? 0) - (q ? (listedCurrent ? 1 : 0) : 1), 0);

  function close() {
    setSearch('');
    setToPartyId('');
    onClose();
  }

  return (
    <Dialog
      open={guest !== null}
      onOpenChange={(open) => !open && close()}
      role="dialog"
      returnFocusRef={returnFocusRef}
      title={guest ? t('panel.move.title', { name: guest.name }) : ''}
      actions={
        <>
          <Button variant="secondary" onClick={close}>
            {t('panel.move.cancel')}
          </Button>
          <Button
            disabled={!toParty || isMoving}
            onClick={() => toParty && onMove({ id: toParty.id, name: toParty.name })}
          >
            {t('panel.move.confirm')}
          </Button>
        </>
      }
    >
      <div className="kore-move-guest">
        <Input
          type="search"
          aria-label={t('panel.move.search')}
          placeholder={t('panel.move.search')}
          maxLength={SEARCH_MAX_LENGTH}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          aria-label={t('panel.move.group')}
          placeholder={t('panel.move.group')}
          value={toParty ? toPartyId : ''}
          onChange={(event) => setToPartyId(event.target.value)}
        >
          {options.map((party) => (
            <option key={party.id} value={party.id}>
              {party.name}
            </option>
          ))}
        </Select>
        {total > shown && (
          <p className="kore-move-guest__more">
            {t(`panel.move.more.${audience}`, { shown, total })}
          </p>
        )}
        {groups.isSuccess && options.length === 0 && (
          <p className="kore-move-guest__empty">{t('noResults')}</p>
        )}
      </div>
    </Dialog>
  );
}
