import { expect, test, type Page } from '@playwright/test';
import { codeFrom, latestEmail, newEmail } from './mailpit';
import { toast } from './support/app';
import {
  connectBackoffice,
  createPlanner,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

/*
 * Link de indicação (D7 da F6; Link de indicação RN01 a RN06; Penpot 09; decisão 288): o
 * link com o Copiar, os casais que vieram pelo link (não os que ela criou), a linha que abre
 * o detalhe só com colaboração e o vazio.
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

async function planner() {
  const email = newEmail({ label: `indicacao-${unique()}` });
  const userId = await createUser({ db, email, name: 'Juliana Prado' });
  const referrerId = await createPlanner({ db, userId, creditName: `Prado ${letters()}` });
  return { email, userId, referrerId };
}

test('os casais que vieram pelo link, só a colaboração abre o detalhe, e o Copiar link (RN02, RN03, RN05)', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { email, userId, referrerId } = await planner();
  const tag = letters();
  const ownerId = await createUser({
    db,
    email: newEmail({ label: `casal-${unique()}` }),
    name: 'Ana',
  });
  await createWedding({
    db,
    partners: [`Tatiane${tag}`, 'Leandro'],
    eventDate: '2027-03-20',
    city: 'Campinas',
    status: 'draft',
    createdByUserId: ownerId,
    owners: [ownerId, null],
    referrerId,
    referralSource: 'referral_link',
  });
  await createWedding({
    db,
    partners: [`Ana${tag}`, 'Marcos'],
    eventDate: '2027-04-10',
    city: 'Valinhos',
    status: 'awaiting_couple',
    createdByUserId: ownerId,
    owners: [ownerId, null],
    collaboratorIds: [userId],
    referrerId,
    referralSource: 'referral_link',
  });
  // Criado por ela: fica em Meus casamentos, não na lista do link (RN03).
  await createWedding({
    db,
    partners: [`Fernanda${tag}`, 'João'],
    eventDate: '2027-05-01',
    city: 'Vinhedo',
    status: 'draft',
    createdByUserId: userId,
    collaboratorIds: [userId],
    referrerId,
  });
  await signIn({ page, email });

  await page.goto('/cerimonialista/link-de-indicacao');
  await expect(page.getByRole('heading', { name: 'Link de indicação', level: 1 })).toBeVisible();
  await expect(
    page.getByText('Quem se cadastrar por este link ganha', { exact: false }),
  ).toBeVisible();
  const list = page.getByRole('region', { name: 'Casais com a sua indicação' });
  // No celular (Pixel 7), os cartões; a ordem é a do servidor, do cadastro mais recente.
  const cards = list.getByRole('listitem');
  await expect(cards).toHaveText([
    new RegExp(`^Ana${tag} e Marcos`),
    new RegExp(`^Tatiane${tag} e Leandro`),
  ]);
  await expect(list.getByText(`Fernanda${tag}`)).toHaveCount(0);
  await expect(cards.nth(1).getByRole('link')).toHaveCount(0);

  await page.getByRole('button', { name: 'Copiar link' }).click();
  await expect(toast({ page, text: 'Link copiado.' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/i\/[a-z0-9-]+$/);

  await cards.nth(0).getByRole('link').click();
  await expect(page).toHaveURL(/\/cerimonialista\?casamento=/);
  await expect(page.getByRole('dialog', { name: `Ana${tag} e Marcos` })).toBeVisible();
});

test('o vazio com o Compartilhar no WhatsApp (RN06)', async ({ page }) => {
  const { email } = await planner();
  await signIn({ page, email });
  await page.goto('/cerimonialista/link-de-indicacao');
  const list = page.getByRole('region', { name: 'Casais com a sua indicação' });
  await expect(list.getByText('Nenhum casal se cadastrou pelo seu link ainda.')).toBeVisible();
  await expect(list.getByRole('button', { name: 'Compartilhar no WhatsApp' })).toBeVisible();
});
