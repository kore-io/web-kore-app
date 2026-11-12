import { expect, test } from '@playwright/test';
import { SITE_ORIGIN } from '../playwright.config';
import {
  connectBackoffice,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

let db: Db;

test.beforeAll(async () => {
  db = await connectBackoffice();
});

test.afterAll(async () => {
  await db.end();
});

async function newWedding() {
  const userId = await createUser({
    db,
    email: `e2e-site-${unique()}@exemplo.kore.local`,
    name: 'Ana Beatriz Moreira',
  });
  const weddingId = await createWedding({
    db,
    partners: ['Ana Beatriz Moreira', 'Marcos Vinícius Rocha'],
    eventDate: '2027-05-15',
    city: 'Campinas',
    status: 'draft',
    createdByUserId: userId,
    owners: [userId, null],
  });
  const {
    rows: [row],
  } = await db.query<{ slug: string }>('select slug from weddings where id = $1', [weddingId]);
  return { weddingId, slug: row?.slug ?? '' };
}

/** A publicação chega na F4; o E2E grava o status e o publishedAt direto (Site público RN13). */
async function publish({ weddingId }: { weddingId: string }) {
  await db.query(`update weddings set status = 'published', published_at = now() where id = $1`, [
    weddingId,
  ]);
}

test.describe('Site do casal › o bundle público na 5174 (B1; Site público RN01 a RN04, RN10)', () => {
  test('rascunho, endereço que não existe e o site publicado, com os cabeçalhos da API', async ({
    page,
  }) => {
    const { weddingId, slug } = await newWedding();

    // Rascunho: a página do Kore, sem nome do casal, e a API com 404 SITE_DRAFT.
    await page.goto(`${SITE_ORIGIN}/${slug}`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Este site ainda não foi publicado.' }),
    ).toBeVisible();
    await expect(page.getByText(/Ana|Marcos/)).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );

    // Um endereço que não existe.
    await page.goto(`${SITE_ORIGIN}/nao-existe-${unique()}`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Não encontramos este endereço.' }),
    ).toBeVisible();

    // Publicado: a Topbar, o Hero e o rodapé, nas cores do casal.
    await publish({ weddingId });
    const response = page.waitForResponse(`${API_URL}/v1/sites/${slug}`);
    await page.goto(`${SITE_ORIGIN}/${slug}`);
    const api = await response;
    expect(api.status()).toBe(200);
    const headers = api.headers();
    expect(headers['cache-control']).toBe('private, no-store');
    expect(headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(headers['access-control-allow-origin']).toBe(SITE_ORIGIN);
    expect(headers['access-control-allow-credentials']).toBe('true');

    await expect(page.getByRole('heading', { level: 1, name: 'Ana & Marcos' })).toBeVisible();
    await expect(page.getByText('sábado, 15 de maio de 2027 · Campinas (SP)')).toBeVisible();
    await expect(page.getByText(/^Faltam \d+ dias$/)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-site-fonts', 'romantico');
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: 'Feito com Kore' })).toHaveAttribute(
      'href',
      'https://kore.com.br/',
    );
    // O menu (celular) abre pelo botão: a Cerimônia está ligada, mas vazia; a contagem
    // não entra no menu. Sem seção no menu, o botão nem aparece.
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveCount(0);
  });

  test('o app não lê o site com a sessão do casal pela origem do site (RN07)', async ({ page }) => {
    // Uma rota do app chamada pela origem do site não recebe o CORS do site.
    const response = await page.request.get(`${API_URL}/v1/me`, {
      headers: { origin: SITE_ORIGIN },
    });
    expect(response.headers()['access-control-allow-origin']).toBeUndefined();
  });
});
