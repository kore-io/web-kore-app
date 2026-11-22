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
 * O Detalhe do casamento (D4b da F6; Meus casamentos RN08 a RN11; decisão 260): o convite
 * por e-mail (Reenviar e Convidar outro e-mail, com o e-mail no Mailpit), o link do casal
 * gerado pela API (Copiar e Cancelar), o Excluir e o casamento com dono (Editar o site).
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
const APP_ORIGIN = 'http://localhost:5173';

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
  await expect(page).toHaveURL(/\/cerimonialista$/);
}

/** A cerimonialista e um casamento que ela criou, aguardando o casal. */
async function plannerWithWedding({ status }: { status: 'draft' | 'awaiting_couple' }) {
  const email = newEmail({ label: `detalhe-${unique()}` });
  const userId = await createUser({ db, email, name: 'Juliana Prado' });
  const referrerId = await createPlanner({ db, userId, creditName: `Prado ${letters()}` });
  const first = `Fernanda${letters()}`;
  const weddingId = await createWedding({
    db,
    partners: [first, 'João Lima'],
    eventDate: '2027-01-30',
    city: 'Vinhedo',
    status,
    createdByUserId: userId,
    collaboratorIds: [userId],
    referrerId,
  });
  return { email, userId, weddingId, couple: `${first} e João` };
}

