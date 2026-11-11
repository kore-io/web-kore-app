import { ActionMenu } from '@kore-io/design';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { PartyListItemResponse } from '../../../shared/api/generated/model';

export type RowAction = 'open' | 'edit' | 'copy' | 'trash';

/**
 * O ⋮ de cada grupo da lista (decisões 199(2) e 200(1)): Abrir, Editar grupo, Copiar
 * link e Mover para a lixeira, com o nome "Ações de {grupo}". Quem abre um Dialog recebe
 * o botão ⋮, para o foco voltar a ele (o item do menu some ao fechar).
 */
export function PartyRowMenu({
  party,
  onAction,
}: {
  party: PartyListItemResponse;
  onAction: (input: {
    action: RowAction;
    party: PartyListItemResponse;
    trigger: HTMLElement | null;
  }) => void;
}) {
  const { t } = useTranslation('guests');
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
            { id: 'edit', label: t('partyForm.editButton'), onSelect: () => select('edit') },
            { id: 'copy', label: t('panel.link.copy'), onSelect: () => select('copy') },
          ],
          [
            {
              id: 'trash',
              label: t('trash.action'),
              destructive: true,
              onSelect: () => select('trash'),
            },
          ],
        ]}
      />
    </span>
  );
}
