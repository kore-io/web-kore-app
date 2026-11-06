import { expect, test, type Browser, type Page } from '@playwright/test';
import { codeFrom, inviteLinkFrom, latestEmail, newEmail } from './mailpit';

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
 * A dona cria o casamento pelo cadastro e convida o parceiro; devolve o link do convite que
 * chegou ao Mailpit e o primeiro nome dela (quem convidou).
 */
async function weddingWithPartnerInvite({ browser }: { browser: Browser }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const unique = String(Date.now()).slice(-6);
  const ownerName = `Ana${unique}`;
  const ownerEmail = newEmail({ label: 'dona' });
  await page.goto('/cadastro');
  await page.getByRole('textbox', { name: 'E-⁠mail' }).fill(ownerEmail);
  await signInWithCode({
    page,
    email: ownerEmail,
    requestCode: () => page.getByRole('button', { name: 'Continuar', exact: true }).click(),
  });
  await page.getByRole('textbox', { name: 'Seu nome' }).fill(`${ownerName} Moreira`);
  await page
    .locator('label')
    .filter({ hasText: /^Noiva$/ })
    .click();
  await page.getByRole('textbox', { name: 'Com quem você vai casar?' }).fill('Marcos Rocha');
  await page.getByRole('textbox', { name: 'Cidade' }).fill('Campinas');
  await page.getByRole('combobox', { name: 'UF' }).selectOption('SP');
  await expect(page.getByRole('button', { name: 'Criar nosso site' })).toBeEnabled();
  await page.getByRole('button', { name: 'Criar nosso site' }).click();
  const partnerEmail = newEmail({ label: 'parceiro' });
  await page.getByRole('textbox', { name: 'E-⁠mail de Marcos' }).fill(partnerEmail);
  await page.getByRole('button', { name: 'Enviar convite' }).click();
  await expect(
    page.getByText(`Convite enviado para ${partnerEmail}.`, { exact: true }),
  ).toBeVisible();
  const link = inviteLinkFrom({
    email: await latestEmail({ request: page.request, to: partnerEmail }),
  });
  await context.close();
  return { link, ownerName, partnerEmail };
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
    browser,
    page,
  }) => {
    const { link, ownerName, partnerEmail } = await weddingWithPartnerInvite({ browser });
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
    // Com a decisão 178 na API, o dono aceito chega ao /app; antes dela, à Seleção de perfil.
    await expect(page).toHaveURL(/\/(app|perfis)$/);

    // O convite vale uma vez só (RN03): o mesmo link agora é Convite inválido.
    await page.goto(link);
    await expect(invalidHeading(page)).toBeVisible();
  });

  test('recusar sem entrar: avisa, vai ao Entrar, e o link deixa de valer (RN11; 172(6))', async ({
    browser,
    page,
  }) => {
    const { link } = await weddingWithPartnerInvite({ browser });
    await page.goto(link);
    await page.getByRole('button', { name: 'Recusar convite' }).click();
    await expect(page.getByText('Convite recusado.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/entrar$/);
    await page.goto(link);
    await expect(invalidHeading(page)).toBeVisible();
  });

  test('entrar com outro e-⁠mail: Outra conta, e o convite fica nesta conta (RN07)', async ({
    browser,
    page,
  }) => {
    const { link, partnerEmail } = await weddingWithPartnerInvite({ browser });
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