test.describe('Detalhe do casamento (/cerimonialista?casamento={id})', () => {
  test('o convite por e-mail: Reenviar, Convidar outro e-mail e Excluir (RN08, RN09, RN11)', async ({
    page,
  }) => {
    const { email, userId, weddingId, couple } = await plannerWithWedding({
      status: 'awaiting_couple',
    });
    const coupleEmail = newEmail({ label: `casal-${unique()}` });
    await createInvitation({
      db,
      weddingId,
      kind: 'couple',
      email: coupleEmail,
      invitedByUserId: userId,
    });
    await signIn({ page, email });

    await page.getByRole('link', { name: new RegExp(`^${couple}`) }).click();
    const detail = page.getByRole('dialog', { name: couple });
    await expect(detail.getByText('O casal ainda não aceitou o convite.')).toBeVisible();
    await expect(detail.getByText(`para ${coupleEmail}.`, { exact: false })).toHaveText(
      /^Convite enviado em \d{2}\/\d{2} para /,
    );

    const since = new Date(Date.now() - 1000);
    await detail.getByRole('button', { name: 'Reenviar convite' }).click();
    await expect(toast({ page, text: `Convite reenviado para ${coupleEmail}.` })).toBeVisible();
    expect((await latestEmail({ request: page.request, to: coupleEmail, since })).HTML).toContain(
      '/convite/',
    );

    const another = newEmail({ label: `outro-${unique()}` });
    await detail.getByRole('button', { name: /^Convidar outro e/ }).click();
    const invite = page.getByRole('dialog', { name: /^Convidar outro e/ });
    await invite.getByRole('textbox').fill(another);
    await invite.getByRole('button', { name: 'Enviar convite' }).click();
    await expect(toast({ page, text: `Convite enviado para ${another}.` })).toBeVisible();
    await latestEmail({ request: page.request, to: another });

    await detail.getByRole('button', { name: 'Excluir este casamento' }).click();
    await page
      .getByRole('alertdialog', { name: `Excluir o casamento de ${couple}?` })
      .getByRole('button', { name: 'Excluir casamento' })
      .click();
    await expect(toast({ page, text: `Casamento de ${couple} excluído.` })).toBeVisible();
    await expect(page.getByText('Você ainda não tem casamentos.')).toBeVisible();
  });

  test('o link do casal: o mesmo link, Copiar e Cancelar link (RN09)', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const { email, weddingId, couple } = await plannerWithWedding({ status: 'draft' });
    await signIn({ page, email });
    // Gera o link pela API, como o passo 3 do Novo casamento (D6) faz.
    const generated = await page.request.post(
      `${API_URL}/v1/weddings/${weddingId}/access-invitations`,
      { data: { kind: 'couple' }, headers: { origin: APP_ORIGIN } },
    );
    expect(generated.ok()).toBe(true);
    const { invitations } = (await generated.json()) as { invitations: { url?: string }[] };
    const url = invitations[0]?.url ?? '';
    expect(url).toContain('/convite/');

    await page.goto(`/cerimonialista?casamento=${weddingId}`);
    const detail = page.getByRole('dialog', { name: couple });
    await expect(detail.getByRole('textbox', { name: 'Link para o casal' })).toHaveValue(
      url.replace(/^https?:\/\//, ''),
    );
    await detail.getByRole('button', { name: 'Copiar link' }).click();
    await expect(toast({ page, text: 'Link copiado.' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);

    await detail.getByRole('button', { name: 'Cancelar link' }).click();
    await page
      .getByRole('alertdialog', { name: 'Cancelar o link do casal?' })
      .getByRole('button', { name: 'Cancelar link' })
      .click();
    await expect(toast({ page, text: 'Link cancelado.' })).toBeVisible();
    await expect(detail.getByRole('textbox', { name: 'Link para o casal' })).toHaveCount(0);
  });

  test('com dono: Editar o site abre o casamento dela; o Fechar volta à lista (RN08)', async ({
    page,
  }) => {
    const email = newEmail({ label: `colab-${unique()}` });
    const userId = await createUser({ db, email, name: 'Juliana Prado' });
    await createPlanner({ db, userId, creditName: `Prado ${letters()}` });
    const ownerId = await createUser({
      db,
      email: newEmail({ label: `dona-${unique()}` }),
      name: 'Ana Souza',
    });
    const first = `Ana${letters()}`;
    const weddingId = await createWedding({
      db,
      partners: [first, 'Marcos Lima'],
      eventDate: '2027-05-15',
      city: 'Campinas',
      status: 'draft',
      createdByUserId: ownerId,
      owners: [ownerId, null],
      collaboratorIds: [userId],
    });
    const couple = `${first} e Marcos`;
    await signIn({ page, email });
    await page.getByRole('link', { name: new RegExp(`^${couple}`) }).click();
    const detail = page.getByRole('dialog', { name: couple });
    await expect(detail.getByText('Convite do casal')).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Excluir este casamento' })).toHaveCount(0);
    await detail.getByRole('button', { name: 'Fechar' }).click();
    await expect(page).toHaveURL(/\/cerimonialista$/);
    await page.getByRole('link', { name: new RegExp(`^${couple}`) }).click();
    await page
      .getByRole('dialog', { name: couple })
      .getByRole('button', { name: 'Editar o site' })
      .click();
    await expect(page).toHaveURL(new RegExp(`/cerimonialista/casamentos/${weddingId}/site/`));
  });
  test('Sair deste casamento: o próprio vínculo pelo myMembershipId e o Toast (RN10; decisão 261)', async ({
    page,
  }) => {
    const email = newEmail({ label: `sair-${unique()}` });
    const userId = await createUser({ db, email, name: 'Juliana Prado' });
    await createPlanner({ db, userId, creditName: `Prado ${letters()}` });
    const ownerId = await createUser({
      db,
      email: newEmail({ label: `dono-${unique()}` }),
      name: 'Bruna Lima',
    });
    const first = `Bruna${letters()}`;
    await createWedding({
      db,
      partners: [first, 'Thiago Reis'],
      eventDate: '2027-06-12',
      city: 'Campinas',
      status: 'draft',
      createdByUserId: ownerId,
      owners: [ownerId, null],
      collaboratorIds: [userId],
    });
    const couple = `${first} e Thiago`;
    await signIn({ page, email });
    await page.getByRole('link', { name: new RegExp(`^${couple}`) }).click();
    await page
      .getByRole('dialog', { name: couple })
      .getByRole('button', { name: 'Sair deste casamento' })
      .click();
    await page
      .getByRole('alertdialog', { name: `Sair de ${couple}?` })
      .getByRole('button', { name: 'Sair do casamento' })
      .click();
    await expect(toast({ page, text: `Você saiu do casamento de ${couple}.` })).toBeVisible();
    await expect(page.getByText('Você ainda não tem casamentos.')).toBeVisible();
  });
});
