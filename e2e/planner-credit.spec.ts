import { expect, test, type Page } from '@playwright/test';
import { SITE_ORIGIN } from '../playwright.config';
import { codeFrom, latestEmail, newEmail } from './mailpit';
import { signIn as signInCouple, toast } from './support/app';
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
 * Assinatura da assessoria (D10 da F6; Assinatura do cerimonialista no site RN01 a RN06):
 * o dono vê o Switch nos Dados básicos e a assinatura na prévia; desliga, salva e ela some.
 * A colaboradora vê o Switch desabilitado. O convite do casal mostra a linha na prévia.
 */

let db: Db;
test.beforeAll(async () => {
  db = await connectBackoffice();
});
test.afterAll(async () => {
  await db.end();
});

const letters = () => unique().replace(/\d/g, (digit) => 'abcdefghij'[Number(digit)] ?? '');

async function signInPlanner({ page, email }: { page: Page; email: string }) {
  await page.goto('/entrar');
  await page.getByRole('textbox', { name: 'E-⁠mail' }).fill(email);
  const since = new Date(Date.now() - 1000);
  await page.getByRole('button', { name: 'Receber código' }).click();
  await expect(page.getByRole('heading', { name: 'Confira seu e-⁠mail' })).toBeVisible();
  const code = codeFrom({ email: await latestEmail({ request: page.request, to: email, since }) });
  await page.keyboard.type(code);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
  await page.waitForLoadState('networkidle');
}

async function setup({ owned = true }: { owned?: boolean } = {}) {
  const plannerEmail = newEmail({ label: `assinatura-${unique()}` });
  const plannerId = await createUser({ db, email: plannerEmail, name: 'Juliana Prado' });
  const organization = `Prado ${letters()}`;
  const referrerId = await createPlanner({ db, userId: plannerId, creditName: organization });
  const ownerEmail = `e2e-assinatura-${unique()}@exemplo.kore.local`;
  const ownerId = await createUser({ db, email: ownerEmail, name: 'Ana Beatriz Moreira' });
  const weddingId = await createWedding({
    db,
    partners: ['Ana Beatriz Moreira', 'Marcos Vinícius Rocha'],
    eventDate: '2027-05-15',
    city: 'Campinas',
    status: 'draft',
    createdByUserId: plannerId,
    owners: [owned ? ownerId : null, null],
    collaboratorIds: [plannerId],
    referrerId,
  });
  return { plannerEmail, plannerId, organization, ownerEmail, weddingId, referrerId };
}

async function openPreview(page: Page) {
  const [tab] = await Promise.all([
    page.context().waitForEvent('page'),
    page.getByRole('button', { name: 'Pré-visualizar' }).click(),
  ]);
  await expect(tab.getByText('Prévia. O site ainda não foi publicado.')).toBeVisible();
  return tab;
}

test('o dono vê a assinatura na prévia, desliga, salva e ela some (RN01, RN04, RN05)', async ({
  page,
}) => {
  const { ownerEmail, organization } = await setup();
  await signInCouple({ page, email: ownerEmail });
  await page.goto('/app/site/dados-basicos');
  const toggle = page.getByRole('switch', {
    name: 'Mostrar a assinatura da assessoria no rodapé',
  });
  await expect(toggle).toBeChecked();
  await expect(
    page.getByText(`Aparece no rodapé do site como "Assessoria: ${organization}".`),
  ).toBeVisible();

  const before = await openPreview(page);
  await expect(
    before.getByRole('contentinfo').getByText(`Assessoria: ${organization}`),
  ).toBeVisible();
  await before.close();

  await toggle.locator('..').click();
  await expect(toggle).not.toBeChecked();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(toast({ page, text: 'Alterações salvas.' })).toBeVisible();

  const after = await openPreview(page);
  await expect(after.getByRole('contentinfo').getByText('Feito com Kore')).toBeVisible();
  await expect(after.getByRole('contentinfo').getByText(/^Assessoria:/)).toHaveCount(0);
  expect(after.url().startsWith(SITE_ORIGIN)).toBe(true);
});

test('a colaboradora vê o Switch desabilitado; o convite do casal mostra a assinatura na prévia (RN04, RN05)', async ({
  page,
  browser,
}) => {
  // Um rascunho ainda sem dono, como o que ela cria no Novo casamento.
  const { plannerEmail, plannerId, organization, weddingId } = await setup({ owned: false });
  await signInPlanner({ page, email: plannerEmail });
  await page.goto(`/cerimonialista/casamentos/${weddingId}/site/dados-basicos`);
  const toggle = page.getByRole('switch', {
    name: 'Mostrar a assinatura da assessoria no rodapé',
  });
  await expect(toggle).toBeDisabled();
  await expect(page.getByText('Só o casal pode mostrar ou ocultar a assinatura.')).toBeVisible();

  // O convite do casal (a outra pessoa), aberto sem sessão.
  const token = await createInvitation({
    db,
    weddingId,
    kind: 'couple',
    email: null,
    invitedByUserId: plannerId,
  });
  const outsider = await browser.newContext();
  const invite = await outsider.newPage();
  await invite.goto(`/convite/${token}`);
  await expect(invite.getByText(`Assessoria: ${organization}`)).toBeVisible();
  await outsider.close();
});
