import { FileUpload, IconButton, Progress } from '@kore-io/design';
import { X } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SiteEditorResponse, SiteSectionResponse } from '../../../shared/api/generated/model';
import type { Audience } from '../../guests/hooks/use-active-wedding';
import type { ImageValue } from '../components/image-field';
import { IMAGE_ACCEPT, useSiteImageUpload } from '../images/use-site-image-upload';
import { useSectionTemplateActions } from './template-actions';
import { SectionFrame, TextWithCounter } from './section-forms';
import { useSiteSection } from './use-site-section';
import { useWriteLock, WriteLockReason } from '../../billing/lifecycle/blocked';

export const STORY_PHOTOS_MAX = 12;
const STORY_TEXT_MAX = 5000;

type Photo = NonNullable<ImageValue>;

interface StoryContent {
  text: string;
  photos: Photo[];
}

/**
 * Nossa história (Seções RN05; Imagens RN04): título, texto até 5.000 e até 12 fotos na
 * ordem em que entraram. Várias fotos sobem uma de cada vez, com "Enviando 1 de 3" e uma
 * barra por foto; enquanto sobem, o Salvar fica travado. Com 12, a área de envio mostra o
 * limite. Cada miniatura tem o "Remover foto {n}".
 */
export function StorySection({
  weddingId,
  site,
  section,
  audience,
}: {
  weddingId: string;
  site: SiteEditorResponse;
  section: SiteSectionResponse;
  audience: Audience;
}) {
  const { t } = useTranslation('site');
  const actions = useSectionTemplateActions();
  const upload = useSiteImageUpload({ weddingId, audience });
  // As fotos que ainda sobem: a fração de cada uma, na ordem da escolha.
  const [sending, setSending] = useState<number[]>([]);
  const state = useSiteSection<StoryContent>({
    weddingId,
    section,
    fromResponse: (content) => ({
      text: typeof content.text === 'string' ? content.text : '',
      photos: (Array.isArray(content.images) ? (content.images as Photo[]) : []).map((image) => ({
        id: image.id,
        url: image.url,
        thumbUrl: image.thumbUrl,
      })),
    }),
    toBody: (content) => ({
      text: content.text,
      imageIds: content.photos.map((photo) => photo.id),
    }),
    validate: () => ({}),
    canSave: sending.length === 0,
    blocked: (content) => content.text.length > STORY_TEXT_MAX,
  });
  const labelId = useId();
  const lock = useWriteLock();
  const { text, photos } = state.draft.content;
  const room = STORY_PHOTOS_MAX - photos.length;
  const full = room <= 0;
  const title = state.draft.title.trim() || t('sections.names.story');

  async function send(files: File[]) {
    // Só entram as que cabem no limite, na ordem da escolha (RN05).
    const batch = files.slice(0, Math.max(room, 0));
    if (batch.length === 0) return;
    setSending(batch.map(() => 0));
    for (const [index, file] of batch.entries()) {
      const image = await upload({
        file,
        onProgress: (fraction) =>
          setSending((current) => current.map((value, at) => (at === index ? fraction : value))),
      });
      setSending((current) => current.map((value, at) => (at === index ? 1 : value)));
      if (image) {
        state.setContent((current) => ({
          ...current,
          photos: [...current.photos, { id: image.id, url: image.url, thumbUrl: image.thumbUrl }],
        }));
      }
    }
    setSending([]);
  }

  const current = sending.findIndex((fraction) => fraction < 1);

  return (
    <SectionFrame
      state={state}
      audience={audience}
      empty={!text.trim() && photos.length === 0}
      action={
        actions?.Text && (
          <actions.Text
            site={site}
            sectionType="story"
            onText={(value) => state.setContent((content) => ({ ...content, text: value }))}
          />
        )
      }
    >
      <TextWithCounter
        label={t('section.text')}
        value={text}
        max={STORY_TEXT_MAX}
        onChange={(value) => state.setContent((content) => ({ ...content, text: value }))}
      />
      <div
        className="kore-site-story"
        role="group"
        aria-labelledby={labelId}
        // O FileUpload da lib não leva aria-describedby: o grupo é descrito pelo motivo
        // (sugestão do Crivo).
        {...(lock.locked && { 'aria-describedby': 'kore-site-story-locked' })}
      >
        <span id={labelId} className="kore-site-cover__label">
          {t('section.story.photos', { count: photos.length, max: STORY_PHOTOS_MAX })}
        </span>
        {photos.length > 0 && (
          <ul className="kore-site-story__grid">
            {photos.map((photo, index) => (
              <li key={photo.id} className="kore-site-story__photo">
                <img
                  className="kore-site-story__thumb"
                  src={photo.thumbUrl}
                  alt={t('section.story.alt', { n: index + 1, total: photos.length, title })}
                />
                <IconButton
                  className="kore-site-story__remove"
                  icon={<X />}
                  label={t('section.story.remove', { n: index + 1 })}
                  onClick={() =>
                    state.setContent((content) => ({
                      ...content,
                      photos: content.photos.filter((item) => item.id !== photo.id),
                    }))
                  }
                />
              </li>
            ))}
          </ul>
        )}
        {sending.length > 0 && (
          <>
            <p className="kore-site-story__sending" aria-live="polite">
              {t('images.sending', {
                current: (current === -1 ? sending.length - 1 : current) + 1,
                total: sending.length,
              })}
            </p>
            <ul className="kore-site-story__grid">
              {sending.map((fraction, index) => (
                <li key={index} className="kore-site-story__photo kore-site-story__photo--pending">
                  <Progress
                    className="kore-site-story__bar"
                    hideHeader
                    label={t('images.sending', { current: index + 1, total: sending.length })}
                    value={Math.round(fraction * 100)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
        <FileUpload
          multiple
          title={full ? t(`section.story.limit.${audience}`) : t(`section.story.drop.${audience}`)}
          hint={t('section.story.dropHint')}
          accept={IMAGE_ACCEPT}
          disabled={lock.locked || full || sending.length > 0}
          onFiles={(files) => void send(files)}
        />
        {/* Bloqueado RN04: enviar fotos é escrita. */}
        <WriteLockReason id="kore-site-story-locked" className="kore-site-cover__help" />
        <p className="kore-site-cover__help">{t('section.story.help')}</p>
      </div>
    </SectionFrame>
  );
}
