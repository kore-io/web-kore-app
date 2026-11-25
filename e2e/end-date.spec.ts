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
 * Mudar a data de saída do ar (E10 da F3; Data de saída RN05; 289; 293; 294; decisão 333):
 * antecipar e voltar de graça até o paidThrough; o caso B do expirado volta ao ar pela faixa;
 * e a cobrança do Crivo no E7: com uma extensão paga, o total do Alert da publicação é a soma
 * dos pagamentos que o pedido de reembolso leva (refundsPaymentIds).
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
  const email = newEmail({ label: `data-${unique()}` });
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

/** O casamento publicado pelo banco: no ar até end_date, pago até paid_through. */
async function published({ weddingId, sql }: { weddingId: string; sql: string }) {
  await db.query(
    `update weddings set published_at = now() - interval '30 days', publication_source = 'payment', ${sql}
     where id = $1`,
    [weddingId],
  );
}

const field = (page: Page) => page.getByLabel('Nova data de saída do ar');

test('antecipar e voltar a data de graça, até o paidThrough (RN05; 293(3)(4)(6))', async ({
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
  await expect(page).toHaveURL(/\/app\/cobranca\/data-de-saida$/);
  await expect(field(page)).toHaveValue('2027-12-15');
  await field(page).fill('2027-10-15');
  await expect(
    page.getByText('Antecipar a data não devolve dinheiro: os meses já pagos não voltam.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Antecipar a data' }).click();
  await expect(toast({ page, text: 'O site fica no ar até 15 de out. de 2027.' })).toBeVisible();
  await expect(page).toHaveURL(/\/app\/cobranca$/);
  let { rows } = await db.query<{ end_date: string; paid_through: string }>(
    `select to_char(end_date, 'YYYY-MM-DD') end_date, to_char(paid_through, 'YYYY-MM-DD') paid_through
     from weddings where id = $1`,
    [weddingId],
  );
  expect(rows[0]).toEqual({ end_date: '2027-10-15', paid_through: '2027-12-15' });

  // Voltar de graça até o paidThrough: a ajuda em duas faixas e o Voltar a data.
  await page.getByRole('button', { name: 'Mudar a data de saída do ar' }).click();
  await expect(
    page.getByText(
      'Até 15 de dez. de 2027, sem custo. Depois dela, até 15 de mai. de 2028, com os meses a mais.',
    ),
  ).toBeVisible();
  await field(page).fill('2027-12-15');
  await expect(
    page.getByText('Sem cobrança: vocês já pagaram até 15 de dez. de 2027.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Voltar a data' }).click();
  await expect(toast({ page, text: 'O site fica no ar até 15 de dez. de 2027.' })).toBeVisible();
  ({ rows } = await db.query(
    `select to_char(end_date, 'YYYY-MM-DD') end_date, to_char(paid_through, 'YYYY-MM-DD') paid_through
     from weddings where id = $1`,
    [weddingId],
  ));
  expect(rows[0]).toEqual({ end_date: '2027-12-15', paid_through: '2027-12-15' });
});

test('o caso B volta ao ar pela faixa, de graça (289(1); 293(5)(6); 333(2))', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });
  const { email, weddingId } = await couple();
  // Antecipou e expirou, com mês pago à frente; o casamento já foi.
  await db.query(`update weddings set event_date = current_date - 60 where id = $1`, [weddingId]);
  await published({
    weddingId,
    sql: `status = 'expired', end_date = current_date - 20, paid_through = current_date + 30,
      grace_until = current_date - 13, expired_at = current_date - 12`,
  });
  await signIn({ page, email });
  await page.goto('/app/envios/convites');
  await expect(page.getByRole('button', { name: 'Continuar' })).toHaveAccessibleDescription(
    /^O site está fora do ar\. Voltem o site ao ar, sem custo, para enviar\./,
  );
  await page.locator('.kore-lifecycle-banner').getByRole('link', { name: 'Voltar ao ar' }).click();
  await expect(page).toHaveURL(/\/app\/cobranca\/data-de-saida$/);
  await page.getByRole('button', { name: 'Voltar ao ar' }).click();
  await expect(
    page.getByRole('region', { name: /^Avisos/ }).getByText(/^O site voltou ao ar e fica até /),
  ).toBeVisible();
  const { rows } = await db.query<{ status: string; expired_at: string | null }>(
    'select status, expired_at from weddings where id = $1',
    [weddingId],
  );
  expect(rows[0]).toEqual({ status: 'post_event', expired_at: null });
});

