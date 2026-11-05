import { expect, test, type Page } from '@playwright/test';
import { codeFrom, confirmLinkFrom, latestEmail, newEmail } from './mailpit';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

async function askCode({ page, email }: { page: Page; email: string }) {
  await page.goto('/entrar');
  await page.getByRole('textbox', { name: 'E-\u2060mail' }).fill(email);
  await page.getByRole('button', { name: 'Receber código' }).click();
  await expect(page.getByRole('heading', { name: 'Confira seu e-\u2060mail' })).toBeVisible();
}

async function expectSignedIn({ page, email }: { page: Page; email: string }) {
  // A sessão é o cookie da API: o GET /v1/me com os cookies do navegador responde 200.
  const me = await page.request.get(`${API_URL}/v1/me`);
  expect(me.status()).toBe(200);
  const body = (await me.json()) as { user: { id: string; email: string } };
  expect(body.user.email).toBe(email);
  return body.user.id;
}

async function signInWithGoogle({ page, email }: { page: Page; email: string }) {
  await page.goto('/entrar');
  await page.getByRole('button', { name: 'Continuar com Google' }).click();
  // Formulário mínimo do provedor dev da API (não é tela do produto; HTML da API, sem o
  // i18n do app, então o rótulo tem o hífen comum).
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/perfis$/);
}

