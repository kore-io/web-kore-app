import { Button, Dialog, Input, Select } from '@kore-io/design';
import { useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { usePartiesControllerListV1 } from '../../../shared/api/generated/parties/parties';
import { useDebouncedValue } from '../../../shared/hooks/use-debounced-value';
import { SEARCH_MAX_LENGTH } from '../hooks/use-party-filters';

/** Quantos grupos a escolha mostra de uma vez (o máximo do GET /parties). */
const GROUP_OPTIONS_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 300;

interface MoveGuestDialogProps {
  weddingId: string;
  guest: { id: string; name: string } | null;
  fromPartyId: string;
  isMoving: boolean;
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onMove: (toParty: { id: string; name: string }) => void;
}

/**
 * Dialog do Mover de grupo (decisão 201): "Mover {nome} para outro grupo", a busca pelo
 * nome e o Select dos grupos (sem o atual, em ordem alfabética, até 100), Cancelar · Mover.
 */
export function MoveGuestDialog({
  weddingId,
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
        {groups.isSuccess && options.length === 0 && (
          <p className="kore-move-guest__empty">{t('noResults')}</p>
        )}
      </div>
    </Dialog>
  );
}
