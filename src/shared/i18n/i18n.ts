import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { defaultNamespace, resources } from './resources';

/**
 * "e-mail" sem quebra no hífen (decisão 161): o hífen comum seguido de um WORD JOINER
 * (U+2060), que proíbe a quebra sem mudar o desenho. O hífen não separável (U+2011) não
 * serve: a Cormorant não tem o glyph e o título cairia noutra fonte.
 */
export function withNonBreakingEmail({ text }: { text: string }) {
  return text.replace(/\b([eE])-mail/g, '$1-\u2060mail');
}

/**
 * Aplica a troca nos textos dos catálogos, uma vez, antes do init: só no texto fixo, nunca
 * nos valores interpolados (o e-mail digitado, o endereço do site, os nomes). Os arquivos
 * JSON seguem com o hífen comum, legíveis.
 */
function prepareCatalog<T>(node: T): T {
  if (typeof node === 'string') return withNonBreakingEmail({ text: node }) as T;
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, prepareCatalog(value)]),
    ) as T;
  }
  return node;
}

/** pt-BR é o idioma do app (multi-idioma fica fora do lançamento, decisão 119). */
void i18n.use(initReactI18next).init({
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  resources: prepareCatalog(resources),
  defaultNS: defaultNamespace,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export { i18n };
