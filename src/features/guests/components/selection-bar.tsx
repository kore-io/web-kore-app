import { ActionMenu, Button, Tag } from '@kore-io/design';
import { useTranslation } from 'react-i18next';
import type { TagResponse } from '../../../shared/api/generated/model';

interface SelectionBarProps {
  count: number;
  tags: TagResponse[];
  isApplying: boolean;
  onApplyTag: (tagId: string) => void;
}

/**
 * Barra da seleção múltipla (RN13; decisão 197): "{n} grupos selecionados" e o Adicionar
 * tag, que abre o Menu de ações com as tags (decisão 204). Sem nenhuma tag, o botão fica
 * desabilitado. "Mover para a lixeira" entra com a lixeira.
 */
export function SelectionBar({ count, tags, isApplying, onApplyTag }: SelectionBarProps) {
  const { t } = useTranslation('guests');
  return (
    <div className="kore-selection-bar">
      <p className="kore-selection-bar__count" role="status">
        {t('selected', { count })}
      </p>
      <div className="kore-selection-bar__actions">
        <ActionMenu
          label={t('selection.addTag')}
          trigger={
            <Button variant="secondary" size="sm" disabled={tags.length === 0 || isApplying}>
              {t('selection.addTag')}
            </Button>
          }
          groups={[
            tags.map((tag) => ({
              id: tag.id,
              label: tag.name,
              content: <Tag color={tag.color}>{tag.name}</Tag>,
              onSelect: () => onApplyTag(tag.id),
            })),
          ]}
        />
      </div>
    </div>
  );
}
