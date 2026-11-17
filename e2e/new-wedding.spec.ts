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
 * Novo casamento, passos 1 e 2 (D6a da F6; Novo casamento RN01 a RN04; Penpot 05): a
 * cerimonialista preenche os dados, vê o endereço sugerido e livre, escolhe a aparência e
 * cria o casamento, que abre no detalhe de Meus casamentos (até o D6b, com os passos 3 e 4).
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

test('a cerimonialista cria um casamento pelos passos 1 e 2 e abre o detalhe (RN02 a RN04)', async ({
  page,
}) => {
  const email = newEmail({ label: `novo-${unique()}` });
  const userId = await createUser({ db, email, name: 'Juliana Prado' });
  await createPlanner({ db, userId, creditName: `Prado ${letters()}` });
  await signIn({ page, email });

  await page.goto('/cerimonialista/casamentos/novo');
  await expect(page.getByRole('heading', { name: 'Novo casamento', level: 1 })).toBeVisible({
    timeout: 15_000,
  });
  // Os nomes com letras únicas, para o endereço sugerido não colidir com rodadas anteriores.
  const first = `Isabela${letters()}`;
  await page.getByRole('textbox', { name: 'Nomes do casal, 1' }).fill(first);
  await page.getByRole('textbox', { name: 'Nomes do casal, 2' }).fill('André');
  await page.getByRole('textbox', { name: 'Cidade' }).fill('Americana');
  await page.getByRole('combobox', { name: 'UF' }).selectOption('SP');
  await page
    .getByRole('checkbox', { name: 'O casal ainda não sabe a data' })
    .check({ force: true });
  await expect(page.getByRole('textbox', { name: 'Endereço do site' })).toHaveValue(
    `${first.toLowerCase()}-e-andre`,
  );
  await expect(
    page.getByText('Endereço disponível. O casal pode mudar até publicar.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(
    page.getByText('Passo 2 de 4 · Escolha um ponto de partida. O casal pode mudar tudo depois.'),
  ).toBeVisible();
  // As fontes do Editor (loadEditorFonts) mudam o layout ao chegar: espera por elas e clica
  // no rótulo do cartão, já que o rádio é sr-only.
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const salvia = page.getByRole('radio', { name: /Sálvia/ });
  await page.locator('label.kore-site-appearance__palette').filter({ has: salvia }).click();
  await expect(salvia).toBeChecked();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(toast({ page, text: 'Casamento criado.' })).toBeVisible();
  await expect(page).toHaveURL(/\/cerimonialista\?casamento=/);
  await expect(page.getByRole('dialog', { name: `${first} e André` })).toBeVisible();
});
