import { Input, Switch, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  SiteEditorResponse,
  SiteSongQuestionResponse,
} from '../../../shared/api/generated/model';
import {
  getSiteControllerGetV1QueryKey,
  siteControllerSongQuestionV1,
} from '../../../shared/api/generated/site/site';
import { FormField } from '../../../shared/components/form-field';
import { useSectionForm } from '../section-form';

/** O texto da pergunta vai até 120 caracteres (Música RN01). */
export const SONG_QUESTION_MAX = 120;

/**
 * Pergunta de música (Música RN01 e RN02): o Switch "Fazer a pergunta no RSVP" e o Texto
 * da pergunta, salvos pelo Salvar do cabeçalho do Editor com o PUT da seção. Desligada, o
 * campo fica desabilitado e o aviso diz que as sugestões continuam guardadas; desligar não
 * apaga nada nem pede confirmação. O texto vazio volta ao padrão (o servidor devolve o
 * padrão).
 */
export function SongQuestionSection({
  weddingId,
  songQuestion,
}: {
  weddingId: string;
  songQuestion: SiteSongQuestionResponse;
}) {
  const { t } = useTranslation('site');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [original, setOriginal] = useState(songQuestion);
  const [enabled, setEnabled] = useState(songQuestion.enabled);
  const [text, setText] = useState(songQuestion.text);
  const dirty = enabled !== original.enabled || text.trim() !== original.text;

  useSectionForm({
    dirty,
    canSave: true,
    save: async () => {
      try {
        const saved = await siteControllerSongQuestionV1(weddingId, {
          enabled,
          text: text.trim() || null,
        });
        queryClient.setQueryData<SiteEditorResponse>(
          getSiteControllerGetV1QueryKey(weddingId),
          (current) => current && { ...current, songQuestion: saved },
        );
        // A Sidebar mostra ou esconde Músicas pelo mesmo GET do site (RN03).
        void queryClient.invalidateQueries({ queryKey: getSiteControllerGetV1QueryKey(weddingId) });
        setOriginal(saved);
        setEnabled(saved.enabled);
        setText(saved.text);
        showToast({ tone: 'success', message: t('saved') });
        return true;
      } catch {
        showToast({
          tone: 'danger',
          message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
        });
        return false;
      }
    },
  });

  return (
    <div className="kore-site-section">
      <Switch
        checked={enabled}
        {...(!enabled && { 'aria-describedby': 'kore-site-song-off' })}
        onChange={(event) => setEnabled(event.target.checked)}
      >
        {t('section.songQuestion.switch')}
      </Switch>
      {!enabled && (
        <p id="kore-site-song-off" className="kore-site-section__help">
          {t('section.songQuestion.off')}
        </p>
      )}
      <FormField label={t('section.songQuestion.text')} hint={t('section.songQuestion.help')}>
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            disabled={!enabled}
            maxLength={SONG_QUESTION_MAX}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        )}
      </FormField>
    </div>
  );
}
