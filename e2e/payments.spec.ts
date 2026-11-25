import { expect, test, type Page } from '@playwright/test';
import { newEmail } from './mailpit';
import { signIn } from './support/app';
import {
  connectBackoffice,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

/*
 * Cobrança e publicação › Pagamentos (E6 da F3; Pagamentos RN01; Penpot 21, A9; decisão
 * 326): o rascunho com o vazio e o Publicar o site; o Pix confirmado pela rota dev vira a
 * linha da tabela; no celular, a tabela vira cartões e o cabeçalho segue na árvore
 * acessível (a guarda do sr-only da DataTable, cobrança do Crivo no L1).
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
  const email = newEmail({ label: `pagamentos-${unique()}` });
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

test('Pagamentos: o vazio no rascunho, o Publicar o site e o Pix pago na tabela (RN01; 326)', async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });
  const { email, weddingId } = await couple();
  await signIn({ page, email });

  // Rascunho: o vazio do Penpot e o Publicar o site no cabeçalho.
  await page.getByRole('link', { name: 'Cobrança e publicação' }).click();
  await expect(page).toHaveURL(/\/app\/cobranca$/);
  await expect(page.getByRole('link', { name: 'Cobrança e publicação' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(
    page.getByRole('heading', { level: 1, name: 'Cobrança e publicação' }),
  ).toBeVisible();
  await expect(page.getByText('Nenhum pagamento ainda.')).toBeVisible();
  await page.getByRole('button', { name: 'Publicar o site' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Publicar o site' })).toBeVisible();

  // Paga no Pix e confirma pela rota dev.
  await choosePix({ page });
  const { paymentId } = await payAndGetId({ page, weddingId });
  await expect(page).toHaveURL(/\/app\/cobranca\/pix$/);
  await devEvent({ page, paymentId, event: 'confirm' });
  await expect(page).toHaveURL(/\/app$/, { timeout: 20_000 });

  // Publicado: o subtítulo e a linha do pagamento.
  await page.getByRole('link', { name: 'Cobrança e publicação' }).click();
  await expect(page.getByText(/^Publicado · no ar até 15 de mai\. de 2028$/)).toBeVisible();
  const table = page.getByRole('table', { name: 'Pagamentos' });
  const row = table.getByRole('row').nth(1);
  await expect(row.getByRole('cell').nth(1)).toHaveText('Publicação');
  await expect(row.getByRole('cell').nth(4)).toContainText('Pix');
  await expect(row.getByRole('cell').nth(5)).toContainText('Pago');
  await expect(row.getByRole('cell').nth(2)).toContainText(/a 15\/05\/2028 \(\d+ meses\)$/);
  await expect(page.getByRole('button', { name: 'Publicar o site' })).toHaveCount(0);

  // No celular, os cartões; o cabeçalho continua na árvore acessível (sr-only).
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(table.getByRole('columnheader', { name: 'Valor' })).toBeAttached();
  await expect(table.getByRole('columnheader', { name: 'Valor' })).not.toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
