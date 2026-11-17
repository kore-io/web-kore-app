import { useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  SiteEditorAppearanceResponse,
  SiteEditorResponse,
} from '../../../shared/api/generated/model';
import {
  getSiteControllerGetV1QueryKey,
  useSiteControllerAppearanceV1,
} from '../../../shared/api/generated/site/site';
import { apiErrorCode } from '../../../shared/api/http-client';
import type { Audience } from '../../guests/hooks/use-active-wedding';
import { matchingPalette, type ContrastBlock } from '../appearance';
import { usePreviewAppearance } from '../preview-appearance';
import { useSectionForm } from '../section-form';
import { loadEditorFonts } from '../site-fonts';
import { AppearanceFields, draftFrom, useAppearanceDraft } from './appearance-fields';

/** Aparência (S2): fontes, paleta, cor principal e destaque com o contraste, e o fundo. */
export function AppearanceSection({
  weddingId,
  site,
  audience,
}: {
  weddingId: string;
  site: SiteEditorResponse;
  audience: Audience;
}) {
  const { t } = useTranslation('site');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const put = useSiteControllerAppearanceV1();
  const state = useAppearanceDraft({ initial: site.appearance });
  const { draft, setDraft, setServerBlock, starterPaletteKey, lastValid, canSave, body } = state;
  const [original, setOriginal] = useState(() => draftFrom(site.appearance));

  useEffect(() => {
    void loadEditorFonts();
  }, []);

  usePreviewAppearance({ ...lastValid, fontPairKey: draft.fontPairKey });

  const dirty =
    JSON.stringify({
      ...draft,
      paletteKey: starterPaletteKey,
      primaryColor: draft.primaryColor.toUpperCase(),
      accentColor: draft.accentColor.toUpperCase(),
    }) !==
    JSON.stringify({
      ...original,
      paletteKey: matchingPalette({
        key: original.paletteKey,
        primaryColor: original.primaryColor,
        accentColor: original.accentColor,
      }),
    });

  useSectionForm({
    dirty,
    canSave,
    save: async () => {
      try {
        const saved = await put.mutateAsync({ weddingId, data: body });
        const appearance: SiteEditorAppearanceResponse = {
          fontPairKey: saved.fontPairKey,
          starterPaletteKey: saved.starterPaletteKey,
          primaryColor: saved.primaryColor,
          accentColor: saved.accentColor,
          backgroundMode: saved.backgroundMode,
        };
        queryClient.setQueryData<SiteEditorResponse>(
          getSiteControllerGetV1QueryKey(weddingId),
          (current) =>
            current && { ...current, appearance, siteUpdatedAt: new Date().toISOString() },
        );
        void queryClient.invalidateQueries({ queryKey: getSiteControllerGetV1QueryKey(weddingId) });
        const next = draftFrom(appearance);
        setOriginal(next);
        setDraft(next);
        showToast({ tone: 'success', message: t('saved') });
        return true;
      } catch (error) {
        // O servidor confere pelas mesmas contas (RN05): o 422 cai no mesmo aviso.
        if (apiErrorCode({ error }) === 'CONTRAST_TOO_LOW') {
          const errorBody = (error as { body?: { check?: ContrastBlock } }).body;
          setServerBlock(errorBody?.check ?? 'primary_foreground');
          return false;
        }
        showToast({
          tone: 'danger',
          message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
        });
        return false;
      }
    },
  });

  return (
    <AppearanceFields
      state={state}
      sampleNames={site.partners.map((partner) => partner.name.split(' ')[0]).join(' & ')}
      audience={audience}
    />
  );
}
