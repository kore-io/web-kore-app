import access from './locales/pt-BR/access.json';
import common from './locales/pt-BR/common.json';
import dashboard from './locales/pt-BR/dashboard.json';
import deliveries from './locales/pt-BR/deliveries.json';
import guests from './locales/pt-BR/guests.json';
import layout from './locales/pt-BR/layout.json';
import notifications from './locales/pt-BR/notifications.json';
import planner from './locales/pt-BR/planner.json';
import publicSite from './locales/pt-BR/public-site.json';
import site from './locales/pt-BR/site.json';
import songs from './locales/pt-BR/songs.json';

/**
 * Textos do app por idioma e namespace (um namespace por feature, mais o comum). O texto
 * vem da Voz & Microcopy e do Penpot; nada de texto de tela fora daqui.
 */
export const resources = {
  'pt-BR': {
    access,
    common,
    dashboard,
    deliveries,
    guests,
    layout,
    notifications,
    planner,
    publicSite,
    site,
    songs,
  },
} as const;

export const defaultNamespace = 'common';
