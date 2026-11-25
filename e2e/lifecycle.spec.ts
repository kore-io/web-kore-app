import { expect, test, type Page } from '@playwright/test';
import { codeFrom, latestEmail, newEmail } from './mailpit';
import { signIn } from './support/app';
import {
  connectBackoffice,
  createPlanner,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

/*
 * O ciclo de vida na tela (E8 da F3; Data de saída do ar RN01 e RN06; 231 P1 e P2; 293; 314;
 * decisão 329): o selo da Topbar, a faixa e o cartão Status do Dashboard. O estado vem do
 * banco, com as datas relativas a current_date (sem relógio): a carência do casal, o caso B
 * da colaboradora e o sem renovação do casal, com o Exportar os convidados.
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

const statusCard = (page: Page) =>
  page
    .getByRole('heading', { name: 'Status do site', level: 2 })
    .locator('xpath=ancestor::section[1]');

test('a carência do casal: o selo, a faixa, o cartão Status e o subtítulo de Pagamentos (RN06)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const email = newEmail({ label: `ciclo-${unique()}` });
  const ownerId = await createUser({ db, email, name: 'Ana Souza' });
  const weddingId = await wedding({ ownerId, eventDaysAgo: 30 });
  // A data passou há 4 dias: o site fica no ar até daqui a 3 e expira daqui a 4.
  await db.query(
    `update weddings set status = 'grace', end_date = current_date - 4, paid_through = current_date - 4,
       grace_until = current_date + 3, publication_source = 'payment' where id = $1`,
    [weddingId],
  );
  await signIn({ page, email });
  await page.goto('/app');
  await expect(page.getByRole('banner').getByText('Vence em 4 dias')).toBeVisible();
  const banner = page.getByText(
    /^A data de saída do ar passou\. O site fica no ar só até \d+ de .+ Adiem a data para mantê-lo\.$/,
  );
  await expect(banner.first()).toBeVisible();
  await expect(statusCard(page).getByText('Vence em 4 dias')).toBeVisible();
  // Sem os botões de mudar a data até o E10 (329(1)).
  await expect(page.getByRole('button', { name: 'Adiar a data' })).toHaveCount(0);
  await page.goto('/app/cobranca');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Cobrança e publicação' }),
  ).toBeVisible();
  await expect(page.locator('main').getByText('Vence em 4 dias').first()).toBeVisible();
});

test('o caso B para a colaboradora: o texto dela, sem link (293(5); 296(2))', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const email = newEmail({ label: `ciclo-colab-${unique()}` });
  const userId = await createUser({ db, email, name: 'Juliana Prado' });
  const referrerId = await createPlanner({ db, userId, creditName: `Prado ${letters()}` });
  const ownerId = await createUser({
    db,
    email: newEmail({ label: `dono-${unique()}` }),
    name: 'Fernanda Lima',
  });
  const weddingId = await wedding({
    ownerId,
    collaboratorId: userId,
    referrerId,
    eventDaysAgo: 60,
  });
  // Antecipou e expirou com mês pago à frente.
  await db.query(
    `update weddings set status = 'expired', end_date = current_date - 20, paid_through = current_date + 10,
       grace_until = current_date - 13, expired_at = current_date - 12, publication_source = 'payment'
     where id = $1`,
    [weddingId],
  );
  await signInByCode({ page, email });
  await page.goto(`/cerimonialista/casamentos/${weddingId}`);
  await expect(page.getByRole('banner').getByText('Expirado')).toBeVisible();
  const text = page.getByText(
    /^O site está fora do ar desde \d+ de .+ Peça ao casal para voltar o site ao ar\.$/,
  );
  await expect(text.first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Voltar ao ar' })).toHaveCount(0);
});

test('sem renovação: o casal com o Exportar os convidados na faixa e no cartão (314)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const email = newEmail({ label: `ciclo-fim-${unique()}` });
  const ownerId = await createUser({ db, email, name: 'Ana Souza' });
  // O casamento foi há mais de 12 meses: não há data possível.
  const weddingId = await wedding({ ownerId, eventDaysAgo: 400 });
  await db.query(
    `update weddings set status = 'expired', end_date = current_date - 30, paid_through = current_date - 30,
       grace_until = current_date - 23, expired_at = current_date - 22, publication_source = 'payment'
     where id = $1`,
    [weddingId],
  );
  await signIn({ page, email });
  await page.goto('/app');
  await expect(
    page
      .getByText(
        /Ele chegou ao prazo máximo, 12 meses depois do casamento, e não pode mais ser renovado\. Vocês ainda podem exportar os convidados\.$/,
      )
      .first(),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Exportar os convidados' })).toHaveAttribute(
    'href',
    '/app/convidados/exportar',
  );
  await statusCard(page).getByRole('button', { name: 'Exportar os convidados' }).click();
  await expect(page).toHaveURL(/\/app\/convidados\/exportar$/);
  // Em 390, o selo sai da Topbar e fica no cartão; a faixa cabe sem rolagem horizontal.
  await page.goto('/app');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(statusCard(page).getByText('Expirado')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
