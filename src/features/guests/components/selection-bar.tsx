import { ActionMenu, Button, Tag } from '@kore-io/design';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { TagResponse } from '../../../shared/api/generated/model';
import type { Audience } from '../hooks/use-active-wedding';

/** O máximo de grupos do POST /tags/:id/apply (decisão 206). */
export const APPLY_TAG_MAX_PARTIES = 200;

interface SelectionBarProps {
  count: number;
  audience: Audience;
  tags: TagResponse[];
  isApplying: boolean;
  onApplyTag: (tagId: string) => void;
  onTrash: () => void;
}

/**
 * Barra da seleção múltipla (RN13; decisão 197): "{n} grupos selecionados", o Adicionar
 * tag, que abre o Menu de ações com as tags (decisão 204), e o Mover para a lixeira
 * (Lixeira RN06). Sem nenhuma tag, o Adicionar tag fica desabilitado; com mais de 200
 * marcados (o máximo do apply e do POST /parties/trash), os dois, com o aviso da 206.
 */
export function SelectionBar({
  count,
  audience,
  tags,
  isApplying,
  onApplyTag,
  onTrash,
}: SelectionBarProps) {
  const { t } = useTranslation('guests');
  // Acima de 200 marcados, o apply recusaria: o botão fica desabilitado com o aviso (206).
  const tooMany = count > APPLY_TAG_MAX_PARTIES;
  const hintId = useId();
  return (
    <div className="kore-selection-bar">
      <p className="kore-selection-bar__count" role="status">
        {t('selected', { count })}
      </p>
      <div className="kore-selection-bar__actions">
        <ActionMenu
          label={t('selection.addTag')}
          trigger={
            <Button
              variant="secondary"
              size="sm"
              disabled={tags.length === 0 || tooMany || isApplying}
              aria-describedby={tooMany ? hintId : undefined}
            >
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
        <Button
          variant="destructive"
          size="sm"
          disabled={tooMany}
          aria-describedby={tooMany ? hintId : undefined}
          onClick={onTrash}
        >
          {t('trash.action')}
        </Button>
      </div>
      {tooMany && (
        <p id={hintId} className="kore-selection-bar__hint">
          {t(`selection.tooMany.${audience}`)}
        </p>
      )}
    </div>
  );
}
