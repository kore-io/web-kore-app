import { expect, test, type Page } from '@playwright/test';
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
 * O casamento bloqueado no app (E13 da F3; Bloqueado RN02, RN04 e RN07): a faixa do casal e a
 * da colaboradora, empilhada; o Enviar convites e o Continuar dos Envios desabilitados com o
 * motivo; a API recusando a escrita com o 403 WEDDING_BLOCKED; e o bloqueio em corrida, que
 * vira o Toast e fecha a tela pelo /me relido. O bloqueio vem do banco (`blocked_at`).
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
const APP = { origin: 'http://localhost:5173' };
const BANNER = 'O site foi bloqueado. O suporte atende em suporte@kore.com.br.';
const LOCKED = 'Indisponível enquanto o site está bloqueado.';

let db: Db;
test.beforeAll(async () => {
  db = await connectBackoffice();
});
test.afterAll(async () => {
  await db.end();
});

const letters = () => unique().replace(/\d/g, (digit) => 'abcdefghij'[Number(digit)] ?? '');

/** O casamento publicado, com o prazo da saída do ar à frente. */
async function published({
  ownerId,
  collaboratorId,
  referrerId,
}: {
  ownerId: string;
  collaboratorId?: string;
  referrerId?: string;
}) {
  const weddingId = await createWedding({
    db,
    partners: [`Ana${letters()}`, 'Marcos Lima'],
    eventDate: '2027-06-01',
    city: 'São Paulo',
    status: 'draft',
    createdByUserId: collaboratorId ?? ownerId,
    owners: [ownerId, null],
    ...(collaboratorId && { collaboratorIds: [collaboratorId] }),
    ...(referrerId && { referrerId }),
  });
  await db.query(
    `update weddings set status = 'published', event_date = current_date + 60,
       end_date = current_date + 150, paid_through = current_date + 150,
       published_at = now(), publication_source = 'payment'
     where id = $1`,
    [weddingId],
  );
  return weddingId;
}

const block = (weddingId: string) =>
  db.query(`update weddings set blocked_at = now() where id = $1`, [weddingId]);

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

test('o casal lê, mas não escreve: a faixa, os motivos e o 403 da API (RN02 e RN04)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const email = newEmail({ label: `bloqueado-${unique()}` });
  const ownerId = await createUser({ db, email, name: 'Ana Souza' });
  const weddingId = await published({ ownerId });
  await block(weddingId);
  await signIn({ page, email });
  await page.goto('/app');
  const banner = page.locator('.kore-lifecycle-banner');
  await expect(banner).toHaveText(BANNER);
  await expect(banner.getByRole('link', { name: 'suporte@kore.com.br' })).toHaveAttribute(
    'href',
    'mailto:suporte@kore.com.br',
  );
  // O selo mantém o status de antes (RN04, A7), no cartão Status (no celular a Topbar não o tem).
  await expect(
    page
      .getByRole('heading', { name: 'Status do site', level: 2 })
      .locator('xpath=ancestor::section[1]')
      .getByText('Publicado'),
  ).toBeVisible();
  const send = page.getByRole('button', { name: 'Enviar convites' });
  await expect(send).toBeDisabled();
  await expect(send).toHaveAccessibleDescription(LOCKED);
  await page.goto('/app/envios/convites');
  const next = page.getByRole('button', { name: 'Continuar' });
  await expect(next).toBeDisabled();
  await expect(next).toHaveAccessibleDescription(LOCKED);
  // A API recusa a escrita (RN02).
  const refused = await page.request.put(`${API_URL}/v1/weddings/${weddingId}/rsvp-deadline`, {
    headers: APP,
    data: { rsvpDeadline: null },
  });
  expect(refused.status()).toBe(403);
  expect(await refused.json()).toMatchObject({ error: 'WEDDING_BLOCKED' });
});

