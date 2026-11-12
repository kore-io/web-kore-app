import { expect, test, type Page } from '@playwright/test';
import { codeFrom, latestEmail, newEmail } from './mailpit';
import {
  connectBackoffice,
  createInvitation,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

let db: Db;
test.beforeAll(async () => {
  db = await connectBackoffice();
});
test.afterAll(async () => {
  await db.end();
});

/** Pede o código (o clique que manda o e-mail) e entra com o código que chegou depois. */
async function signInWithCode({
  page,
  email,
  requestCode,
}: {
  page: Page;
  email: string;
  requestCode: () => Promise<void>;
}) {
  // O Mailpit marca o horário em segundos inteiros: um segundo de folga.
  const since = new Date(Date.now() - 1000);
  await requestCode();
  await expect(page.getByRole('heading', { name: 'Confira seu e-⁠mail' })).toBeVisible();
  const code = codeFrom({ email: await latestEmail({ request: page.request, to: email, since }) });
  await page.keyboard.type(code);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/**
 * A dona e o casamento, com o convite do parceiro já enviado, montados pela conexão do
 * backoffice (o envio pela tela é coberto no cadastro do login.spec): devolve o link do
 * convite, o primeiro nome de quem convidou e o e-mail do parceiro.
 */
async function weddingWithPartnerInvite() {
  const run = unique();
  const ownerName = `Ana${run}`;
  const ownerId = await createUser({
    db,
    email: newEmail({ label: `dona-${run}` }),
    name: `${ownerName} Moreira`,
  });
  const weddingId = await createWedding({
    db,
    partners: [`${ownerName} Moreira`, 'Marcos Rocha'],
    eventDate: '2026-11-14',
    city: 'Campinas',
    status: 'draft',
    createdByUserId: ownerId,
    owners: [ownerId, null],
  });
  const partnerEmail = newEmail({ label: `parceiro-${run}` });
  const token = await createInvitation({
    db,
    weddingId,
    kind: 'partner',
    email: partnerEmail,
    invitedByUserId: ownerId,
  });
  return { link: `/convite/${token}`, ownerName, partnerEmail };
}

/**
 * No cadastro só a dona informa o próprio título: o do noivo livre fica nulo, e o aceite
 * pergunta "Você é o noivo ou a noiva?" antes de gravar (172(2), 174(5)).
 */
async function answerTitle({ page }: { page: Page }) {
  await expect(
    page.getByRole('heading', { level: 1, name: 'Você é o noivo ou a noiva?' }),
  ).toBeVisible();
  await page
    .locator('label')
    .filter({ hasText: /^Noivo$/ })
    .click();
  await page.getByRole('button', { name: 'Continuar' }).click();
}

const invalidHeading = (page: Page) =>
  page.getByRole('heading', { level: 1, name: 'Este convite não vale mais' });

const acceptResponse = (page: Page) =>
  page.waitForResponse((response) => response.url().endsWith('/accept'));

test.describe('Convite do parceiro (Convites de acesso)', () => {
  test('sem conta: vê o casamento, entra pelo código na própria tela e aceita (RN06, RN08)', async ({
    page,
  }) => {
    const { link, ownerName, partnerEmail } = await weddingWithPartnerInvite();
    await page.goto(link);
    await expect(
      page.getByRole('heading', { level: 1, name: `${ownerName} convidou você para o casamento` }),
    ).toBeVisible();
    await expect(page.getByText(`${ownerName} & Marcos`)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'E-⁠mail' })).toHaveValue(partnerEmail);
    const accept = acceptResponse(page);
    await signInWithCode({
      page,
      email: partnerEmail,
      requestCode: () => page.getByRole('button', { name: 'Aceitar convite' }).click(),
    });
    await answerTitle({ page });
    expect((await accept).status()).toBe(200);
    // Decisão 178: o dono aceito já está no perfil de casal e chega ao Dashboard.
    await expect(page).toHaveURL(/\/app$/);
    await page.getByRole('button', { name: 'Menu do usuário' }).click();
    await expect(
      page.getByText(`Perfil ativo: Casal · ${ownerName} & Marcos`, { exact: true }),
    ).toBeVisible();

    // O convite vale uma vez só (RN03): o mesmo link agora é Convite inválido.
    await page.goto(link);
    await expect(invalidHeading(page)).toBeVisible();
  });

  test('recusar sem entrar: avisa, vai ao Entrar, e o link deixa de valer (RN11; 172(6))', async ({
    page,
  }) => {
    const { link } = await weddingWithPartnerInvite();
    await page.goto(link);
    await page.getByRole('button', { name: 'Recusar convite' }).click();
    await expect(page.getByText('Convite recusado.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/entrar$/);
    await page.goto(link);
    await expect(invalidHeading(page)).toBeVisible();
  });

  test('entrar com outro e-⁠mail: Outra conta, e o convite fica nesta conta (RN07)', async ({
    page,
  }) => {
    const { link, partnerEmail } = await weddingWithPartnerInvite();
    const otherEmail = newEmail({ label: 'outra' });
    await page.goto(link);
    await page.getByRole('textbox', { name: 'E-⁠mail' }).fill(otherEmail);
    await signInWithCode({
      page,
      email: otherEmail,
      requestCode: () => page.getByRole('button', { name: 'Aceitar convite' }).click(),
    });
    await expect(
      page.getByText(
        `O convite foi enviado para ${partnerEmail}, mas você entrou como ${otherEmail}.`,
      ),
    ).toBeVisible();
    const accept = acceptResponse(page);
    await page.getByRole('button', { name: `Sim, usar ${otherEmail}` }).click();
    await answerTitle({ page });
    expect((await accept).status()).toBe(200);
  });
});
