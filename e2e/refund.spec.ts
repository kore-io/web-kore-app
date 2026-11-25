import { expect, test, type Page } from '@playwright/test';
import { newEmail } from './mailpit';
import { signIn, toast } from './support/app';
import {
  connectBackoffice,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

/*
 * Desistir e pedir reembolso (E7 da F3; Pagamentos RN02 a RN07; Penpot 21, A9; decisão
 * 327): o casal desiste da publicação no cartão, com o motivo; o site volta a rascunho no
 * pedido, e o estorno confirmado pela rota dev vira Reembolsado. A contestação mostra a
 * legenda, sem o Desistir.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
const EVENT_DATE = '2027-05-15';
const END_DATE_MAX = '2028-05-15';

let db: Db;
test.beforeAll(async () => {
  db = await connectBackoffice();
});
test.afterAll(async () => {
  await db.end();
});

const letters = () => unique().replace(/\d/g, (digit) => 'abcdefghij'[Number(digit)] ?? '');

async function couple() {
  const email = newEmail({ label: `desistir-${unique()}` });
  const userId = await createUser({ db, email, name: 'Ana Souza' });
  const weddingId = await createWedding({
    db,
    partners: [`Ana${letters()}`, 'Marcos Lima'],
    eventDate: EVENT_DATE,
    city: 'São Paulo',
    status: 'draft',
    createdByUserId: userId,
    owners: [userId, null],
  });
  return { email, weddingId };
}

/** Um evento da rota dev para o pagamento (com o Origin do app, por causa do OriginGuard). */
async function devEvent({
  page,
  paymentId,
  event,
}: {
  page: Page;
  paymentId: string;
  event: string;
}) {
  const response = await page.request.post(`${API_URL}/v1/dev/payments/${paymentId}/${event}`, {
    data: {},
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(response.ok(), `${response.status()} ${await response.text()}`).toBe(true);
}

/** Paga e devolve o id do pagamento criado pelo POST. */
async function payAndGetId({ page, weddingId }: { page: Page; weddingId: string }) {
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith(`/v1/weddings/${weddingId}/payments`),
  );
  await page.getByRole('button', { name: 'Pagar e publicar' }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const body = response.request().postDataJSON() as Record<string, unknown>;
  const { paymentId } = (await response.json()) as { paymentId: string };
  return { paymentId, body };
}

/** No Publicar: a data no limite, o cartão e quem paga. */
async function chooseCard({ page }: { page: Page }) {
  await page.getByLabel('Data de saída do ar').fill(END_DATE_MAX);
  await page.locator('label', { hasText: 'Cartão de crédito' }).click();
  await page.getByLabel('Número do cartão').fill('4111111111111111');
  await page.getByLabel('Nome impresso no cartão').fill('ANA SOUZA');
  await page.getByLabel('Validade').fill('0829');
  await page.getByLabel('CVV').fill('123');
  await page.getByLabel('Nome completo').fill('Ana Souza');
  await page.getByLabel('CPF').fill('52998224725');
  await expect(page.getByRole('button', { name: 'Pagar e publicar' })).toBeEnabled();
}

const ACTION = 'Desistir e pedir reembolso';

test('desistir da publicação no cartão: o pedido com o motivo e o estorno confirmado (RN02, RN03, RN07)', async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });
  const { email, weddingId } = await couple();
  await signIn({ page, email });
  await page.goto('/app/cobranca/publicar');
  await chooseCard({ page });
  const { paymentId } = await payAndGetId({ page, weddingId });
  await devEvent({ page, paymentId, event: 'confirm' });
  await expect(page).toHaveURL(/\/app$/, { timeout: 20_000 });

  await page.goto('/app/cobranca');
  await expect(
    page.getByText(/^Vocês podem desistir até \d+ de .+ e receber R\$\s[\d.,]+ de volta\.$/),
  ).toBeVisible();
  await page.getByRole('button', { name: ACTION }).click();
  const dialog = page.getByRole('dialog', { name: 'Desistir da publicação?' });
  await expect(
    dialog.getByText(
      /^O site sai do ar e volta a ser rascunho\. Devolvemos R\$\s[\d.,]+ no mesmo cartão\.$/,
    ),
  ).toBeVisible();
  await dialog
    .getByRole('textbox', { name: 'Motivo (opcional)' })
    .fill('Decidimos adiar o casamento.');
  const requested = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/refund-request'),
  );
  await dialog.getByRole('button', { name: ACTION }).click();
  const response = await requested;
  expect(response.status()).toBe(202);
  expect(response.request().postDataJSON()).toEqual({ reason: 'Decidimos adiar o casamento.' });
  await expect(
    toast({ page, text: 'Reembolso pedido. O site voltou a ser rascunho.' }),
  ).toBeVisible();

  // O site volta a rascunho no pedido: o Publicar o site e o Reembolso pedido com a legenda.
  await expect(page.getByRole('button', { name: 'Publicar o site' })).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Pagamentos' }).getByText('Reembolso pedido'),
  ).toBeVisible();
  await expect(
    page.getByText(
      'No Pix, o valor volta em até 7 dias úteis. No cartão, o estorno aparece numa das próximas faturas.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: ACTION })).toHaveCount(0);
  const { rows } = await db.query<{ status: string }>('select status from weddings where id = $1', [
    weddingId,
  ]);
  expect(rows[0]?.status).toBe('draft');

  // O gateway confirma o estorno.
  await devEvent({ page, paymentId, event: 'refund' });
  await expect(async () => {
    await page.reload();
    await expect(
      page.getByRole('table', { name: 'Pagamentos' }).getByText('Reembolsado'),
    ).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
});

test('a contestação: Em contestação com a legenda, sem o Desistir (RN06)', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });
  const { email, weddingId } = await couple();
  await signIn({ page, email });
  await page.goto('/app/cobranca/publicar');
  await chooseCard({ page });
  const { paymentId } = await payAndGetId({ page, weddingId });
  await devEvent({ page, paymentId, event: 'confirm' });
  await expect(page).toHaveURL(/\/app$/, { timeout: 20_000 });
  await devEvent({ page, paymentId, event: 'dispute' });
  await expect(async () => {
    await page.goto('/app/cobranca');
    await expect(
      page.getByRole('table', { name: 'Pagamentos' }).getByText('Em contestação'),
    ).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await expect(
    page.getByText(
      'O banco do cartão abriu uma contestação deste pagamento. O site continua no ar. Se tiverem dúvidas, escrevam para suporte@kore.com.br.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: ACTION })).toHaveCount(0);
});