test.describe('Login sem senha (Login sem senha e sessão)', () => {
  test('entra com o código do e-mail; conta nova sem origem vai à Seleção de perfil (RN06)', async ({
    page,
  }) => {
    const email = newEmail({ label: 'codigo' });
    await askCode({ page, email });
    const code = codeFrom({ email: await latestEmail({ request: page.request, to: email }) });
    await page.keyboard.type(code);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/perfis$/);
    await expectSignedIn({ page, email });
  });

  test('código errado mostra as tentativas que restam (RN05)', async ({ page }) => {
    const email = newEmail({ label: 'errado' });
    await askCode({ page, email });
    const code = codeFrom({ email: await latestEmail({ request: page.request, to: email }) });
    await page.keyboard.type(code === '000000' ? '111111' : '000000');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Esse código não confere')).toBeVisible();
    await expect(page.getByText(/Você ainda tem 4 tentativas/)).toBeVisible();
  });

  test('pedir de novo antes de 60 s segue no código com a contagem (RN04)', async ({ page }) => {
    const email = newEmail({ label: 'cedo' });
    await askCode({ page, email });
    await page.getByRole('button', { name: 'Usar outro e-\u2060mail' }).click();
    await page.getByRole('textbox', { name: 'E-\u2060mail' }).fill(email);
    await page.getByRole('button', { name: 'Receber código' }).click();
    await expect(page.getByRole('heading', { name: 'Confira seu e-\u2060mail' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reenviar código em \d:\d\d/ })).toBeDisabled();
  });

  test('o botão do e-mail entra sem digitar o código (decisão 139)', async ({ page }) => {
    const email = newEmail({ label: 'botao' });
    await askCode({ page, email });
    const link = confirmLinkFrom({
      email: await latestEmail({ request: page.request, to: email }),
    });
    await page.goto(link);
    await expect(page).toHaveURL(/\/perfis$/);
    await expectSignedIn({ page, email });
  });

  test('o mesmo link do e-mail, já usado, volta ao Entrar com o aviso (RN02)', async ({ page }) => {
    const email = newEmail({ label: 'usado' });
    await askCode({ page, email });
    const link = confirmLinkFrom({
      email: await latestEmail({ request: page.request, to: email }),
    });
    await page.goto(link);
    await expect(page).toHaveURL(/\/perfis$/);
    await page.goto(link);
    await expect(page).toHaveURL(/\/entrar$/);
    await expect(page.getByText('Esse código não vale mais')).toBeVisible();
  });

  test('entra pelo Google (provedor de desenvolvimento, decisão 147)', async ({ page }) => {
    const email = newEmail({ label: 'google' });
    await signInWithGoogle({ page, email });
    await expectSignedIn({ page, email });
  });

  test('o Google liga à conta que já existe com o mesmo e-mail (RN07)', async ({ page }) => {
    // Dado uma conta criada pelo código do e-mail
    const email = newEmail({ label: 'ligacao' });
    await askCode({ page, email });
    const code = codeFrom({ email: await latestEmail({ request: page.request, to: email }) });
    await page.keyboard.type(code);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/perfis$/);
    const userId = await expectSignedIn({ page, email });
    // Quando a pessoa sai (a escrita leva a origem do app, como no navegador)
    const logout = await page.request.post(`${API_URL}/v1/auth/logout`, {
      headers: { origin: 'http://localhost:5173' },
    });
    expect(logout.status()).toBe(204);
    expect((await page.request.get(`${API_URL}/v1/me`)).status()).toBe(401);
    // E entra pelo Google com o mesmo e-mail
    await signInWithGoogle({ page, email });
    // Então é a mesma conta
    expect(await expectSignedIn({ page, email })).toBe(userId);
  });

  test('Sessão expirada mostra o aviso e o Entrar (RN10)', async ({ page }) => {
    await page.goto('/sessao-expirada?next=/perfis');
    await expect(page.getByText('Sua sessão terminou')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Entre no Kore' })).toBeVisible();
  });

  test('Criar meu site: o cadastro entra pelo código e chega aos Dados do casamento (decisão 165)', async ({
    page,
  }) => {
    const email = newEmail({ label: 'cadastro' });
    await page.goto('/cadastro');
    await expect(page.getByRole('heading', { name: 'Crie o site do casamento' })).toBeVisible();
    await page.getByRole('textbox', { name: 'E-\u2060mail' }).fill(email);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Confira seu e-\u2060mail' })).toBeVisible();
    const code = codeFrom({ email: await latestEmail({ request: page.request, to: email }) });
    await page.keyboard.type(code);
    await page.getByRole('button', { name: 'Entrar' }).click();
    // Conta nova pelo Criar meu site: o next é couple_signup, de volta ao /cadastro com sessão.
    await expect(page.getByRole('heading', { name: 'Conte sobre o casamento' })).toBeVisible();
    await expect(page).toHaveURL(/\/cadastro$/);
    await expectSignedIn({ page, email });
  });

  test('Cadastro completo: cria o casamento e convida o parceiro; de novo, já é dono (RN06, RN07, RN10)', async ({
    page,
  }) => {
    const email = newEmail({ label: 'casamento' });
    const unique = String(Date.now()).slice(-6);
    await page.goto('/cadastro');
    await page.getByRole('textbox', { name: 'E-\u2060mail' }).fill(email);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    const code = codeFrom({ email: await latestEmail({ request: page.request, to: email }) });
    await page.keyboard.type(code);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: 'Conte sobre o casamento' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Seu nome' }).fill(`Ana${unique} Moreira`);
    await page
      .locator('label')
      .filter({ hasText: /^Noiva$/ })
      .click();
    await page.getByRole('textbox', { name: 'Com quem você vai casar?' }).fill('Marcos Rocha');
    await page.getByRole('textbox', { name: 'Cidade' }).fill('Campinas');
    await page.getByRole('combobox', { name: 'UF' }).selectOption('SP');
    // RN04: o endereço vem dos primeiros nomes; RN05: checado e livre.
    await expect(page.getByRole('textbox', { name: 'Endereço do site' })).toHaveValue(
      `ana${unique}-e-marcos`,
    );
    await expect(page.getByRole('button', { name: 'Criar nosso site' })).toBeEnabled();
    await page.getByRole('button', { name: 'Criar nosso site' }).click();

    // RN10: depois de criar, convidar o parceiro (opcional): o convite sai e o e-mail chega.
    // A ida ao Dashboard depende do perfil do casal ativo na sessão (pendente com a API).
    await expect(page.getByRole('heading', { name: /Marcos/ })).toBeVisible();
    const partnerEmail = newEmail({ label: 'parceiro' });
    await page.getByRole('textbox', { name: 'E-\u2060mail de Marcos' }).fill(partnerEmail);
    await page.getByRole('button', { name: 'Enviar convite' }).click();
    await expect(
      page.getByText(`Convite enviado para ${partnerEmail}.`, { exact: true }),
    ).toBeVisible();
    const invite = await latestEmail({ request: page.request, to: partnerEmail });
    expect(invite.HTML).toContain('/convite/');

    // RN06: dono de um casamento ativo não cria outro.
    await page.goto('/cadastro');
    await page.getByRole('textbox', { name: 'Seu nome' }).fill(`Ana${unique} Moreira`);
    await page
      .locator('label')
      .filter({ hasText: /^Noivo$/ })
      .click();
    await page.getByRole('textbox', { name: 'Com quem você vai casar?' }).fill('Paula');
    await page.getByRole('textbox', { name: 'Cidade' }).fill('Campinas');
    await page.getByRole('combobox', { name: 'UF' }).selectOption('SP');
    await expect(page.getByRole('button', { name: 'Criar nosso site' })).toBeEnabled();
    await page.getByRole('button', { name: 'Criar nosso site' }).click();
    await expect(page.getByText('Você já tem um casamento no Kore.')).toBeVisible();
  });
});
