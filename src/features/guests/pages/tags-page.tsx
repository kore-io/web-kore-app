import { Button, Dialog, Input, Spinner, Tag } from '@kore-io/design';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TagResponse } from '../../../shared/api/generated/model';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { EditTagDialog, TAG_NAME_MAX_LENGTH } from '../components/edit-tag-dialog';
import { useActiveWedding, type Audience } from '../hooks/use-active-wedding';
import { useTags, type TagNameError } from '../hooks/use-tags';

/** Aba Tags (Tags dos convidados, RN01 a RN06), dentro do GuestsLayout. */
export function TagsPage() {
  const { weddingId, audience } = useActiveWedding();
  if (!weddingId) return null;
  return <TagsView weddingId={weddingId} audience={audience} />;
}

function TagsView({ weddingId, audience }: { weddingId: string; audience: Audience }) {
  const { t } = useTranslation('guests');
  const tags = useTags({ weddingId });
  const hintId = useId();
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<TagNameError>(null);
  const [editing, setEditing] = useState<TagResponse | null>(null);
  const [deleting, setDeleting] = useState<TagResponse | null>(null);
  const editButton = useRef<HTMLElement | null>(null);
  const nameField = useRef<HTMLInputElement>(null);
  // Para onde o foco volta ao fechar o Excluir: o Editar da linha, ou o campo do nome
  // quando a tag saiu da lista (a linha some junto com o Editar).
  const afterDelete = useRef<HTMLElement | null>(null);

  if (tags.isLoading) {
    return (
      <div className="kore-guests__loading">
        <Spinner label={t('tags.loading')} />
      </div>
    );
  }
  if (tags.isError) return <LoadErrorNotice onRetry={tags.retry} />;

  function create() {
    const name = newName.trim();
    if (!name) return;
    tags.create({
      name,
      onDone: (error) => {
        setCreateError(error);
        if (!error) setNewName('');
      },
    });
  }

  // Com 10, o Criar tag fica desabilitado com o aviso (RN01); nome repetido marca o campo.
  const limitReached = tags.atLimit || createError === 'limit';
  const hint = limitReached
    ? t(`tags.limit.${audience}`)
    : createError === 'taken'
      ? t('tags.nameTaken')
      : undefined;

  return (
    <section className="kore-tags">
      <h2 className="kore-tags__counter">
        {t('tags.counter', { count: tags.tags.length, limit: tags.limit })}
      </h2>
      <form
        className="kore-tags__create"
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
      >
        <Input
          ref={nameField}
          className="kore-tags__name"
          aria-label={t('tags.newName')}
          placeholder={t('tags.newName')}
          maxLength={TAG_NAME_MAX_LENGTH}
          disabled={limitReached}
          invalid={createError === 'taken'}
          aria-describedby={hint ? hintId : undefined}
          value={newName}
          onChange={(event) => {
            setNewName(event.target.value);
            setCreateError(null);
          }}
        />
        <Button type="submit" disabled={limitReached || !newName.trim() || tags.isSaving}>
          {t('tags.create')}
        </Button>
      </form>
      {hint && (
        <p
          id={hintId}
          className={limitReached ? 'kore-tags__hint' : 'kore-tags__hint kore-tags__hint--danger'}
        >
          {hint}
        </p>
      )}
      <ul className="kore-tags__list">
        {tags.tags.map((tag) => (
          <li key={tag.id} className="kore-tags__item">
            <span className="kore-tags__tag">
              <Tag id={`tag-${tag.id}`} color={tag.color}>
                {tag.name}
              </Tag>
            </span>
            <span className="kore-tags__guests">{t('tags.guests', { count: tag.guests })}</span>
            <Button
              variant="ghost"
              size="sm"
              aria-describedby={`tag-${tag.id}`}
              onClick={(event) => {
                editButton.current = event.currentTarget;
                setEditing(tag);
              }}
            >
              {t('tags.edit')}
            </Button>
          </li>
        ))}
      </ul>
      <p className="kore-tags__caption">{t(`tags.caption.${audience}`)}</p>

      <EditTagDialog
        tag={editing}
        audience={audience}
        isSaving={tags.isSaving}
        returnFocusRef={editButton}
        onClose={() => setEditing(null)}
        onSave={({ name, color, onDone }) =>
          editing && tags.update({ tagId: editing.id, name, color, onDone })
        }
        onDelete={() => {
          afterDelete.current = editButton.current;
          setDeleting(editing);
          setEditing(null);
        }}
      />
      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        returnFocusRef={afterDelete}
        title={t('tags.deleteDialog.title', { name: deleting?.name ?? '' })}
        description={t('tags.deleteDialog.description')}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {t('tags.deleteDialog.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={tags.isSaving}
              onClick={() =>
                deleting &&
                tags.trash({
                  tagId: deleting.id,
                  name: deleting.name,
                  onDone: ({ deleted }) => {
                    if (deleted) afterDelete.current = nameField.current;
                    setDeleting(null);
                  },
                })
              }
            >
              {t('tags.deleteDialog.confirm')}
            </Button>
          </>
        }
      />
    </section>
  );
}
