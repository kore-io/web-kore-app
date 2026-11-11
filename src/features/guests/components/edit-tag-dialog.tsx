import { Button, Dialog, Input, Tag, type TagColorName } from '@kore-io/design';
import { useId, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { TagResponse, TagResponseColor } from '../../../shared/api/generated/model';
import { FormField } from '../../../shared/components/form-field';
import type { Audience } from '../hooks/use-active-wedding';
import type { TagNameError } from '../hooks/use-tags';

/** As cores de tag do DS (decisão 191(1)), na ordem do Penpot; null é "Sem cor". */
const COLORS: (TagColorName | null)[] = [
  null,
  'wine',
  'champagne',
  'green',
  'amber',
  'red',
  'blue',
];

/** O limite do nome trava a digitação, sem mensagem (Tags RN02). */
export const TAG_NAME_MAX_LENGTH = 40;

interface EditTagDialogProps {
  tag: TagResponse | null;
  audience: Audience;
  isSaving: boolean;
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSave: (args: {
    name: string;
    color: TagResponseColor;
    onDone: (error: TagNameError) => void;
  }) => void;
  onDelete: () => void;
}

/**
 * Editar tag (Tags RN06; Penpot "Editar tag"): o nome, a cor (Sem cor + as 6 cores do DS)
 * e Excluir tag · Cancelar · Salvar alterações. Nome vazio e nome repetido marcam o campo.
 */
export function EditTagDialog(props: EditTagDialogProps) {
  // Um formulário novo por tag: o nome e a cor começam com os dela.
  return <EditTagForm key={props.tag?.id ?? 'none'} {...props} />;
}

function EditTagForm({
  tag,
  audience,
  isSaving,
  returnFocusRef,
  onClose,
  onSave,
  onDelete,
}: EditTagDialogProps) {
  const { t } = useTranslation('guests');
  const colorsLabel = useId();
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState<TagResponseColor>(tag?.color ?? null);
  const [error, setError] = useState<TagNameError>(null);

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('empty');
      return;
    }
    onSave({ name: trimmed, color, onDone: (result) => (result ? setError(result) : onClose()) });
  }

  const hint =
    error === 'empty'
      ? t(`tags.nameEmpty.${audience}`)
      : error === 'taken'
        ? t('tags.nameTaken')
        : undefined;

  return (
    <Dialog
      open={tag !== null}
      onOpenChange={(open) => !open && onClose()}
      role="dialog"
      size="lg"
      stackActions
      returnFocusRef={returnFocusRef}
      title={t('tags.editDialog.title')}
      actions={
        <>
          <Button variant="destructive" className="kore-edit-tag__delete" onClick={onDelete}>
            {t('tags.editDialog.delete')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('tags.editDialog.cancel')}
          </Button>
          <Button disabled={isSaving} onClick={save}>
            {t('tags.editDialog.save')}
          </Button>
        </>
      }
    >
      <div className="kore-edit-tag">
        <FormField label={t('tags.editDialog.name')} hint={hint} hintTone="danger">
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              maxLength={TAG_NAME_MAX_LENGTH}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
            />
          )}
        </FormField>
        <div role="radiogroup" aria-labelledby={colorsLabel} className="kore-edit-tag__colors">
          <span id={colorsLabel} className="kore-edit-tag__colors-label">
            {t('tags.editDialog.color')}
          </span>
          <div className="kore-edit-tag__options">
            {COLORS.map((option) => (
              <label key={option ?? 'none'} className="kore-tag-color">
                <input
                  type="radio"
                  name="tag-color"
                  className="kore-tag-color__input"
                  checked={color === option}
                  onChange={() => setColor(option)}
                />
                <Tag color={option}>{t(`tags.colors.${option ?? 'none'}`)}</Tag>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
