import 'i18next';
import type { defaultNamespace, resources } from './resources';

// Chaves de texto tipadas: t('chave') que não existe não compila.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNamespace;
    resources: (typeof resources)['pt-BR'];
  }
}
