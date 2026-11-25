import { expect, test, type Locator, type Page } from '@playwright/test';
import { codeFrom, latestEmail, newEmail } from './mailpit';
import { signIn, toast } from './support/app';
import {
  connectBackoffice,
  createPlanner,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

/*
 * Publicar o site (E2 da F3; Publicar e pagar RN01; Preço e cotação RN03, RN04 e RN09;
 * Penpot 21): o casal monta a cotação contra a API (a data no limite com o teto, o cartão em
 * 8x com os juros, o Pix) e a colaboradora vê a versão mínima, com o Pagar e publicar
 * desabilitado e sem pedir cotação (Colaboradora RN08 e RN04; decisão 323). Os valores
 * dependem do dia (os meses contam de hoje), então o teste confere as linhas e os totais
 * entre si, e não números fixos.
 */

let db: Db;
test.beforeAll(async () => {
  db = await connectBackoffice();
});
test.afterAll(async () => {
  await db.end();
});

const letters = () => unique().replace(/\d/g, (digit) => 'abcdefghij'[Number(digit)] ?? '');

/** O casamento em 15/05/2027: o limite da data de saída do ar é 15/05/2028. */
const EVENT_DATE = '2027-05-15';
const END_DATE_MAX = '2028-05-15';

/** O valor da linha do Resumo ou do Comparar, pelo rótulo (o termo e a descrição). */
function rowValue(panel: Locator, label: string | RegExp) {
  return panel
    .getByRole('term')
    .filter({ hasText: label })
    .locator('xpath=following-sibling::dd[1]');
}

/** "R$ 1.234,56" (com o espaço sem quebra) em centavos. */
function cents(text: string | null): number {
  const digits = (text ?? '').replace(/[^\d−-]/g, '');
  const negative = /[−-]/.test(digits);
  return (negative ? -1 : 1) * Number(digits.replace(/[−-]/g, ''));
}

async function couple() {
  const email = newEmail({ label: `publicar-${unique()}` });
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
  return { email, userId, weddingId };
}

test('o casal: a data no limite com o teto, o cartão em 8x com os juros e o Pix (RN09)', async ({
  page,
}) => {
  // Muitas cotações e a 1ª abertura do Vite: o triplo do tempo padrão.
  test.slow();
  const { email } = await couple();
  await signIn({ page, email });
  await page.goto('/app/cobranca/publicar');
  await expect(page.getByRole('heading', { level: 1, name: 'Publicar o site' })).toBeVisible();
  await expect(
    page.getByText(
      'Depois do casamento e até 15 de mai. de 2028. O mês incompleto conta como mês inteiro.',
    ),
  ).toBeVisible();
  // Sem a data: os vazios e o motivo do botão (Pena 7).
  await expect(page.getByText('Escolham a data de saída do ar para ver o resumo.')).toBeVisible();
  const pay = page.getByRole('button', { name: 'Pagar e publicar' });
  await expect(pay).toBeDisabled();
  await expect(pay).toHaveAccessibleDescription('Escolham a data de saída do ar para publicar.');

  // A data no limite: o teto e a legenda, sem o Alert de meses.
  await page.getByLabel('Data de saída do ar').fill(END_DATE_MAX);
  const summary = page.getByRole('region', { name: 'Resumo' });
  await expect(rowValue(summary, 'Preço máximo do Kore')).toBeVisible();
  await expect(
    summary.getByText(/^A publicação custa no máximo R\$\s449, a partir de 11 meses\.$/),
  ).toBeVisible();
  await expect(page.getByText(/^Na publicação, o preço para em/)).toHaveCount(0);
  await expect(rowValue(summary, 'Ativação')).toHaveText(/R\$\s149,00/);
  // O total do cartão sem juros é o mesmo do Comparar.
  const compare = page.getByRole('region', { name: 'Comparar as formas de pagamento' });
  const cardTotal = cents(await rowValue(summary, 'Total').textContent());
  expect(cents(await rowValue(compare, 'Cartão em até 6x, sem juros').textContent())).toBe(
    cardTotal,
  );
  await expect(
    page.getByText(
      /^Preço: R\$\s[\d.,]+, pago uma vez\. O site fica no ar até 15 de mai\. de 2028\.$/,
    ),
  ).toBeVisible();

  // O cartão em 8x: a linha dos juros, o Alert e a 3ª linha do Comparar, com o total da
  // 2ª cotação (decisão 322).
  const installments = page.getByLabel('Parcelas');
  await expect(installments.locator('option')).toHaveCount(12);
  await installments.selectOption('8');
  await expect(rowValue(summary, 'Juros do cartão (8x)')).toBeVisible();
  const withInterest = cents(await rowValue(summary, 'Total').textContent());
  const interest = cents(await rowValue(summary, 'Juros do cartão (8x)').textContent());
  expect(withInterest).toBe(cardTotal + interest);
  await expect(
    page.getByText(/^Em 8x, o cartão cobra juros de .* Até 6x, não há juros\.$/),
  ).toBeVisible();
  expect(cents(await rowValue(compare, 'Cartão em 8x, com juros').textContent())).toBe(
    withInterest,
  );
  await expect(installments.locator('option[value="8"]')).toHaveText(
    /^8x (de .* )?com juros.*\(total R\$\s[\d.,]+\)$/,
  );

  // O Pix: o desconto do Pix e o total do Pix do Comparar; sem parcelas.
  // O input do Radio é sr-only: o toque é no rótulo (o label com a área de toque).
  await page.locator('label', { hasText: 'Pix à vista · 3% de desconto' }).click();
  await expect(page.getByRole('radio', { name: 'Pix à vista · 3% de desconto' })).toBeChecked();
  await expect(rowValue(summary, 'Desconto do Pix (3%)')).toBeVisible();
  expect(cents(await rowValue(summary, 'Total').textContent())).toBe(
    cents(await rowValue(compare, 'Pix à vista').textContent()),
  );
  await expect(page.getByLabel('Parcelas')).toHaveCount(0);

  // Com o Pix, o Pagar e publicar paga (E4), sem motivo.
  await expect(pay).toBeEnabled();
  await expect(pay).not.toHaveAccessibleDescription(/./);

  // A data fora do limite: o erro no campo.
  await page.getByLabel('Data de saída do ar').fill('2028-06-15');
  await expect(
    page.getByText('Escolham uma data depois do casamento e até 15 de mai. de 2028.'),
  ).toBeVisible();
  await expect(page.getByLabel('Data de saída do ar')).toHaveAttribute('aria-invalid', 'true');

  // Cancelar volta ao Dashboard.
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(/\/app$/);
});

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

test('a colaboradora: o Pagar e publicar desabilitado e sem valores (Colaboradora RN08 e RN04; decisão 323)', async ({
  page,
}) => {
  const email = newEmail({ label: `publicar-colab-${unique()}` });
  const userId = await createUser({ db, email, name: 'Juliana Prado' });
  const referrerId = await createPlanner({ db, userId, creditName: `Prado ${letters()}` });
  const ownerId = await createUser({
    db,
    email: newEmail({ label: `dono-${unique()}` }),
    name: 'Fernanda Lima',
  });
  const weddingId = await createWedding({
    db,
    partners: [`Fernanda${letters()}`, 'João Lima'],
    eventDate: EVENT_DATE,
    city: 'São Paulo',
    status: 'draft',
    createdByUserId: userId,
    owners: [ownerId, null],
    collaboratorIds: [userId],
    referrerId,
  });
  await signInByCode({ page, email });
  const quotes: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/billing/quote')) quotes.push(request.url());
  });
  await page.goto(`/cerimonialista/casamentos/${weddingId}/cobranca/publicar`);
  await expect(page.getByRole('heading', { level: 1, name: 'Publicar o site' })).toBeVisible();
  const pay = page.getByRole('button', { name: 'Pagar e publicar' });
  await expect(pay).toBeDisabled();
  await expect(pay).toHaveAccessibleDescription('Só o casal pode publicar e pagar.');
  await expect(page.getByRole('region', { name: 'Resumo do contrato' })).toBeVisible();
  for (const name of ['Resumo', 'Comparar as formas de pagamento', 'Forma de pagamento']) {
    await expect(page.getByRole('region', { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByLabel('Data de saída do ar')).toHaveCount(0);
  await expect(page.getByText(/^Preço:/)).toHaveCount(0);
  expect(quotes).toEqual([]);
});

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

/** Escolhe a data (no limite), o cartão em 1x e preenche o cartão e quem paga. */
async function fillPublish({
  page,
  cardNumber,
  payer = true,
}: {
  page: Page;
  cardNumber: string;
  payer?: boolean;
}) {
  await page.getByLabel('Data de saída do ar').fill(END_DATE_MAX);
  await expect(rowValue(page.getByRole('region', { name: 'Resumo' }), 'Ativação')).toBeVisible();
  await page.getByLabel('Número do cartão').fill(cardNumber);
  await page.getByLabel('Nome impresso no cartão').fill('ANA SOUZA');
  await page.getByLabel('Validade').fill('0829');
  await page.getByLabel('CVV').fill('123');
  if (payer) {
    await page.getByLabel('Nome completo').fill('Ana Souza');
    await page.getByLabel('CPF').fill('52998224725');
  }
}

test('o cartão aprovado: o Confirmando, a confirmação e o site no ar (E3; RN03 e RN04)', async ({
  page,
}) => {
  test.slow();
  const { email, weddingId } = await couple();
  await signIn({ page, email });
  await page.goto('/app/cobranca/publicar');
  await fillPublish({ page, cardNumber: '4111111111111111' });
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith(`/v1/weddings/${weddingId}/payments`),
  );
  await page.getByRole('button', { name: 'Pagar e publicar' }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  expect(response.request().headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
  const { paymentId, status } = (await response.json()) as { paymentId: string; status: string };
  expect(status).toBe('pending');
  // O site só vai ao ar na confirmação (RN04): até ela, o Confirmando (o Spinner e a frase).
  await expect(
    page.getByRole('status').filter({ hasText: 'Confirmando o pagamento' }),
  ).toBeAttached();
  await expect(page.getByRole('button', { name: 'Pagar e publicar' })).toBeDisabled();
  // A rota dev é pública, mas passa pelo OriginGuard: a origem do app.
  const confirm = await page.request.post(`${API_URL}/v1/dev/payments/${paymentId}/confirm`, {
    data: {},
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(confirm.ok(), `${confirm.status()} ${await confirm.text()}`).toBe(true);
  await expect(page).toHaveURL(/\/app$/, { timeout: 20_000 });
  await expect(toast({ page, text: 'Pagamento confirmado. O site está no ar.' })).toBeVisible();
  const { rows } = await db.query<{ status: string }>('select status from weddings where id = $1', [
    weddingId,
  ]);
  expect(rows[0]?.status).toBe('published');
});

test('o cartão recusado (final 0002) e, de volta à tela, o pagador anterior (RN02, RN03; 316(3))', async ({
  page,
}) => {
  test.slow();
  const { email } = await couple();
  await signIn({ page, email });
  await page.goto('/app/cobranca/publicar');
  await fillPublish({ page, cardNumber: '4000000000000002' });
  await page.getByRole('button', { name: 'Pagar e publicar' }).click();
  await expect(
    page.getByText(
      'O banco do cartão não aprovou o pagamento. Confiram os dados, usem outro cartão ou paguem com Pix.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pagar e publicar' })).toBeEnabled();
  // De volta, o pagador anterior: o nome e o CPF final, sem o CPF inteiro.
  await page.reload();
  await expect(page.getByText('Ana Souza · CPF final 4725')).toBeVisible();
  await expect(page.getByLabel('CPF')).toHaveCount(0);
  await page.getByRole('button', { name: 'Usar outro CPF' }).click();
  await expect(page.getByLabel('CPF')).toBeVisible();
});

test('as entradas do Publicar: o Dashboard, o Checklist, o Editor e Envios (243(c); E5)', async ({
  page,
}) => {
  test.slow();
  const { email } = await couple();
  await signIn({ page, email });
  const heading = page.getByRole('heading', { level: 1, name: 'Publicar o site' });

  // Dashboard (Penpot 03, A5): a linha do preço e o Publicar no cartão Status do site.
  await page.goto('/app');
  const status = page.getByRole('region', { name: 'Status do site' });
  await expect(
    status.getByText('Montar é grátis. Vocês só pagam quando publicarem.'),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Checklist' }).getByRole('link', { name: 'Publicar o site' }),
  ).toHaveAttribute('href', '/app/cobranca/publicar');
  await status.getByRole('button', { name: 'Publicar' }).click();
  await expect(heading).toBeVisible();

  // O cabeçalho do Editor.
  await page.goto('/app/site/dados-basicos');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(heading).toBeVisible();

  // A legenda de Envios.
  await page.goto('/app/envios/convites');
  await page.getByRole('link', { name: 'Publicar o site' }).click();
  await expect(heading).toBeVisible();
});
