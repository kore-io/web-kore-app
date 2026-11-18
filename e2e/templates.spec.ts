import { expect, test, type Page } from '@playwright/test';
import { codeFrom, latestEmail, newEmail } from './mailpit';
import { toast } from './support/app';
import {
  connectBackoffice,
  createPlanner,
  createUser,
  unique,
  type Db,
} from './support/backoffice';

/*
 * Modelos (D8a da F6; Modelos do cerimonialista RN01 a RN06; Penpot 11; decisões 291 e
 * 292): a cerimonialista cria, edita e exclui um modelo de texto, cria um FAQ e uma
 * aparência, e cada aba lista só os seus.
 */

let db: Db;
test.beforeAll(async () => {
  db = await connectBackoffice();
});
test.afterAll(async () => {
  await db.end();
});

const letters = () => unique().replace(/\d/g, (digit) => 'abcdefghij'[Number(digit)] ?? '');

async function signIn({ page, email }: { page: Page; email: string }) {
  await page.goto('/entrar');
  await page.getByRole('textbox', { name: 'E-⁠mail' }).fill(email);
  const since = new Date(Date.now() - 1000);
  await page.getByRole('button', { name: 'Receber código' }).click();
  await expect(page.getByRole('heading', { name: 'Confira seu e-⁠mail' })).toBeVisible();
  const code = codeFrom({ email: await latestEmail({ request: page.request, to: email, since }) });
  await page.keyboard.type(code);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
  await page.waitForLoadState('networkidle');
}

async function planner({ page }: { page: Page }) {
  const email = newEmail({ label: `modelos-${unique()}` });
  const userId = await createUser({ db, email, name: 'Juliana Prado' });
  await createPlanner({ db, userId, creditName: `Prado ${letters()}` });
  await signIn({ page, email });
}

const createButton = (page: Page) => page.getByRole('button', { name: 'Criar modelo' }).first();

test('Textos: criar, editar e excluir um modelo (RN03, RN04, RN06)', async ({ page }) => {
  await planner({ page });
  await page.goto('/cerimonialista/modelos');
  await expect(page.getByText('Você ainda não tem modelos de texto.')).toBeVisible();

  await createButton(page).click();
  const dialog = page.getByRole('dialog', { name: 'Novo modelo de texto' });
  await expect(dialog.getByText(/Use só textos seus/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Criar modelo' }).click();
  await expect(dialog.getByText('Dê um nome ao modelo.')).toBeVisible();
  await dialog
    .getByRole('textbox', { name: 'Nome do modelo' })
    .fill('Nossa história: tom acolhedor');
  await dialog.getByRole('textbox', { name: 'Texto' }).fill('{casal} se conheceram em {cidade}.');
  await dialog.getByRole('button', { name: 'Criar modelo' }).click();
  await expect(toast({ page, text: 'Modelo criado.' })).toBeVisible();

  // No celular (Pixel 7), o cartão com a seção e a prévia.
  const card = page.getByRole('listitem').filter({ hasText: 'Nossa história: tom acolhedor' });
  await expect(card).toContainText('Nossa história · Criado em');
  await expect(card).toContainText('{casal} se conheceram em {cidade}.');

  await card.getByRole('button', { name: 'Editar Nossa história: tom acolhedor' }).click();
  const edit = page.getByRole('dialog', { name: 'Editar modelo' });
  await edit.getByRole('textbox', { name: 'Nome do modelo' }).fill('Tom leve');
  await edit.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(toast({ page, text: 'Alterações salvas.' })).toBeVisible();
  const renamed = page.getByRole('listitem').filter({ hasText: 'Tom leve' });
  await expect(renamed).toBeVisible();

  await renamed.getByRole('button', { name: 'Excluir Tom leve' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Excluir o modelo "Tom leve"?' });
  await confirm.getByRole('button', { name: 'Excluir modelo' }).click();
  await expect(toast({ page, text: 'Modelo excluído.' })).toBeVisible();
  await expect(page.getByText('Você ainda não tem modelos de texto.')).toBeVisible();
});

test('FAQ e Aparência: criar um de cada, cada um na sua aba (RN01, RN04)', async ({ page }) => {
  await planner({ page });
  await page.goto('/cerimonialista/modelos');
  await page.getByRole('link', { name: 'FAQ' }).click();
  await expect(page.getByText('Você ainda não tem modelos de FAQ.')).toBeVisible();
  await createButton(page).click();
  const faq = page.getByRole('dialog', { name: 'Novo modelo de FAQ' });
  await faq.getByRole('textbox', { name: 'Nome do modelo' }).fill('FAQ: cerimônia ao ar livre');
  await faq.getByRole('textbox', { name: 'Pergunta 1' }).fill('E se chover?');
  await faq.getByRole('textbox', { name: 'Resposta 1' }).fill('Temos uma área coberta.');
  await faq.getByRole('button', { name: 'Criar modelo' }).click();
  await expect(toast({ page, text: 'Modelo criado.' })).toBeVisible();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'FAQ: cerimônia ao ar livre' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Aparência' }).click();
  await expect(page.getByText('Você ainda não tem modelos de aparência.')).toBeVisible();
  await createButton(page).click();
  const look = page.getByRole('dialog', { name: 'Novo modelo de aparência' });
  await expect(look.getByText(/Use só textos seus/)).toHaveCount(0);
  await look.getByRole('textbox', { name: 'Nome do modelo' }).fill('Romântico · Sálvia · Creme');
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  // O rádio é sr-only: clica no rótulo do cartão da paleta.
  await look
    .locator('label.kore-site-appearance__palette')
    .filter({ has: page.getByRole('radio', { name: /Sálvia/ }) })
    .click();
  await expect(look.getByRole('radio', { name: /Sálvia/ })).toBeChecked();
  await look.getByRole('button', { name: 'Criar modelo' }).click();
  await expect(toast({ page, text: 'Modelo criado.' })).toBeVisible();
  await expect(
    page
      .getByRole('img', { name: /^Fontes Romântico · Cor principal e destaque da paleta Sálvia/ })
      .last(),
  ).toBeVisible();

  // A aba Textos continua vazia: cada aba lista só o seu tipo.
  await page.getByRole('link', { name: 'Textos' }).click();
  await expect(page.getByText('Você ainda não tem modelos de texto.')).toBeVisible();
});