test('com uma extensão paga, o Alert da publicação soma o que o reembolso leva (cobrança do E7)', async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });
  const { email, weddingId } = await couple();
  await signIn({ page, email });
  // A publicação no cartão até 15/12/2027, pela tela.
  await page.goto('/app/cobranca/publicar');
  await page.getByLabel('Data de saída do ar').fill('2027-12-15');
  await page.locator('label', { hasText: 'Cartão de crédito' }).click();
  await page.getByLabel('Número do cartão').fill('4111111111111111');
  await page.getByLabel('Nome impresso no cartão').fill('ANA SOUZA');
  await page.getByLabel('Validade').fill('0829');
  await page.getByLabel('CVV').fill('123');
  await page.getByLabel('Nome completo').fill('Ana Souza');
  await page.getByLabel('CPF').fill('52998224725');
  const publication = await payAndGetId({ page, weddingId });
  await devEvent({ page, paymentId: publication.paymentId, event: 'confirm' });
  await expect(page).toHaveURL(/\/app$/, { timeout: 20_000 });

  // A extensão até 15/03/2028, pela API (a tela de pagar a extensão vem no E11).
  const origin = new URL(page.url()).origin;
  const quote = await page.request.get(
    `${API_URL}/v1/weddings/${weddingId}/billing/quote?kind=extension&endDate=2028-03-15&method=card&installments=1`,
    { headers: { Origin: origin } },
  );
  expect(quote.ok(), await quote.text()).toBe(true);
  const { priceVersion, totalCents } = (await quote.json()) as {
    priceVersion: string;
    totalCents: number;
  };
  const billing = await page.request.get(`${API_URL}/v1/weddings/${weddingId}/billing`, {
    headers: { Origin: origin },
  });
  const { payer } = (await billing.json()) as { payer: { payerId: string } };
  const created = await page.request.post(`${API_URL}/v1/weddings/${weddingId}/payments`, {
    headers: { Origin: origin, 'Idempotency-Key': crypto.randomUUID() },
    data: {
      kind: 'extension',
      endDate: '2028-03-15',
      method: 'card',
      installments: 1,
      payer: { payerId: payer.payerId },
      cardToken: 'local_card_1111',
      priceVersion,
      expectedTotalCents: totalCents,
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const extension = (await created.json()) as { paymentId: string };
  await devEvent({ page, paymentId: extension.paymentId, event: 'confirm' });

  await page.goto('/app/cobranca');
  const alert = page.getByText(
    /^Vocês podem desistir até .+ e receber R\$\s([\d.,]+) de volta, com a extensão\.$/,
  );
  await expect(alert).toBeVisible({ timeout: 20_000 });
  const alertCents = Number(
    ((await alert.innerText()).match(/R\$\s([\d.,]+)/)?.[1] ?? '').replace(/\D/g, ''),
  );

  // O pedido da publicação leva a extensão: a soma dos dois é o total do Alert.
  await page.getByRole('button', { name: 'Desistir e pedir reembolso' }).last().click();
  const requested = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/refund-request'),
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Desistir e pedir reembolso' })
    .click();
  const response = await requested;
  expect(response.status()).toBe(202);
  const { refundsPaymentIds } = (await response.json()) as { refundsPaymentIds: string[] };
  expect([...refundsPaymentIds].sort()).toEqual(
    [publication.paymentId, extension.paymentId].sort(),
  );
  const { rows } = await db.query<{ total: string }>(
    'select sum(amount_cents)::text total from payments where id = any($1::uuid[])',
    [refundsPaymentIds],
  );
  expect(alertCents).toBe(Number(rows[0]?.total));
});
