import { checkAppearance } from '../../site/appearance';
import type { SimulatorDraft } from '../../../shared/simulator/draft';
import { formatLongDate } from '../profile-texts';
import { SITE_BACKGROUND_NAMES } from '../../../site/theme';
import { SitePreviewCard } from './site-preview-card';

/**
 * A prévia do site que o casal montou no Simule, no Início com rascunho (Penpot,
 * "Cadastro — Início — com rascunho"; Cadastro RN12): os nomes, a data e a cidade, nas
 * cores e nas fontes escolhidas, sem a foto. Cor própria vai por variável.
 */
export function SimulatorDraftPreview({ draft }: { draft: SimulatorDraft }) {
  const [mine, partner] = draft.names.map((name) => name.trim());
  const date = !draft.noDate && draft.eventDate ? formatLongDate({ isoDate: draft.eventDate }) : '';
  const details = [date, draft.city.trim()].filter(Boolean).join(' · ');
  const { primaryForeground } = checkAppearance({
    primaryColor: draft.primaryColor,
    accentColor: draft.accentColor,
    backgroundMode: draft.backgroundMode,
  });
  return (
    <SitePreviewCard
      couple={mine && partner ? `${mine} & ${partner}` : mine || partner || ''}
      details={details}
      theme={{
        fonts: draft.fontPairKey,
        background: SITE_BACKGROUND_NAMES[draft.backgroundMode] ?? 'creme',
        ...(draft.starterPaletteKey && { colors: draft.starterPaletteKey }),
      }}
      {...(!draft.starterPaletteKey && {
        customColors: { primary: draft.primaryColor, primaryForeground, accent: draft.accentColor },
      })}
    />
  );
}
