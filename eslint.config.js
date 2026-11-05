import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import kore from '@kore-io/design/eslint';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', '.maestri', 'src/shared/api/generated'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.tsx'],
    ...reactHooks.configs.flat.recommended,
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // Decisões 131 e 148: no JSX, só classes semânticas BEM com o prefixo kore-.
    files: ['src/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    plugins: { kore },
    rules: { 'kore/semantic-class-names': 'error' },
  },
);
