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
 * Envios no expirado (E9 da F3; Data de saída do ar RN07; 314(3); decisões 331 e 332): na
 * carência, como no pós-evento (só leitura, com o motivo da 337(1)); no expirado, o Continuar e o Enviar convites do
 * Dashboard fecham com o texto da RN07; no sem renovação, o texto único com o Exportar os
 * convidados do casal. O estado vem do banco, com as datas relativas a current_date.
 */

const POST_EVENT =
  'O casamento já aconteceu. Não dá mais para enviar convites, save the date nem lembretes.';

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

test('a carência segue o pós-evento; o expirado fecha com o texto da RN07 (332; RN07)', async ({
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
  // O Enviar convites fecha com o motivo do pós-evento (337(1); 338).
  await expect(page.getByRole('button', { name: 'Enviar convites' })).toHaveAccessibleDescription(
    POST_EVENT,
  );
  await expect(page.getByRole('button', { name: 'Enviar convites' })).toBeDisabled();
  await page.goto('/app/envios/convites');
  // Como no pós-evento: só leitura, sem o "Publiquem o site" (a API recusa a fila na carência).
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  // O motivo do pós-evento, sem link (337(1)).
  await expect(page.getByRole('button', { name: 'Continuar' })).toHaveAccessibleDescription(
    POST_EVENT,
  );
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
  await expect(page.getByRole('button', { name: 'Continuar' })).toHaveAccessibleDescription(
    `${RENEW} Renovar`,
  );
  // O Renovar do casal leva a mudar a data (E11).
  await expect(
    page.locator('#kore-send-closed').getByRole('link', { name: 'Renovar' }),
  ).toHaveAttribute('href', '/app/cobranca/data-de-saida');
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
