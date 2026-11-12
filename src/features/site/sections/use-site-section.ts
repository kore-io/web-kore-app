import { useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  SiteEditorResponse,
  SiteSectionResponse,
  UpdateSiteSectionBody,
} from '../../../shared/api/generated/model';
import {
  getSiteControllerGetV1QueryKey,
  useSiteControllerSectionV1,
} from '../../../shared/api/generated/site/site';
import { ApiError } from '../../../shared/api/http-client';
import { useSectionForm } from '../section-form';

export type SectionType = SiteSectionResponse['type'];

/** Erros por caminho do campo (o mesmo do 400: "title", "content.items.2.answer"). */
export type SectionErrors = Record<string, 'TITLE_MISSING' | 'REQUIRED'>;

export interface SectionDraft<C> {
  enabled: boolean;
  title: string;
  content: C;
}

/**
 * O rascunho de uma seção do site (Seções RN11 a RN13): o Switch, o título e o conteúdo
 * do tipo. O Salvar do cabeçalho valida no app (título vazio, campos obrigatórios), manda
 * a seção inteira pelo PUT e atualiza o cache; o 400 volta ao campo pelo caminho.
 */
export function useSiteSection<C>({
  weddingId,
  section,
  fromResponse,
  toBody,
  validate,
  canSave = true,
}: {
  weddingId: string;
  section: SiteSectionResponse;
  fromResponse: (content: Record<string, unknown>) => C;
  toBody: (content: C) => Record<string, unknown>;
  validate: (content: C) => SectionErrors;
  /** Falso trava o Salvar (ex.: fotos ainda subindo). */
  canSave?: boolean;
}) {
  const { t } = useTranslation('site');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const put = useSiteControllerSectionV1();
  const initial = (): SectionDraft<C> => ({
    enabled: section.enabled,
    title: section.title ?? '',
    content: fromResponse(section.content),
  });
  const [original, setOriginal] = useState(initial);
  const [draft, setDraft] = useState(original);
  const [errors, setErrors] = useState<SectionErrors>({});
  const hasTitle = section.type !== 'countdown';

  const dirty =
    JSON.stringify({ ...draft, title: draft.title.trim(), content: toBody(draft.content) }) !==
    JSON.stringify({
      ...original,
      title: original.title.trim(),
      content: toBody(original.content),
    });

  useSectionForm({
    dirty,
    canSave,
    save: async () => {
      const local: SectionErrors = { ...validate(draft.content) };
      if (hasTitle && !draft.title.trim()) local.title = 'TITLE_MISSING';
      setErrors(local);
      if (Object.keys(local).length > 0) return false;
      const body: UpdateSiteSectionBody = {
        enabled: draft.enabled,
        title: hasTitle ? draft.title.trim() : null,
        content: toBody(draft.content),
      };
      try {
        const saved = await put.mutateAsync({ weddingId, type: section.type, data: body });
        queryClient.setQueryData<SiteEditorResponse>(
          getSiteControllerGetV1QueryKey(weddingId),
          (current) =>
            current && {
              ...current,
              sections: current.sections.map((item) => (item.type === saved.type ? saved : item)),
            },
        );
        void queryClient.invalidateQueries({ queryKey: getSiteControllerGetV1QueryKey(weddingId) });
        const next: SectionDraft<C> = {
          enabled: saved.enabled,
          title: saved.title ?? '',
          content: fromResponse(saved.content),
        };
        setOriginal(next);
        setDraft(next);
        showToast({ tone: 'success', message: t('saved') });
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          const body = error.body as { errors?: { path: string; code: string }[] };
          const fields: SectionErrors = {};
          for (const item of body.errors ?? []) {
            if (item.code !== 'IS_NOT_EMPTY' && item.code !== 'IS_EMPTY') continue;
            fields[item.path] = item.path === 'title' ? 'TITLE_MISSING' : 'REQUIRED';
          }
          if (Object.keys(fields).length > 0) {
            setErrors(fields);
            return false;
          }
        }
        showToast({
          tone: 'danger',
          message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
        });
        return false;
      }
    },
  });

  return {
    draft,
    errors,
    setEnabled: (enabled: boolean) => setDraft((current) => ({ ...current, enabled })),
    setTitle: (title: string) => setDraft((current) => ({ ...current, title })),
    setContent: (update: (content: C) => C) =>
      setDraft((current) => ({ ...current, content: update(current.content) })),
    clearError: (path: string) =>
      setErrors((current) => {
        if (!(path in current)) return current;
        return Object.fromEntries(Object.entries(current).filter(([key]) => key !== path));
      }),
  };
}
