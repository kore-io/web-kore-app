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
 * Pagar com Pix (E4 da F3; Publicar e pagar RN03, RN07, RN11 e RN13; decisão 324; Penpot
 * 21, A3): o Pix do Publicar, a tela do Pix (o QR, o copia e cola, a validade, a espera), a
 * confirmação pela rota dev, o Pix vencido com o Gerar novo Pix e o Pagar com cartão que
 * troca o pendente (replacesPaymentId).
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
  const email = newEmail({ label: `pix-${unique()}` });
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

/** No Publicar: a data no limite, o Pix e quem paga (o pagador anterior, se houver). */
async function choosePix({ page, payer = true }: { page: Page; payer?: boolean }) {
  await page.getByLabel('Data de saída do ar').fill(END_DATE_MAX);
  // O input do Radio é sr-only: o toque é no rótulo.
  await page.locator('label', { hasText: 'Pix à vista · 3% de desconto' }).click();
  if (payer) {
    await page.getByLabel('Nome completo').fill('Ana Souza');
    await page.getByLabel('CPF').fill('52998224725');
  }
  await expect(page.getByRole('button', { name: 'Pagar e publicar' })).toBeEnabled();
}

test('o Pix: o QR, o copia e cola, a validade e a confirmação (RN03, RN13)', async ({
  page,
  context,
}) => {
  test.slow();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { email, weddingId } = await couple();
  await signIn({ page, email });
  await page.goto('/app/cobranca/publicar');
  await choosePix({ page });
  const { paymentId, body } = await payAndGetId({ page, weddingId });
  expect(body).toMatchObject({ method: 'pix', installments: 1 });
  expect(body).not.toHaveProperty('cardToken');

  await expect(page).toHaveURL(/\/app\/cobranca\/pix$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Pagar com Pix' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'QR Code do Pix' })).toBeVisible();
  const code = page.getByRole('textbox', {
    name: 'Abram o app do banco e leiam o QR Code, ou copiem o código.',
  });
  await expect(code).toHaveValue(/^00020126/);
  await page.getByRole('button', { name: 'Copiar código' }).click();
  await expect(toast({ page, text: 'Código copiado.' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await code.inputValue());
  await expect(page.getByText(/^O código vale até \d+ de .+ às \d+h(\d{2})?\.$/)).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Aguardando a confirmação' }),
  ).toBeAttached();

  await devEvent({ page, paymentId, event: 'confirm' });
  await expect(page).toHaveURL(/\/app$/, { timeout: 20_000 });
  await expect(toast({ page, text: 'Pagamento confirmado. O site está no ar.' })).toBeVisible();
});

test('o Pix vencido: o aviso e o Gerar novo Pix, que volta ao Publicar e gera outro (RN11; 324)', async ({
  page,
}) => {
  test.slow();
  const { email, weddingId } = await couple();
  await signIn({ page, email });
  await page.goto('/app/cobranca/publicar');
  await choosePix({ page });
  const first = await payAndGetId({ page, weddingId });
  await expect(page).toHaveURL(/\/app\/cobranca\/pix$/);
  const firstCode = await page.getByRole('textbox').inputValue();

  // O vencimento: o gateway local marca o Pix vencido, e o dueAt passa (o pagamento segue
  // pendente até a reconciliação de 10 min cancelar, RN11). A tela vê o vencido pelo dueAt.
  await devEvent({ page, paymentId: first.paymentId, event: 'pix-expired' });
  await db.query(`update payments set due_at = now() - interval '1 minute' where id = $1`, [
    first.paymentId,
  ]);
  await expect(page.getByText('Este código Pix venceu. Gerem um novo para pagar.')).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Gerar novo Pix' }).click();

  // De volta ao Publicar: o Pix, a data e o pagador anterior; a cotação nova.
  await expect(page).toHaveURL(/\/app\/cobranca\/publicar$/);
  await expect(page.getByLabel('Data de saída do ar')).toHaveValue(END_DATE_MAX);
  await expect(page.getByRole('radio', { name: 'Pix à vista · 3% de desconto' })).toBeChecked();
  await expect(page.getByText('Ana Souza · CPF final 4725')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pagar e publicar' })).toBeEnabled();
  const second = await payAndGetId({ page, weddingId });
  expect(second.paymentId).not.toBe(first.paymentId);
  // O pendente vencido ainda estava no servidor: o novo o troca (RN07).
  expect(second.body).toMatchObject({
    method: 'pix',
    payer: { payerId: expect.any(String) },
    replacesPaymentId: first.paymentId,
  });
  await expect(page).toHaveURL(/\/app\/cobranca\/pix$/);
  await expect(page.getByRole('textbox')).not.toHaveValue(firstCode);
});

test('Pagar com cartão a partir do Pix pendente troca o pendente (RN07; 324)', async ({ page }) => {
  test.slow();
  const { email, weddingId } = await couple();
  await signIn({ page, email });
  await page.goto('/app/cobranca/publicar');
  await choosePix({ page });
  const pix = await payAndGetId({ page, weddingId });
  await expect(page).toHaveURL(/\/app\/cobranca\/pix$/);

  await page.getByRole('button', { name: 'Pagar com cartão' }).click();
  await expect(page).toHaveURL(/\/app\/cobranca\/publicar$/);
  await expect(page.getByLabel('Data de saída do ar')).toHaveValue(END_DATE_MAX);
  await expect(page.getByRole('radio', { name: 'Cartão de crédito' })).toBeChecked();
  await page.getByLabel('Número do cartão').fill('4111111111111111');
  await page.getByLabel('Nome impresso no cartão').fill('ANA SOUZA');
  await page.getByLabel('Validade').fill('0829');
  await page.getByLabel('CVV').fill('123');
  const card = await payAndGetId({ page, weddingId });
  expect(card.body).toMatchObject({ method: 'card', replacesPaymentId: pix.paymentId });

  await devEvent({ page, paymentId: card.paymentId, event: 'confirm' });
  await expect(page).toHaveURL(/\/app$/, { timeout: 20_000 });
  const { rows } = await db.query<{ status: string }>('select status from payments where id = $1', [
    pix.paymentId,
  ]);
  expect(rows[0]?.status).toBe('canceled');
});
