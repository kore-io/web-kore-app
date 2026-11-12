import { expect, test } from '@playwright/test';
import {
  connectBackoffice,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';
import { signIn } from './support/app';

let db: Db;

test.beforeAll(async () => {
  db = await connectBackoffice();
});

test.afterAll(async () => {
  await db.end();
});

test.describe('Site › Editor (decisão 214)', () => {
  test('a base: o caminho, o cabeçalho, as seções com o estado inicial e a prévia-resumo', async ({
    page,
  }) => {
    const email = `e2e-site-${unique()}@exemplo.kore.local`;
    const userId = await createUser({ db, email, name: 'Ana Beatriz Moreira' });
    await createWedding({
      db,
      partners: ['Ana Beatriz Moreira', 'Marcos Vinícius Rocha'],
      eventDate: '2027-05-15',
      city: 'Campinas',
      status: 'draft',
      createdByUserId: userId,
      owners: [userId, null],
    });
    await signIn({ page, email });

    await page.goto('/app/site');
    await expect(page).toHaveURL(/\/app\/site\/dados-basicos$/);
    await expect(page.getByRole('heading', { name: 'Site', level: 1 })).toBeVisible();
    await expect(page.getByText(/^kore\.com\.br\/e2e-[a-z0-9]+ · Rascunho$/)).toBeVisible();

    // As seções nascem pelo cadastro: Contagem e Cerimônia ligadas, as outras desligadas.
    // No celular, a lista fica na aba Seções.
    await page
      .getByRole('navigation', { name: 'Editor do site' })
      .getByRole('button', { name: 'Seções' })
      .click();
    const list = page.getByRole('navigation', { name: 'Seções' });
    await expect(list.getByRole('link')).toHaveText([
      'Dados básicosligada',
      'Aparêncialigada',
      'Nossa históriadesligada',
      'Contagem regressivaligada',
      'Cerimônia & Recepçãovazia',
      'Hospedagem e transportedesligada',
      'Dress codedesligada',
      'FAQdesligada',
    ]);

    await page
      .getByRole('navigation', { name: 'Editor do site' })
      .getByRole('button', { name: 'Prévia' })
      .click();
    const preview = page.locator('figure', { hasText: 'Prévia do site' });
    await expect(preview.getByText('Ana & Marcos')).toBeVisible();
    await expect(preview.getByText('sábado, 15 de maio de 2027 · Campinas')).toBeVisible();
    await expect(preview.getByText(/^Faltam \d+ dias$/)).toBeVisible();
    await expect(preview.getByText('Visão de visitante')).toBeVisible();

    await page
      .getByRole('navigation', { name: 'Editor do site' })
      .getByRole('button', { name: 'Seções' })
      .click();
    await list.getByRole('link', { name: /FAQ/ }).click();
    await expect(page).toHaveURL(/\/app\/site\/faq$/);
    await expect(page.getByRole('heading', { name: 'FAQ', level: 2 })).toBeVisible();
  });
});
