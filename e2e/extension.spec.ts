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
 * Pagar a extensão (E11 da F3; Data de saída RN04; Preço RN03; 293; 314): adiar no cartão
 * com a confirmação pela rota dev; renovar o expirado no Pix, pela faixa, com a tela do Pix
 * da extensão; e a A7 do sem renovação. O estado vem do banco, com datas relativas a
 * current_date, e o dinheiro passa pela rota dev.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
const EVENT_DATE = '2027-05-15';

let db: Db;
test.beforeAll(async () => {
  db = await connectBackoffice();
});
test.afterAll(async () => {
  await db.end();
});

const letters = () => unique().replace(/\d/g, (digit) => 'abcdefghij'[Number(digit)] ?? '');

async function couple() {
  const email = newEmail({ label: `extensao-${unique()}` });
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

/** O casamento publicado pelo banco: no ar até end_date, pago até paid_through. */
async function published({ weddingId, sql }: { weddingId: string; sql: string }) {
  await db.query(
    `update weddings set published_at = now() - interval '30 days', publication_source = 'payment', ${sql}
     where id = $1`,
    [weddingId],
  );
}

const field = (page: Page) => page.getByLabel('Nova data de saída do ar');

/** Quem paga: o nome e o CPF de teste. */
async function payer(page: Page) {
  await page.getByLabel('Nome completo').fill('Ana Souza');
  await page.getByLabel('CPF').fill('52998224725');
}

/** Paga e devolve o id do pagamento criado pelo POST, pelo rótulo do botão. */
async function payWith({
  page,
  weddingId,
  button,
}: {
  page: Page;
  weddingId: string;
  button: string;
}) {
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith(`/v1/weddings/${weddingId}/payments`),
  );
  await page.getByRole('button', { name: button }).click();
  const response = await created;
  expect(response.status(), await response.text()).toBe(201);
  const body = response.request().postDataJSON() as Record<string, unknown>;
  const { paymentId } = (await response.json()) as { paymentId: string };
  return { paymentId, body };
}

test('adiar no cartão: o Resumo, o Pagar e adiar e a nova data na confirmação (RN04)', async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });
  const { email, weddingId } = await couple();
  await published({
    weddingId,
    sql: `status = 'published', end_date = '2027-12-15', paid_through = '2027-12-15'`,
  });
  await signIn({ page, email });
  await page.goto('/app/cobranca');
  await page.getByRole('button', { name: 'Mudar a data de saída do ar' }).click();
  await field(page).fill('2028-03-15');
  await expect(page.getByText(/^3 meses a mais × R\$\s29$/)).toBeVisible();
  await page.locator('label', { hasText: 'Cartão de crédito' }).click();
  await page.getByLabel('Número do cartão').fill('4111111111111111');
  await page.getByLabel('Nome impresso no cartão').fill('ANA SOUZA');
  await page.getByLabel('Validade').fill('0829');
  await page.getByLabel('CVV').fill('123');
  await payer(page);
  const { paymentId, body } = await payWith({ page, weddingId, button: 'Pagar e adiar' });
  expect(body).toMatchObject({ kind: 'extension', endDate: '2028-03-15', method: 'card' });
  await devEvent({ page, paymentId, event: 'confirm' });
  await expect(toast({ page, text: 'O site fica no ar até 15 de mar. de 2028.' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page).toHaveURL(/\/app\/cobranca$/);
  const { rows } = await db.query<{ end_date: string; paid_through: string }>(
    `select to_char(end_date, 'YYYY-MM-DD') end_date, to_char(paid_through, 'YYYY-MM-DD') paid_through
     from weddings where id = $1`,
    [weddingId],
  );
  expect(rows[0]).toEqual({ end_date: '2028-03-15', paid_through: '2028-03-15' });
});

test('renovar o expirado no Pix, pela faixa: o "de hoje", a tela do Pix e a volta ao ar (RN04; 293(2))', async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });
  const { email, weddingId } = await couple();
  await db.query(`update weddings set event_date = current_date - 60 where id = $1`, [weddingId]);
  await published({
    weddingId,
    sql: `status = 'expired', end_date = current_date - 20, paid_through = current_date - 20,
      grace_until = current_date - 13, expired_at = current_date - 12`,
  });
  await signIn({ page, email });
  await page.goto('/app');
  await page.locator('.kore-lifecycle-banner').getByRole('link', { name: 'Renovar' }).click();
  await expect(page).toHaveURL(/\/app\/cobranca\/data-de-saida$/);
  const { rows: target } = await db.query<{ day: string }>(
    `select to_char(current_date + 60, 'YYYY-MM-DD') as day`,
  );
  await field(page).fill(target[0]?.day ?? '');
  await expect(page.getByText(/^\d+ meses × R\$\s29 \(de hoje até .+\)$/)).toBeVisible();
  await expect(page.getByText('Os meses contam a partir de hoje.')).toBeVisible();
  await page.locator('label', { hasText: 'Pix à vista · 3% de desconto' }).click();
  await payer(page);
  const { paymentId } = await payWith({ page, weddingId, button: 'Pagar e renovar' });
  await expect(page).toHaveURL(/\/app\/cobranca\/pix$/);
  await expect(
    page.getByText('A nova data vale assim que o pagamento for confirmado.'),
  ).toBeVisible();
  await devEvent({ page, paymentId, event: 'confirm' });
  await expect(page).toHaveURL(/\/app\/cobranca$/, { timeout: 20_000 });
  await expect(
    page.getByRole('region', { name: /^Avisos/ }).getByText(/^O site fica no ar até /),
  ).toBeVisible();
  const { rows } = await db.query<{ status: string }>('select status from weddings where id = $1', [
    weddingId,
  ]);
  expect(rows[0]?.status).toBe('post_event');
});

test('sem renovação: a A7, com a guarda dos dados e o Exportar os convidados (314; Retenção RN01)', async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });
  const { email, weddingId } = await couple();
  await db.query(`update weddings set event_date = current_date - 400 where id = $1`, [weddingId]);
  await published({
    weddingId,
    sql: `status = 'expired', end_date = current_date - 30, paid_through = current_date - 30,
      grace_until = current_date - 23, expired_at = current_date - 22, purge_at = current_date + 160`,
  });
  await signIn({ page, email });
  await page.goto('/app/cobranca');
  await page.getByRole('button', { name: 'Mudar a data de saída do ar' }).click();
  await expect(
    page.getByText(
      'O site chegou ao prazo máximo, 12 meses depois do casamento, e não pode mais ser renovado. Vocês ainda podem exportar os convidados.',
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/^Os dados ficam guardados até .+\. Depois, são apagados\.$/),
  ).toBeVisible();
  await expect(page.locator('.kore-lifecycle-banner')).toHaveCount(0);
  await page.getByRole('link', { name: 'Exportar os convidados' }).click();
  await expect(page).toHaveURL(/\/app\/convidados\/exportar$/);
});
