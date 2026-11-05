import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { defaultNamespace, resources } from './resources';

/** pt-BR é o idioma do app (multi-idioma fica fora do lançamento, decisão 119). */
void i18n.use(initReactI18next).init({
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  resources,
  defaultNS: defaultNamespace,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export { i18n };
