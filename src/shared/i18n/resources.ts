import common from './locales/pt-BR/common.json';

/**
 * Textos do app por idioma e namespace (um namespace por feature, mais o comum). O texto
 * vem da Voz & Microcopy e do Penpot; nada de texto de tela fora daqui.
 */
export const resources = {
  'pt-BR': { common },
} as const;

export const defaultNamespace = 'common';