test('o bloqueio em corrida: o Toast com o motivo e a tela fechada pelo /me relido (RN04 e RN07)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const email = newEmail({ label: `bloqueado-corrida-${unique()}` });
  const ownerId = await createUser({ db, email, name: 'Ana Souza' });
  const weddingId = await published({ ownerId });
  await signIn({ page, email });
  await page.goto('/app/envios/prazo');
  const save = page.getByRole('button', { name: 'Salvar prazo' });
  await page.getByLabel('Prazo de resposta').fill('2026-12-20');
  await expect(save).toBeEnabled();
  await block(weddingId);
  await save.click();
  await expect(toast({ page, text: LOCKED })).toBeVisible();
  await expect(page.locator('.kore-lifecycle-banner')).toHaveText(BANNER);
  await expect(save).toBeDisabled();
  await expect(save).toHaveAccessibleDescription(LOCKED);
});

test('a colaboradora: a faixa do bloqueio acima de "Você colabora neste casamento." (RN04)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  const email = newEmail({ label: `bloqueado-colab-${unique()}` });
  const userId = await createUser({ db, email, name: 'Juliana Prado' });
  const referrerId = await createPlanner({ db, userId, creditName: `Prado ${letters()}` });
  const ownerId = await createUser({
    db,
    email: newEmail({ label: `dono-${unique()}` }),
    name: 'Fernanda Lima',
  });
  const weddingId = await published({ ownerId, collaboratorId: userId, referrerId });
  await block(weddingId);
  await signInByCode({ page, email });
  await page.goto(`/cerimonialista/casamentos/${weddingId}`);
  const banner = page.locator('.kore-lifecycle-banner');
  await expect(banner).toHaveText(BANNER);
  const collaborator = page.getByText('Você colabora neste casamento.');
  await expect(collaborator).toBeVisible();
  const bannerBox = await banner.boundingBox();
  const collaboratorBox = await collaborator.boundingBox();
  expect(bannerBox && collaboratorBox && bannerBox.y < collaboratorBox.y).toBe(true);
  await expect(page.getByRole('button', { name: 'Enviar convites' })).toHaveAccessibleDescription(
    LOCKED,
  );
  // O detalhe de Meus casamentos sabe do bloqueio (decisão 344), e o Sair continua (RN03).
  const detail = await page.request.get(`${API_URL}/v1/me/weddings/${weddingId}`, {
    headers: APP,
  });
  expect(await detail.json()).toMatchObject({ blocked: true });
  await page.goto(`/cerimonialista?casamento=${weddingId}`);
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Sair deste casamento' }),
  ).toBeEnabled();
});

test('Convidados e o Editor em leitura: o Novo grupo, o 403 ao criar e os campos (RN02 a RN04)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const email = newEmail({ label: `bloqueado-telas-${unique()}` });
  const ownerId = await createUser({ db, email, name: 'Ana Souza' });
  const weddingId = await published({ ownerId });
  await signIn({ page, email });
  // Um grupo antes do bloqueio, para a lista ter linha.
  const created = await page.request.post(`${API_URL}/v1/weddings/${weddingId}/parties`, {
    headers: APP,
    data: { name: 'Família Moreira', guests: [{ name: 'Célia Moreira' }] },
  });
  expect(created.ok()).toBe(true);
  await block(weddingId);
  await page.goto('/app/convidados');
  await expect(page.locator('.kore-lifecycle-banner')).toHaveText(BANNER);
  await expect(page.getByText('Família Moreira')).toBeVisible();
  const add = page.getByRole('button', { name: 'Novo grupo' });
  await expect(add).toBeDisabled();
  await expect(add).toHaveAccessibleDescription(LOCKED);
  await expect(page.getByRole('checkbox', { name: 'Selecionar Família Moreira' })).toBeDisabled();
  // A API recusa criar o grupo (o cenário da spec).
  const refused = await page.request.post(`${API_URL}/v1/weddings/${weddingId}/parties`, {
    headers: APP,
    data: { name: 'Tio Jorge', guests: [{ name: 'Jorge Moreira' }] },
  });
  expect(refused.status()).toBe(403);
  expect(await refused.json()).toMatchObject({ error: 'WEDDING_BLOCKED' });
  // O Editor abre em leitura: os campos desabilitados e o Salvar com o motivo.
  await page.goto('/app/site/dados-basicos');
  await expect(page.getByRole('textbox', { name: 'Cidade' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Salvar' })).toHaveAccessibleDescription(LOCKED);
  await expect(page.getByRole('button', { name: 'Pré-visualizar' })).toBeEnabled();
});
