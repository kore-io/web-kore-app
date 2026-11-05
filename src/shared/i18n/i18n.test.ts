import { describe, expect, it } from 'vitest';
import { i18n } from './i18n';

describe('i18n', () => {
  it('usa pt-BR com os textos do namespace comum', () => {
    expect(i18n.language).toBe('pt-BR');
    expect(i18n.t('appName')).toBe('Kore');
  });
});
