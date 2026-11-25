import { expect, test } from '@playwright/test';
import { signIn } from './support/app';
import {
  connectBackoffice,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

/*
 * Os avisos de cobrança na central do casal (E12 da F3; Publicar e pagar RN13; Data de saída
 * RN03; 241(4); 298(2); 336) e a linha Cobrança e pagamentos das preferências (236(3)(4)).
 * Os avisos entram pelo banco, como os grava a API (um item por aviso).
 */

let db: Db;
test.beforeAll(async () => {
  db = await connectBackoffice();
});
test.afterAll(async () => {
  await db.end();
});

test('a central com os avisos de cobrança, o filtro, os destinos e a linha das preferências', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const email = `e2e-central-cobranca-${unique()}@exemplo.kore.local`;
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
  const at = new Date().toISOString();
  const insert = async (payload: object, minutesAgo: number) =>
    db.query(
      `insert into notifications (id, user_id, wedding_id, type, group_key, count, payload, updated_at)
       values (gen_random_uuid(), $1, $2, 'billing', $3, 1, $4::jsonb, now() - $5::int * interval '1 minute')`,
      [userId, weddingId, `billing:${unique()}`, JSON.stringify([payload]), minutesAgo],
    );
  await insert(
    {
      kind: 'payment_confirmed',
      paymentId: '00000000-0000-0000-0000-000000000001',
      endDate: '2027-02-14',
      amountCents: 33710,
      method: 'card',
      installments: 2,
      cardLast4: '4821',
      at,
    },
    30,
  );
  await insert({ kind: 'end_date_soon', endDate: '2027-02-14', daysLeft: 1, at }, 20);
  await insert(
    {
      kind: 'expired',
      expiredAt: '2027-11-22',
      renewUntil: null,
      paidThrough: null,
      purgeAt: '2028-05-22',
      at,
    },
    10,
  );
  // Uma resposta, para o filtro ter o que tirar.
  await db.query(
    `insert into notifications (id, user_id, wedding_id, type, group_key, count, payload)
     values (gen_random_uuid(), $1, $2, 'rsvp', $3, 1, $4::jsonb)`,
    [
      userId,
      weddingId,
      `rsvp:${weddingId}`,
      JSON.stringify([
        { partyId: weddingId, name: 'Família Moreira', confirmed: 2, declined: 0, at },
      ]),
    ],
  );

  await signIn({ page, email });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/notificacoes');
  const confirmed = page.getByRole('button', {
    name: /^Pagamento confirmado\. O site está no ar até 14 de fev\. de 2027\s*, não lida/,
  });
  await expect(confirmed).toBeVisible();
  await expect(confirmed).toContainText(/R\$\s337,10 no cartão final 4821, 2x · hoje às/);
  await expect(
    page.getByRole('button', {
      name: /^O site fica no ar até amanhã, 14 de fev\. de 2027\. Adiem a data para mantê-lo/,
    }),
  ).toBeVisible();
  const final = page.getByRole('button', {
    name: /^O site saiu do ar e não pode mais ser renovado\. Exportem os convidados/,
  });
  await expect(final).toBeVisible();
  // A guarda dos dados no detalhe, pelo purgeAt (336(3)).
  await expect(final).toContainText(/Os dados ficam guardados até 22 de mai\. de 2028 · hoje às/);
  await expect(page.getByRole('button', { name: /Família Moreira respondeu/ })).toBeVisible();

  // O filtro Cobrança tira a resposta (241(4)).
  await page.getByRole('combobox', { name: 'Tipo' }).selectOption({ label: 'Cobrança' });
  await expect(page.getByRole('button', { name: /Família Moreira respondeu/ })).toHaveCount(0);
  await expect(page.getByRole('listitem')).toHaveCount(3);

  // Os destinos (336(1)): o sem renovação ao Exportar; o pagamento a Pagamentos.
  await final.click();
  await expect(page).toHaveURL(/\/app\/convidados\/exportar$/);
  await page.goto('/app/notificacoes');
  await page
    .getByRole('button', { name: /^Pagamento confirmado/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app\/cobranca$/);
  await expect
    .poll(async () => {
      const { rows } = await db.query<{ unread: number }>(
        `select count(*)::int as unread from notifications
         where user_id = $1 and wedding_id = $2 and type = 'billing' and read_at is null`,
        [userId, weddingId],
      );
      return rows[0]?.unread;
    })
    .toBe(1);

  // As preferências: a linha com o e-mail fixo e a legenda (236(3)(4)).
  await page.goto('/app/configuracoes/notificacoes');
  await expect(page.getByText('Cobrança e pagamentos')).toBeVisible();
  await expect(page.getByText('Sempre', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(1);
  await expect(
    page.getByText(/^Os avisos de pagamento, de saída do ar e de exclusão do casamento sempre/),
  ).toBeVisible();
});
