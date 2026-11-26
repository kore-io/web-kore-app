import { expect, test } from '@playwright/test';
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
 * A exclusão agendada no app (E14 da F3, parte 1; Retenção RN05; 316(8); 318(11)): pedida pela
 * API, com a sessão recente do login; a faixa do casal, a trava das telas e o 409 da API; e o
 * Cancelar a exclusão, que devolve o site ao ar e a escrita.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
const APP = { origin: 'http://localhost:5173' };
const LOCKED = 'Indisponível enquanto a exclusão está agendada.';

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

test('a exclusão agendada: a faixa, a trava, o 409 e o Cancelar a exclusão (Retenção RN05)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const email = newEmail({ label: `exclusao-${unique()}` });
  const ownerId = await createUser({ db, email, name: 'Ana Souza' });
  const weddingId = await published({ ownerId });
  await signIn({ page, email });
  const me = (await (await page.request.get(`${API_URL}/v1/me`, { headers: APP })).json()) as {
    memberships: { weddingId: string; weddingName: string }[];
  };
  const confirmName = me.memberships.find((item) => item.weddingId === weddingId)?.weddingName;
  const scheduled = await page.request.post(`${API_URL}/v1/weddings/${weddingId}/deletion`, {
    headers: APP,
    data: { confirmName },
  });
  expect(scheduled.status()).toBe(202);
  await page.goto('/app');
  const banner = page.locator('.kore-lifecycle-banner');
  await expect(banner).toContainText(
    /^O casamento será apagado em \d+ de .+ O site está fora do ar\./,
  );
  await expect(page.getByRole('button', { name: 'Enviar convites' })).toHaveAccessibleDescription(
    LOCKED,
  );
  await page.goto('/app/convidados');
  await expect(page.getByRole('button', { name: 'Novo grupo' })).toHaveAccessibleDescription(
    LOCKED,
  );
  // A API recusa a escrita (o cenário da spec).
  const refused = await page.request.post(`${API_URL}/v1/weddings/${weddingId}/parties`, {
    headers: APP,
    data: { name: 'Tio Jorge', guests: [{ name: 'Jorge Moreira' }] },
  });
  expect(refused.status()).toBe(409);
  expect(await refused.json()).toMatchObject({ error: 'WEDDING_DELETION_SCHEDULED' });
  await banner.getByRole('button', { name: 'Cancelar a exclusão' }).click();
  await expect(toast({ page, text: 'Exclusão cancelada. O site voltou ao ar.' })).toBeVisible();
  await expect(page.locator('.kore-lifecycle-banner')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Novo grupo' })).toBeEnabled();
});

test('Configurações › Casamento: a sessão antiga pede o Entrar; depois, o Excluir com o nome e o Cancelar (RN05; RN08)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  const email = newEmail({ label: `excluir-${unique()}` });
  const ownerId = await createUser({ db, email, name: 'Ana Souza' });
  const weddingId = await published({ ownerId });
  await signIn({ page, email });
  const me = (await (await page.request.get(`${API_URL}/v1/me`, { headers: APP })).json()) as {
    memberships: { weddingId: string; weddingName: string }[];
  };
  const couple = me.memberships.find((item) => item.weddingId === weddingId)?.weddingName ?? '';
  // A sessão de há 1 hora: o Excluir pede o login de novo (RN08).
  await db.query(
    `update sessions set authenticated_at = now() - interval '1 hour' where user_id = $1`,
    [ownerId],
  );
  await page.goto('/app/configuracoes/casamento');
  const remove = async () => {
    await page.getByRole('button', { name: 'Excluir o casamento' }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('textbox').fill(couple);
    await dialog.getByRole('button', { name: 'Excluir o casamento' }).click();
  };
  await remove();
  await expect(page).toHaveURL(/\/entrar\?next=/);
  await expect(
    page.getByText('Por segurança, entrem de novo para excluir o casamento.'),
  ).toBeVisible();
  // Entra de novo e volta à mesma tela; a ação não se repete sozinha.
  await page.getByRole('button', { name: 'Continuar com Google' }).click();
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/app\/configuracoes\/casamento$/);
  await remove();
  const banner = page.locator('.kore-lifecycle-banner');
  await expect(banner).toContainText(
    /^O casamento será apagado em \d+ de .+ O site está fora do ar\./,
  );
  const section = page.getByRole('region', { name: 'Excluir o casamento' });
  await expect(section.getByText(/^O casamento será apagado em \d+ de .+\.$/)).toBeVisible();
  // O Cancelar da própria seção.
  await section.getByRole('button', { name: 'Cancelar a exclusão' }).click();
  await expect(toast({ page, text: 'Exclusão cancelada. O site voltou ao ar.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Excluir o casamento' })).toBeEnabled();
});
