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
 * A Área do cerimonialista (D3 da F6; Cadastro e perfil RN07 a RN11): a moldura pelos três
 * caminhos que levam a /cerimonialista (o fim do cadastro, o cartão da Seleção de perfil e o
 * PLANNER_PROFILE_EXISTS), o Meu perfil, o gate e o Sair de todos os aparelhos.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

let db: Db;
test.beforeAll(async () => {
  db = await connectBackoffice();
});
test.afterAll(async () => {
  await db.end();
});

/** Um sufixo só de letras: com dígitos, o nome da assessoria pode parecer telefone (RN04). */
const letters = () => unique().replace(/\d/g, (digit) => 'abcdefghij'[Number(digit)] ?? '');

/** Entra pelo código do e-mail na tela Entrar. */
async function signIn({ page, email }: { page: Page; email: string }) {
  await page.goto('/entrar');
  await page.getByRole('textbox', { name: 'E-⁠mail' }).fill(email);
  const since = new Date(Date.now() - 1000);
  await page.getByRole('button', { name: 'Receber código' }).click();
  await expect(page.getByRole('heading', { name: 'Confira seu e-⁠mail' })).toBeVisible();
  const code = codeFrom({ email: await latestEmail({ request: page.request, to: email, since }) });
  await page.keyboard.type(code);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/** A moldura da Área: a Topbar com a assessoria. */
async function expectPlannerArea({ page, creditName }: { page: Page; creditName: string }) {
  await expect(page).toHaveURL(/\/cerimonialista$/);
  await expect(page.getByRole('banner').getByText(creditName, { exact: true })).toBeVisible();
}

/** No celular, o menu do usuário é uma folha (diálogo) com botões. */
async function openUserMenuItem({ page, name }: { page: Page; name: string | RegExp }) {
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Menu do usuário' }).click();
  await page.getByRole('dialog').getByRole('button', { name }).click();
}

async function addCity({ page, city }: { page: Page; city: string }) {
  await page.getByRole('textbox', { name: 'Cidade', exact: true }).fill(city);
  await page.getByRole('combobox', { name: 'UF' }).selectOption('SP');
  await page.getByRole('button', { name: 'Adicionar' }).click();
}

test.describe('Área do cerimonialista (/cerimonialista)', () => {
  test('o fim do cadastro: Ir para Meus casamentos abre a moldura (RN07)', async ({ page }) => {
    const email = newEmail({ label: `cadastro-${unique()}` });
    const creditName = `Prado Assessoria ${letters()}`;
    await page.goto('/cerimonialista/cadastro');
    await page.getByRole('textbox', { name: 'E-⁠mail' }).fill(email);
    const since = new Date(Date.now() - 1000);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Confira seu e-⁠mail' })).toBeVisible();
    const code = codeFrom({
      email: await latestEmail({ request: page.request, to: email, since }),
    });
    await page.keyboard.type(code);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await page.getByRole('textbox', { name: 'Nome da assessoria' }).fill(creditName);
    await page.getByRole('textbox', { name: 'Seu nome' }).fill('Juliana Prado');
    await addCity({ page, city: 'Campinas' });
    await page.getByRole('checkbox', { name: /Li e aceito/ }).check({ force: true });
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByRole('button', { name: 'Ir para Meus casamentos' }).click();
    await expectPlannerArea({ page, creditName });
  });

  test('o cartão Cerimonialista da Seleção de perfil abre a moldura pelo home da API (RN07)', async ({
    page,
  }) => {
    const email = newEmail({ label: `dois-perfis-${unique()}` });
    const userId = await createUser({ db, email, name: 'Juliana Prado' });
    const creditName = `Prado Assessoria ${letters()}`;
    await createPlanner({ db, userId, creditName });
    await createWedding({
      db,
      partners: ['Juliana Prado', 'Tiago Mendes'],
      eventDate: '2027-03-20',
      city: 'Valinhos',
      status: 'draft',
      createdByUserId: userId,
      owners: [userId, null],
    });
    await signIn({ page, email });
    await expect(page).toHaveURL(/\/perfis$/);
    await page.getByRole('button', { name: new RegExp(`^Cerimonialista ${creditName}`) }).click();
    await expectPlannerArea({ page, creditName });

    // Com os dois perfis, o menu tem o Trocar de perfil com o casal (RN08).
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Menu do usuário' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText(`Cerimonialista · ${creditName}`)).toBeVisible();
    await expect(sheet.getByRole('button', { name: /^Trocar de perfil/ })).toContainText(
      'Casal · Juliana & Tiago',
    );
    await expect(sheet.getByRole('button', { name: /^Criar outro perfil/ })).toHaveCount(0);
  });

  test('o PLANNER_PROFILE_EXISTS (a outra aba) leva à moldura (RN03)', async ({ page }) => {
    const email = newEmail({ label: `outra-aba-${unique()}` });
    const userId = await createUser({ db, email, name: 'Juliana Prado' });
    await signIn({ page, email });
    await expect(page).toHaveURL(/\/perfis$/);
    await page.goto('/cerimonialista/cadastro');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Nome da assessoria' })
      .fill(`Prado Assessoria ${letters()}`);
    await addCity({ page, city: 'Campinas' });
    await page.getByRole('checkbox', { name: /Li e aceito/ }).check({ force: true });
    // O perfil nasce "na outra aba" antes do Continuar desta.
    const creditName = `Outra Aba ${letters()}`;
    await createPlanner({ db, userId, creditName });
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expectPlannerArea({ page, creditName });
  });

  test('Meu perfil: o perfil mínimo pede os Termos; salvar muda a assinatura na Topbar (RN09, RN10)', async ({
    page,
  }) => {
    const email = newEmail({ label: `perfil-${unique()}` });
    const userId = await createUser({ db, email, name: 'Clara Dias' });
    // O perfil mínimo do convite: só o nome, sem cidades e sem os Termos (RN10).
    await createPlanner({ db, userId, creditName: `Clara Dias ${letters()}` });
    await signIn({ page, email });
    await expect(page).toHaveURL(/\/cerimonialista$/);

    await openUserMenuItem({ page, name: 'Meu perfil' });
    await expect(page).toHaveURL(/\/cerimonialista\/perfil$/);
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    const creditName = `Dias Eventos ${letters()}`;
    await page.getByRole('textbox', { name: 'Nome da assessoria' }).fill(creditName);
    await addCity({ page, city: 'Vinhedo' });
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText('Aceite os termos para salvar.')).toBeVisible();

    await page.getByRole('checkbox', { name: /Li e aceito/ }).check({ force: true });
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(toast({ page, text: 'Alterações salvas.' })).toBeVisible();
    await expect(page.getByRole('banner').getByText(creditName, { exact: true })).toBeVisible();
    // Salvo: os Termos aceitos, e a caixa some.
    await expect(page.getByRole('checkbox', { name: /Li e aceito/ })).toHaveCount(0);
    const planner = (await (await page.request.get(`${API_URL}/v1/me/planner`)).json()) as {
      creditName: string;
      cities: string[];
      profileComplete: boolean;
    };
    expect(planner).toMatchObject({ creditName, cities: ['Vinhedo (SP)'], profileComplete: true });
  });

  test('o gate: sem o perfil de cerimonialista, /cerimonialista leva ao casamento em /app (Colaboradora RN01)', async ({
    page,
  }) => {
    const email = newEmail({ label: `casal-${unique()}` });
    const ownerId = await createUser({ db, email, name: 'Bianca Lopes' });
    await createWedding({
      db,
      partners: ['Bianca Lopes', 'Henrique Matos'],
      eventDate: '2027-04-17',
      city: 'Vinhedo',
      status: 'draft',
      createdByUserId: ownerId,
      owners: [ownerId, null],
    });
    await signIn({ page, email });
    await expect(page).toHaveURL(/\/app$/);
    await page.goto('/cerimonialista/perfil');
    await expect(page).toHaveURL(/\/app$/);
  });

  test('Configurações › Acesso: Sair de todos os aparelhos encerra a sessão (Login RN09)', async ({
    page,
  }) => {
    const email = newEmail({ label: `sair-${unique()}` });
    const userId = await createUser({ db, email, name: 'Juliana Prado' });
    await createPlanner({ db, userId, creditName: `Prado Assessoria ${letters()}` });
    await signIn({ page, email });
    await expect(page).toHaveURL(/\/cerimonialista$/);
    await openUserMenuItem({ page, name: 'Configurações' });
    await expect(page).toHaveURL(/\/cerimonialista\/configuracoes\/acesso$/);
    await page.getByRole('button', { name: 'Sair de todos os aparelhos' }).click();
    await page
      .getByRole('alertdialog', { name: 'Sair de todos os aparelhos?' })
      .getByRole('button', { name: 'Sair de todos' })
      .click();
    await expect(page).toHaveURL(/\/entrar$/);
    expect((await page.request.get(`${API_URL}/v1/me`)).status()).toBe(401);
  });
});
