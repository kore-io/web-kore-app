import { expect, test } from '@playwright/test';
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
 * Envios no expirado (E9 da F3; Data de saída do ar RN07; 314(3); decisões 330 e 331): na
 * carência os envios seguem abertos; no expirado, o Continuar e o Enviar convites do
 * Dashboard fecham com o texto da RN07; no sem renovação, o texto único com o Exportar os
 * convidados do casal. O estado vem do banco, com as datas relativas a current_date.
 */

let db: Db;
test.beforeAll(async () => {
  db = await connectBackoffice();
});
test.afterAll(async () => {
  await db.end();
});

const letters = () => unique().replace(/\d/g, (digit) => 'abcdefghij'[Number(digit)] ?? '');

/** O casamento publicado há tempo, depois levado ao estado pelo banco. */
async function wedding({
  ownerId,
  collaboratorId,
  referrerId,
  eventDaysAgo,
}: {
  ownerId: string;
  collaboratorId?: string;
  referrerId?: string;
  eventDaysAgo: number;
}) {
  const weddingId = await createWedding({
    db,
    partners: [`Ana${letters()}`, 'Marcos Lima'],
    eventDate: '2026-01-01',
    city: 'São Paulo',
    status: 'draft',
    createdByUserId: collaboratorId ?? ownerId,
    owners: [ownerId, null],
    ...(collaboratorId && { collaboratorIds: [collaboratorId] }),
    ...(referrerId && { referrerId }),
  });
  await db.query(
    `update weddings set event_date = current_date - $2::int, published_at = now() - interval '400 days'
     where id = $1`,
    [weddingId, eventDaysAgo],
  );
  return weddingId;
}

const RENEW = 'O site está fora do ar. Renovem o site para enviar.';
const FINAL =
  'O site está fora do ar e não pode mais ser renovado. Não dá para enviar convites, save the date nem lembretes.';

async function couple({ eventDaysAgo, state }: { eventDaysAgo: number; state: string }) {
  const email = newEmail({ label: `envios-exp-${unique()}` });
  const ownerId = await createUser({ db, email, name: 'Ana Souza' });
  const weddingId = await wedding({ ownerId, eventDaysAgo });
  await db.query(`update weddings set ${state}, publication_source = 'payment' where id = $1`, [
    weddingId,
  ]);
  return { email, weddingId };
}

test('a carência deixa os envios abertos; o expirado fecha com o texto da RN07 (330; RN07)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { email, weddingId } = await couple({
    eventDaysAgo: 30,
    state: `status = 'grace', end_date = current_date - 4, paid_through = current_date - 4,
      grace_until = current_date + 3`,
  });
  await signIn({ page, email });
  await page.goto('/app');
  await expect(page.getByRole('button', { name: 'Enviar convites' })).toBeEnabled();
  await page.goto('/app/envios/convites');
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
  await expect(page.getByText(/^Publiquem o site|^O site está fora do ar\./)).toHaveCount(0);

  await db.query(
    `update weddings set status = 'expired', grace_until = current_date - 1, expired_at = current_date
     where id = $1`,
    [weddingId],
  );
  await page.goto('/app');
  const send = page.getByRole('button', { name: 'Enviar convites' });
  await expect(send).toBeDisabled();
  await expect(send).toHaveAccessibleDescription(RENEW);
  await page.goto('/app/envios/convites');
  await expect(page.getByRole('button', { name: 'Continuar' })).toHaveAccessibleDescription(RENEW);
  await expect(page.getByRole('link', { name: 'Renovar' })).toHaveCount(0);
});

test('sem renovação: o texto único e o Exportar os convidados do casal nos Envios (314(3))', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { email } = await couple({
    eventDaysAgo: 400,
    state: `status = 'expired', end_date = current_date - 30, paid_through = current_date - 30,
      grace_until = current_date - 23, expired_at = current_date - 22`,
  });
  await signIn({ page, email });
  await page.goto('/app/envios/convites');
  await expect(page.getByRole('button', { name: 'Continuar' })).toHaveAccessibleDescription(
    new RegExp(`^${FINAL}`),
  );
  const notice = page.locator('#kore-send-closed');
  await notice.getByRole('link', { name: 'Exportar os convidados' }).click();
  await expect(page).toHaveURL(/\/app\/convidados\/exportar$/);
});
