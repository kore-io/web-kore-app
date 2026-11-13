import { expect, test } from '@playwright/test';
import { signIn, toast } from './support/app';
import {
  connectBackoffice,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
const APP = { origin: 'http://localhost:5173' };

let db: Db;

test.beforeAll(async () => {
  db = await connectBackoffice();
});

test.afterAll(async () => {
  await db.end();
});

test.describe('Central de notificações e preferências (RN04 a RN07)', () => {
  test('o sino, a central, abrir marca como lida, Marcar todas e o e-mail nas preferências', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const email = `e2e-central-${unique()}@exemplo.kore.local`;
    const userId = await createUser({ db, email, name: 'Ana Beatriz Moreira' });
    const weddingId = await createWedding({
      db,
      partners: ['Ana Beatriz Moreira', 'Marcos Vinícius Rocha'],
      eventDate: '2027-05-15',
      city: 'Campinas',
      status: 'draft',
      createdByUserId: userId,
      owners: [userId, null],
    });
    await signIn({ page, email });
    const party = (await (
      await page.request.post(`${API_URL}/v1/weddings/${weddingId}/parties`, {
        headers: APP,
        data: { name: 'Família Moreira', guests: [{ name: 'Célia Moreira' }] },
      })
    ).json()) as { id: string };
    // Duas notificações não lidas, como as da notify_rsvp (RN02, RN04).
    const entry = (partyId: string, name: string) => ({
      partyId,
      name,
      confirmed: 2,
      declined: 1,
      at: new Date().toISOString(),
    });
    const insert = async (payload: object[], count: number, groupKey: string) =>
      (
        await db.query<{ id: string }>(
          `insert into notifications (id, user_id, wedding_id, type, group_key, count, payload)
           values (gen_random_uuid(), $1, $2, 'rsvp', $3, $4, $5::jsonb) returning id`,
          [userId, weddingId, groupKey, count, JSON.stringify(payload)],
        )
      ).rows[0]?.id;
    const single = await insert([entry(party.id, 'Família Moreira')], 1, `rsvp:${weddingId}:a`);
    await insert(
      [entry(party.id, 'Família Moreira'), entry(party.id, 'Família Duarte')],
      2,
      `rsvp:${weddingId}:b`,
    );

    // O sino com o contador leva à central (RN06).
    await page.goto('/app');
    await page.getByRole('button', { name: 'Notificações, 2 não lidas' }).click();
    await expect(page).toHaveURL(/\/app\/notificacoes$/);
    await expect(
      page.getByRole('button', { name: /Família Moreira respondeu o convite/ }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /2 grupos responderam/ })).toBeVisible();

    // Abrir a de 1 grupo leva ao Painel e marca como lida (RN05).
    await page.getByRole('button', { name: /Família Moreira respondeu o convite/ }).click();
    await expect(page).toHaveURL(new RegExp(`/app/convidados/grupos/${party.id}$`));
    await expect
      .poll(async () => {
        const { rows } = await db.query<{ read_at: Date | null }>(
          'select read_at from notifications where id = $1',
          [single],
        );
        return rows[0]?.read_at !== null;
      })
      .toBe(true);

    // Marcar todas como lidas (RN06).
    await page.goto('/app/notificacoes');
    await page.getByRole('button', { name: 'Marcar todas como lidas' }).click();
    await expect(
      toast({ page, text: 'Todas as notificações foram marcadas como lidas.' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Notificações', exact: true })).toBeVisible();

    // Preferências pelo menu do usuário (RN07; decisão 221).
    await page.getByRole('button', { name: 'Menu do usuário' }).click();
    // No celular, o menu do usuário é uma folha (diálogo) com botões.
    await page.getByRole('dialog').getByRole('button', { name: 'Configurações' }).click();
    await expect(page).toHaveURL(/\/app\/configuracoes\/notificacoes$/);
    const emailSelect = page.getByRole('combobox', { name: /^E.?-.?mail$/u });
    await expect(emailSelect).toHaveValue('daily');
    await emailSelect.selectOption('immediate');
    await expect(toast({ page, text: 'Preferências salvas.' })).toBeVisible();
    await expect
      .poll(async () => {
        const { rows } = await db.query<{ email: string }>(
          `select email from notification_preferences where user_id = $1 and wedding_id = $2 and type = 'rsvp'`,
          [userId, weddingId],
        );
        return rows[0]?.email;
      })
      .toBe('immediate');
  });
});
