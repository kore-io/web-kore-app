import { expect, test, type Page } from '@playwright/test';
import { codeFrom, latestEmail, newEmail } from './mailpit';
import { toast } from './support/app';
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
 * A colaboradora dentro do casamento (D5a da F6; Colaboradora RN01 a RN07; Penpot 17): a
 * faixa e o Voltar a Meus casamentos, o seletor com dois casamentos, a URL de um casamento
 * alheio (volta a Meus casamentos), o casamento de que ela é dona (abre em /app) e a faixa
 * Aguardando o casal por e-mail, com o "Enviado em" no fuso do casamento (decisão 263(2)) e o
 * Reenviar convite.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

let db: Db;
test.beforeAll(async () => {
  db = await connectBackoffice();
});
test.afterAll(async () => {
  await db.end();
});

const letters = () => unique().replace(/\d/g, (digit) => 'abcdefghij'[Number(digit)] ?? '');

async function signIn({ page, email }: { page: Page; email: string }) {
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

/** A cerimonialista com o perfil e a assessoria. */
async function planner() {
  const email = newEmail({ label: `dentro-${unique()}` });
  const userId = await createUser({ db, email, name: 'Juliana Prado' });
  const referrerId = await createPlanner({ db, userId, creditName: `Prado ${letters()}` });
  return { email, userId, referrerId };
}

/** Um casamento em que ela colabora (criado por ela, aguardando o casal). */
async function collaboration({
  userId,
  referrerId,
  eventDate,
  timezone,
}: {
  userId: string;
  referrerId: string;
  eventDate: string;
  timezone?: string;
}) {
  const first = `Fernanda${letters()}`;
  const weddingId = await createWedding({
    db,
    partners: [first, 'João Lima'],
    eventDate,
    city: 'Vinhedo',
    status: 'awaiting_couple',
    createdByUserId: userId,
    collaboratorIds: [userId],
    referrerId,
    ...(timezone && { timezone }),
  });
  return { weddingId, couple: `${first} e João` };
}

const banner = (page: Page) => page.getByText('Você colabora neste casamento.');

test.describe('A colaboradora dentro do casamento (/cerimonialista/casamentos/{id})', () => {
  test('a faixa, o Voltar a Meus casamentos e o seletor com dois casamentos (RN02, RN06)', async ({
    page,
  }) => {
    const { email, userId, referrerId } = await planner();
    const first = await collaboration({ userId, referrerId, eventDate: '2027-01-30' });
    const second = await collaboration({ userId, referrerId, eventDate: '2027-03-13' });
    await signIn({ page, email });

    await page.goto(`/cerimonialista/casamentos/${first.weddingId}`);
    await expect(banner(page)).toBeVisible();
    await expect(
      page.getByText(
        'Você monta o site e cuida da lista. Publicar, pagar e a chave Pix são do casal.',
      ),
    ).toBeVisible();

    const switcher = page.getByRole('button', { name: 'Trocar de casamento' });
    await expect(switcher).toHaveAttribute('aria-expanded', 'false');
    await switcher.click();
    await expect(switcher).toHaveAttribute('aria-expanded', 'true');
    const current = page.getByRole('link', { name: new RegExp(`^${first.couple} · 30/01/2027`) });
    await expect(current).toHaveAttribute('aria-current', 'page');
    await expect(current).toContainText('Atual');
    await page.getByRole('searchbox', { name: 'Buscar casal' }).fill('Bianca');
    await expect(page.getByText('Nenhum casamento com esse nome.')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Buscar casal' }).fill(second.couple.slice(0, 12));
    await page.getByRole('link', { name: new RegExp(`^${second.couple} · 13/03/2027`) }).click();
    await expect(page).toHaveURL(new RegExp(`/cerimonialista/casamentos/${second.weddingId}$`));
    await expect(switcher).toContainText(second.couple.split(' ')[0] ?? '');

    await banner(page)
      .locator('xpath=ancestor::div[contains(@class, "kore-planner-wedding__banner")]')
      .getByRole('link', { name: 'Voltar a Meus casamentos' })
      .click();
    await expect(page).toHaveURL(/\/cerimonialista$/);
    await expect(page.getByRole('heading', { name: 'Meus casamentos' })).toBeVisible();
  });

  test('a URL de um casamento alheio volta a Meus casamentos com o aviso (RN07)', async ({
    page,
  }) => {
    const { email } = await planner();
    const other = await planner();
    const alien = await collaboration({
      userId: other.userId,
      referrerId: other.referrerId,
      eventDate: '2027-01-30',
    });
    await signIn({ page, email });

    await page.goto(`/cerimonialista/casamentos/${alien.weddingId}/convidados`);
    await expect(toast({ page, text: 'Este casamento não está mais disponível.' })).toBeVisible();
    await expect(page).toHaveURL(/\/cerimonialista$/);
    await expect(banner(page)).toBeHidden();
  });

  test('o casamento de que ela é dona abre em /app, com o perfil ativo de casal e sem a Seleção (RN01; decisão 268)', async ({
    page,
  }) => {
    const { email, userId } = await planner();
    const weddingId = await createWedding({
      db,
      partners: ['Juliana Prado', 'Rafael Prado'],
      eventDate: '2027-05-08',
      city: 'Campinas',
      status: 'draft',
      createdByUserId: userId,
      owners: [userId, null],
    });
    await signIn({ page, email });

    // Ao entrar, o perfil ativo é o de cerimonialista (ela tem os dois perfis).
    await page.goto(`/cerimonialista/casamentos/${weddingId}`);
    await expect(page).toHaveURL(/\/app$/);
    await expect(banner(page)).toBeHidden();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/app$/);
    const me = await page.request.get(`${API_URL}/v1/me`);
    expect(((await me.json()) as { activeProfile: string }).activeProfile).toBe('couple');
  });

  test('a faixa Aguardando o casal por e-mail: o envio no fuso do casamento e o Reenviar (RN04)', async ({
    page,
  }) => {
    const { email, userId, referrerId } = await planner();
    // 03h30 UTC de 20/09: ainda 19/09 em Manaus, o fuso do casamento (em SP já seria 20/09).
    const { weddingId } = await collaboration({
      userId,
      referrerId,
      eventDate: '2027-01-30',
      timezone: 'America/Manaus',
    });
    const coupleEmail = newEmail({ label: `casal-${unique()}` });
    await createInvitation({
      db,
      weddingId,
      kind: 'couple',
      email: coupleEmail,
      invitedByUserId: userId,
      createdAt: '2026-09-20T03:30:00Z',
    });
    await signIn({ page, email });

    await page.goto(`/cerimonialista/casamentos/${weddingId}`);
    await expect(page.getByText('Aguardando o casal aceitar o convite.')).toBeVisible();
    await expect(page.getByText(`Enviamos o convite para ${coupleEmail} em 19/09.`)).toBeVisible();

    const since = new Date(Date.now() - 1000);
    await page.getByRole('button', { name: 'Reenviar convite' }).click();
    await expect(toast({ page, text: `Convite reenviado para ${coupleEmail}.` })).toBeVisible();
    expect((await latestEmail({ request: page.request, to: coupleEmail, since })).HTML).toContain(
      '/convite/',
    );
    await expect(page.getByRole('button', { name: /^Convidar outro e/ })).toBeVisible();
  });
});
