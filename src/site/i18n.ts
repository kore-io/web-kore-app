import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import publicSite from '../shared/i18n/locales/pt-BR/public-site.json';

/**
 * O i18n do site do casal: só os textos do site (`publicSite`), para o bundle ficar
 * leve (Site público RN01). O site fala com o convidado no singular, na voz do Kore.
 */
void i18n.use(initReactI18next).init({
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  resources: { 'pt-BR': { publicSite } },
  defaultNS: 'publicSite',
  ns: ['publicSite'],
  interpolation: { escapeValue: false },
  returnNull: false,
});

export { i18n };
