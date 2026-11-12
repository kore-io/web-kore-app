// Decisões 131 e 133: no CSS das features só vale @apply das utilitárias do preset; as
// regras vêm do @kore-io/design. A entrada (src/styles/index.css) pode usar @import.
export default {
  plugins: ['@kore-io/design/stylelint'],
  rules: {
    'kore/apply-ds-only': true,
    'kore/declaration-ds-only': true,
    'kore/at-rule-ds-only': true,
  },
  overrides: [
    {
      files: ['src/styles/index.css', 'src/site/site.css'],
      rules: { 'kore/at-rule-ds-only': null },
    },
  ],
};
