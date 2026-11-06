import { expect, test, type Page } from '@playwright/test';
import { codeFrom, latestEmail, newEmail } from './mailpit';
import {
  connectBackoffice,
  createInvitation,
  createPlanner,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

/*
 * Os casos que o app sozinho não cria na F0 (o indicador e o convite do cerimonialista
 * nascem em outras fases): cada teste monta os próprios dados pela conexão do backoffice,
 * únicos por rodada, e roda quantas vezes for preciso.
 */

let db: Db;
test.beforeAll(async () => {
  db = await connectBackoffice();
});
test.afterAll(async () => {
  await db.end();
});

/** Entra pelo código do e-mail na tela Entrar (o e-mail que chegou depois do pedido). */
async function signInAt({ page, email }: { page: Page; email: string }) {
  await page.getByRole('textbox', { name: 'E-⁠mail' }).fill(email);
  const since = new Date(Date.now() - 1000);
  await page.getByRole('button', { name: 'Receber código' }).click();
  await expect(page.getByRole('heading', { name: 'Confira seu e-⁠mail' })).toBeVisible();
  const code = codeFrom({ email: await latestEmail({ request: page.request, to: email, since }) });
  await page.keyboard.type(code);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function expectCoupleArea({ page, couple }: { page: Page; couple: string }) {
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('banner').getByText(couple, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Menu do usuário' }).click();
  await expect(page.getByText(`Perfil ativo: Casal · ${couple}`, { exact: true })).toBeVisible();
}

test.describe('Convites dos indicadores e Seleção com dois perfis (dados do próprio teste)', () => {
  test('convite do casal pelo cerimonialista: Quem é você? e o Dashboard (RN09; 172(1), 173)', async ({
    page,
  }) => {
    const run = unique();
    const plannerId = await createUser({
      db,
      email: newEmail({ label: `cerimonial-${run}` }),
      name: 'Juliana Prado',
    });
    const creditName = `Prado Assessoria ${run}`;
    const referrerId = await createPlanner({ db, userId: plannerId, creditName });
    const weddingId = await createWedding({
      db,
      partners: ['Fernanda Alves', 'João Lima'],
      eventDate: '2027-01-30',
      city: 'Vinhedo',
      status: 'awaiting_couple',
      createdByUserId: plannerId,
      collaboratorIds: [plannerId],
      referrerId,
    });
    const coupleEmail = newEmail({ label: `fernanda-${run}` });
    const token = await createInvitation({
      db,
      weddingId,
      kind: 'couple',
      email: coupleEmail,
      invitedByUserId: plannerId,
    });

    await page.goto(`/convite/${token}`);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: `${creditName} preparou o site do casamento de vocês`,
      }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Aceitar e virar dono' }).click();
    await expect(page).toHaveURL(/\/entrar$/);
    await signInAt({ page, email: coupleEmail });

    // De volta ao convite (decisão 142): o Quem é você? antes de gravar o aceite.
    await expect(page.getByRole('heading', { level: 1, name: 'Quem é você?' })).toBeVisible();
    // O primeiro nome de cada noivo (decisão 182).
    await page
      .locator('label')
      .filter({ hasText: /^Fernanda$/ })
      .click();
    await page
      .locator('label')
      .filter({ hasText: /^Noiva$/ })
      .click();
    const accept = page.waitForResponse((response) => response.url().endsWith('/accept'));
    await page.getByRole('button', { name: 'Continuar' }).click();
    expect((await accept).status()).toBe(200);
    await expectCoupleArea({ page, couple: 'Fernanda & João' });
  });

  test('convite do cerimonialista pelo casal: Seu nome e o perfil de cerimonialista (RN10; 168(4), 176(1))', async ({
    page,
  }) => {
    const run = unique();
    const ownerId = await createUser({
      db,
      email: newEmail({ label: `bianca-${run}` }),
      name: 'Bianca Lopes',
    });
    const weddingId = await createWedding({
      db,
      partners: ['Bianca Lopes', 'Henrique Matos'],
      eventDate: '2026-11-28',
      city: 'Vinhedo',
      status: 'draft',
      createdByUserId: ownerId,
      owners: [ownerId, null],
    });
    const plannerEmail = newEmail({ label: `clara-${run}` });
    const token = await createInvitation({
      db,
      weddingId,
      kind: 'planner',
      email: plannerEmail,
      invitedByUserId: ownerId,
    });
    // Na F0, o perfil de cerimonialista vai ao destino do Fazer parceria (176(1)): o site
    // de fora não é aberto de verdade no teste.
    await page.route('https://kore.com.br/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Fazer parceria</p>' }),
    );

    await page.goto(`/convite/${token}`);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Bianca e Henrique convidaram você como cerimonialista',
      }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Aceitar convite' }).click();
    await expect(page).toHaveURL(/\/entrar$/);
    await signInAt({ page, email: plannerEmail });

    // Conta nova, sem nome: o aceite pede o Seu nome (168(4)).
    const name = page.getByRole('textbox', { name: 'Seu nome' });
    await expect(name).toBeVisible();
    await name.fill('Clara Dias');
    const accept = page.waitForResponse((response) => response.url().endsWith('/accept'));
    await page.getByRole('button', { name: 'Aceitar convite' }).click();
    expect((await accept).status()).toBe(200);
    // O aceite cria o perfil mínimo de cerimonialista (RN10): um perfil só, entra direto.
    await expect(page).toHaveURL('https://kore.com.br/cerimonialistas');
  });

  test('conta com dois perfis: os dois cartões e o último usado (RN14, RN16; 174(7), 177(1))', async ({
    page,
  }) => {
    const run = unique();
    const email = newEmail({ label: `juliana-${run}` });
    const userId = await createUser({ db, email, name: 'Juliana Prado' });
    const creditName = `Prado Assessoria ${run}`;
    await createPlanner({ db, userId, creditName });
    await createWedding({
      db,
      partners: ['Juliana Prado', 'Tiago Mendes'],
      eventDate: '2027-03-20',
      city: 'Valinhos',
      status: 'draft',
      createdByUserId: userId,
      owners: [userId, null],
    });

    await page.goto('/entrar');
    await signInAt({ page, email });
    await expect(page).toHaveURL(/\/perfis$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Com qual perfil você quer entrar?' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: `Cerimonialista ${creditName} · Nenhum casamento ainda` }),
    ).toBeVisible();
    const coupleCard = page.getByRole('button', {
      name: 'Casamento Juliana & Tiago sáb., 20 de mar. de 2027 · Valinhos (SP)',
    });
    await coupleCard.click();
    await expectCoupleArea({ page, couple: 'Juliana & Tiago' });

    // O último perfil usado neste aparelho fica em destaque (177(1), cookie da API).
    await page.goto('/perfis');
    await expect(
      page.getByRole('button', { name: /^Casamento Juliana & Tiago .* Último usado$/ }),
    ).toBeVisible();
  });
});
