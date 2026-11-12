import { siteDataAttributes } from '@kore-io/design';
import type { PublicAppearanceResponse } from '../shared/api/generated/model';

/**
 * Aplica a Aparência do casal no documento (Aparência RN09): as fontes e o fundo pelos
 * atributos do DS (`data-site-fonts`, `data-site-background`), e as cores por variável,
 * porque o casal pode ter cor própria (fora das paletas). O texto sobre a cor principal
 * vem do servidor (`primaryForeground`).
 */
export function applySiteTheme({
  appearance,
  root = document.documentElement,
}: {
  appearance: PublicAppearanceResponse;
  root?: HTMLElement;
}) {
  root.setAttribute(siteDataAttributes.fonts, appearance.fontPairKey);
  root.setAttribute(siteDataAttributes.background, appearance.backgroundMode);
  root.style.setProperty('--site-primary', appearance.primaryColor);
  root.style.setProperty('--site-primary-foreground', appearance.primaryForeground);
  root.style.setProperty('--site-accent', appearance.accentColor);
}
