import access from './locales/pt-BR/access.json';
import common from './locales/pt-BR/common.json';
import layout from './locales/pt-BR/layout.json';

/**
 * Textos do app por idioma e namespace (um namespace por feature, mais o comum). O texto
 * vem da Voz & Microcopy e do Penpot; nada de texto de tela fora daqui.
 */
export const resources = {
  'pt-BR': { access, common, layout },
} as const;

export const defaultNamespace = 'common';
