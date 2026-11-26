import { ActionMenu } from '@kore-io/design';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { PartyListItemResponse } from '../../../shared/api/generated/model';
import { useWriteLock } from '../../billing/lifecycle/blocked';

export type RowAction = 'open' | 'edit' | 'copy' | 'trash';

/**
 * O ⋮ de cada grupo da lista (decisões 199(2) e 200(1)): Abrir, Editar grupo, Copiar
 * link e Mover para a lixeira, com o nome "Ações de {grupo}". Quem abre um Dialog recebe
 * o botão ⋮, para o foco voltar a ele (o item do menu some ao fechar).
 */
export function PartyRowMenu({
  party,
  trashLocked = false,
  onAction,
}: {
  party: PartyListItemResponse;
  /** A colaboradora não exclui um grupo que já respondeu (Prazo RN08; Lixeira RN07). */
  trashLocked?: boolean;
  onAction: (input: {
    action: RowAction;
    party: PartyListItemResponse;
    trigger: HTMLElement | null;
  }) => void;
}) {
  const { t } = useTranslation('guests');
  // Bloqueado RN04: editar e mover para a lixeira são escrita; abrir e copiar, leitura.
  const lock = useWriteLock();
  const wrapper = useRef<HTMLSpanElement>(null);
  function select(action: RowAction) {
    onAction({ action, party, trigger: wrapper.current?.querySelector('button') ?? null });
  }
  return (
    <span ref={wrapper}>
      <ActionMenu
        label={t('row.menu.label', { name: party.name })}
        groups={[
          [
            { id: 'open', label: t('row.menu.open'), onSelect: () => select('open') },
            {
              id: 'edit',
              label: t('partyForm.editButton'),
              ...(lock.reason && { disabled: true, disabledReason: lock.reason }),
              onSelect: () => select('edit'),
            },
            { id: 'copy', label: t('panel.link.copy'), onSelect: () => select('copy') },
          ],
          [
            {
              id: 'trash',
              label: t('trash.action'),
              destructive: true,
              disabled: lock.locked || trashLocked,
              disabledReason: lock.reason ?? t('trash.alreadyResponded.party'),
              onSelect: () => select('trash'),
            },
          ],
        ]}
      />
    </span>
  );
}
