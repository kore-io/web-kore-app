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
 * Colaboradores (D5b da F6; Papéis RN02, RN03 e RN06a; Colaboradora RN05; decisões 270, 271
 * e 274): o casal remove a cerimonialista (e a trava de 48 h depois da troca do e-mail de
 * acesso); a cerimonialista vê a lista em leitura e sai do casamento.
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
  // A Seleção grava o perfil ativo logo depois do login: espera antes de abrir outra tela.
  await page.waitForLoadState('networkidle');
}

/** Um casamento de Ana (rascunho, com dona), com a cerimonialista Juliana colaborando. */
async function weddingWithPlanner() {
  const coupleEmail = newEmail({ label: `casal-${unique()}` });
  const plannerEmail = newEmail({ label: `cerimonial-${unique()}` });
  const ownerId = await createUser({ db, email: coupleEmail, name: 'Ana Beatriz Moreira' });
  const plannerName = `Juliana ${letters()}`;
  const plannerId = await createUser({ db, email: plannerEmail, name: plannerName });
  const referrerId = await createPlanner({
    db,
    userId: plannerId,
    creditName: `Prado ${letters()}`,
  });
  const weddingId = await createWedding({
    db,
    partners: ['Ana Beatriz', 'Marcos Lima'],
    eventDate: '2027-01-30',
    city: 'Campinas',
    status: 'draft',
    createdByUserId: ownerId,
    owners: [ownerId, null],
    collaboratorIds: [plannerId],
    referrerId,
  });
  return { coupleEmail, ownerId, plannerEmail, plannerName, weddingId };
}

test.describe('Colaboradores', () => {
  test('o casal remove a cerimonialista, com a confirmação e o Toast (Papéis RN02)', async ({
    page,
  }) => {
    const { coupleEmail, plannerName } = await weddingWithPlanner();
    await signIn({ page, email: coupleEmail });

    await page.goto('/app/colaboradores');
    await expect(page.getByRole('heading', { name: 'Colaboradores', level: 1 })).toBeVisible();
    await expect(page.getByText('Quem tem acesso a este casamento.')).toBeVisible();
    const planners = page.getByRole('region', { name: 'Cerimonialista' });
    await expect(planners.getByText(plannerName)).toBeVisible();
    await expect(planners.getByText(/^Desde \d{2}\/\d{2}$/)).toBeVisible();

    await planners.getByRole('button', { name: `Remover ${plannerName}` }).click();
    const dialog = page.getByRole('alertdialog', { name: `Remover ${plannerName}?` });
    await dialog.getByRole('button', { name: 'Remover' }).click();
    await expect(
      toast({ page, text: `${plannerName} não tem mais acesso ao casamento.` }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Cerimonialista' })).toBeHidden();
  });

  test('a trava de 48 h depois da troca do e-mail de acesso (Papéis RN06a)', async ({ page }) => {
    const { coupleEmail, ownerId, plannerName } = await weddingWithPlanner();
    await db.query(
      `update users set access_email_changed_at = now() - interval '1 hour' where id = $1`,
      [ownerId],
    );
    await signIn({ page, email: coupleEmail });

    await page.goto('/app/colaboradores');
    await page.getByRole('button', { name: `Remover ${plannerName}` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remover' }).click();
    await expect(
      toast({ page, text: 'Não dá para remover ninguém do casamento agora.' }),
    ).toContainText(/Disponível a partir de \d{1,2} de [a-zç]{3}\. às \d{1,2}h(\d{2})?\./);
    await expect(page.getByRole('region', { name: 'Cerimonialista' })).toBeVisible();
  });

  test('a cerimonialista vê a lista em leitura e sai do casamento (Colaboradora RN05)', async ({
    page,
  }) => {
    const { plannerEmail, weddingId } = await weddingWithPlanner();
    await signIn({ page, email: plannerEmail });

    await page.goto(`/cerimonialista/casamentos/${weddingId}/colaboradores`);
    const planners = page.getByRole('region', { name: 'Cerimonialista' });
    for (const name of ['Convidar cerimonialista', 'Remover']) {
      await expect(planners.getByRole('button', { name })).toBeDisabled();
    }
    await expect(
      planners.getByText('Só o casal pode convidar ou remover quem colabora.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Sair deste casamento' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Sair de Ana e Marcos?' });
    await dialog.getByRole('button', { name: 'Sair do casamento' }).click();
    await expect(page).toHaveURL(/\/cerimonialista$/);
    await expect(toast({ page, text: 'Você saiu do casamento de Ana e Marcos.' })).toBeVisible();
    await expect(toast({ page, text: 'Este casamento não está mais disponível.' })).toBeHidden();
  });
});
