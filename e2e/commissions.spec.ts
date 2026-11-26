import { expect, test, type Page } from '@playwright/test';
import { codeFrom, latestEmail, newEmail } from './mailpit';
import { signIn } from './support/app';
import {
  connectBackoffice,
  createPlanner,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

/*
 * Comissões da cerimonialista (E16 da F3; Comissões do indicador RN01, RN02 e RN07): o casal
 * indicado paga a publicação pelo app, a comissão nasce Aguardando liberação, e a
 * cerimonialista a vê na tela Comissões, nas duas abas; liberada pelo banco, ela fica
 * Disponível. O valor vem da API: a tela não calcula nada.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
const END_DATE_MAX = '2028-05-15';

let db: Db;
test.beforeAll(async () => {
  db = await connectBackoffice();
});
test.afterAll(async () => {
  await db.end();
});

const letters = () => unique().replace(/\d/g, (digit) => 'abcdefghij'[Number(digit)] ?? '');

async function signInByCode({ page, email }: { page: Page; email: string }) {
  await page.goto('/entrar');
  await page.getByRole('textbox', { name: 'E-⁠mail' }).fill(email);
  const since = new Date(Date.now() - 1000);
  await page.getByRole('button', { name: 'Receber código' }).click();
  await expect(page.getByRole('heading', { name: 'Confira seu e-⁠mail' })).toBeVisible();
  const code = codeFrom({ email: await latestEmail({ request: page.request, to: email, since }) });
  await page.keyboard.type(code);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
}

test('a publicação paga pelo casal indicado vira comissão na tela da cerimonialista (RN07)', async ({
  page,
  browser,
}) => {
  test.slow();
  const plannerEmail = newEmail({ label: `comissoes-${unique()}` });
  const plannerId = await createUser({ db, email: plannerEmail, name: 'Juliana Prado' });
  const referrerId = await createPlanner({
    db,
    userId: plannerId,
    creditName: `Prado ${letters()}`,
  });
  const coupleEmail = newEmail({ label: `comissoes-casal-${unique()}` });
  const ownerId = await createUser({ db, email: coupleEmail, name: 'Ana Souza' });
  const first = `Ana${letters()}`;
  const weddingId = await createWedding({
    db,
    partners: [first, 'Marcos Lima'],
    eventDate: '2027-05-15',
    city: 'São Paulo',
    status: 'draft',
    createdByUserId: ownerId,
    owners: [ownerId, null],
    referrerId,
  });

  // O casal paga a publicação no cartão, em 1x, e a rota dev confirma.
  await signIn({ page, email: coupleEmail });
  await page.goto('/app/cobranca/publicar');
  await page.getByLabel('Data de saída do ar').fill(END_DATE_MAX);
  await page.getByLabel('Número do cartão').fill('4111111111111111');
  await page.getByLabel('Nome impresso no cartão').fill('ANA SOUZA');
  await page.getByLabel('Validade').fill('0829');
  await page.getByLabel('CVV').fill('123');
  await page.getByLabel('Nome completo').fill('Ana Souza');
  await page.getByLabel('CPF').fill('52998224725');
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith(`/v1/weddings/${weddingId}/payments`),
  );
  await page.getByRole('button', { name: 'Pagar e publicar' }).click();
  const { paymentId } = (await (await created).json()) as { paymentId: string };
  const confirm = await page.request.post(`${API_URL}/v1/dev/payments/${paymentId}/confirm`, {
    data: {},
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(confirm.ok(), `${confirm.status()} ${await confirm.text()}`).toBe(true);
  await expect(page).toHaveURL(/\/app$/, { timeout: 20_000 });
  const {
    rows: [commission],
  } = await db.query<{ amount_cents: number; base_amount_cents: number }>(
    'select amount_cents, base_amount_cents from commissions where wedding_id = $1',
    [weddingId],
  );
  expect(commission).toBeDefined();
  const money = (cents: number) =>
    `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  // A cerimonialista vê a comissão.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const planner = await context.newPage();
  await signInByCode({ page: planner, email: plannerEmail });
  await planner.getByRole('link', { name: 'Comissões' }).first().click();
  await expect(planner).toHaveURL(/\/cerimonialista\/comissoes$/);
  await expect(planner.getByRole('heading', { level: 1, name: 'Comissões' })).toBeVisible();
  const row = planner.getByRole('row').filter({ hasText: first });
  await expect(row.getByText('Publicação')).toBeVisible();
  await expect(row.getByText(money(commission?.base_amount_cents ?? 0))).toBeVisible();
  await expect(row.getByText(money(commission?.amount_cents ?? 0))).toBeVisible();
  await expect(row.getByText('Aguardando liberação')).toBeVisible();
  await expect(row.getByText(/^Libera em \d{2}\/\d{2}/)).toBeVisible();
  await expect(planner.getByText(/%/)).toHaveCount(0);
  await planner.getByRole('button', { name: 'Por casamento' }).click();
  await expect(
    planner
      .getByRole('row')
      .filter({ hasText: first })
      .getByText(/^Libera em \d{2}\/\d{2}/),
  ).toBeVisible();

  // Liberada pelo banco: Disponível, e o saldo pode ir ao repasse.
  await db.query(
    `update commissions set status = 'available', available_at = now() - interval '1 day'
     where wedding_id = $1`,
    [weddingId],
  );
  await planner.reload();
  await expect(
    planner.getByRole('row').filter({ hasText: first }).getByText('Disponível'),
  ).toBeVisible();
  await expect(planner.getByText('já pode pedir o repasse').first()).toBeVisible();
  await context.close();
});
