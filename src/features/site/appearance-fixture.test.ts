// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A fixture do contraste é a mesma nos dois repositórios (Aparência RN01). A API publica
 * o sha256 dos bytes dela no OpenAPI; a cópia do web tem de bater, byte a byte.
 */
describe('appearance-contrast.fixture.json (Aparência RN01)', () => {
  it('o sha256 da cópia do web é o que a API publica no OpenAPI', () => {
    const copy = readFileSync(resolve('src/features/site/appearance-contrast.fixture.json'));
    const spec = JSON.parse(readFileSync(resolve('api/openapi.json'), 'utf8')) as {
      components: { schemas: { AppearanceContrastFixtureSha256?: { enum?: string[] } } };
    };
    const published = spec.components.schemas.AppearanceContrastFixtureSha256?.enum?.[0];
    expect(published).toMatch(/^[0-9a-f]{64}$/);
    expect(createHash('sha256').update(copy).digest('hex')).toBe(published);
  });
});
