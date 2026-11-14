import { expect, test, type Page } from '@playwright/test';
import { codeFrom, latestEmail, newEmail } from './mailpit';
import {
  connectBackoffice,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

/*
 * Cadastro do cerimonialista (Cadastro e perfil RN01 a RN08), contra a API local, que tem o
 * PLANNER_SIGNUP_ENABLED ligado (só em local e test). A Área (/cerimonialista) chega no D3:
 * até lá, o fim do cadastro só confere o endereço (decisão 250(d)).
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

let db: Db;
test.beforeAll(async () => {
  db = await connectBackoffice();
});
test.afterAll(async () => {
  await db.end();
});

/** O código do e-mail que chegou depois do pedido, digitado no passo do código. */
async function typeCode({ page, email, since }: { page: Page; email: string; since: Date }) {
  await expect(page.getByRole('heading', { name: 'Confira seu e-⁠mail' })).toBeVisible();
  const code = codeFrom({ email: await latestEmail({ request: page.request, to: email, since }) });
  await page.keyboard.type(code);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function addCity({ page, city, state }: { page: Page; city: string; state: string }) {
  await page.getByRole('textbox', { name: 'Cidade', exact: true }).fill(city);
  await page.getByRole('combobox', { name: 'UF' }).selectOption(state);
  await page.getByRole('button', { name: 'Adicionar' }).click();
}

test.describe('Cadastro do cerimonialista (/cerimonialista/cadastro)', () => {
  test('sem sessão: o código do e-mail, os Dados profissionais, o Link pronto e o Como funciona (RN01 a RN06)', async ({
    page,
  }) => {
    const run = unique();
    const email = newEmail({ label: `cerimonial-${run}` });
    await page.goto('/cerimonialista/cadastro');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Fazer parceria com o Kore' }),
    ).toBeVisible();
    await page.getByRole('textbox', { name: 'E-⁠mail' }).fill(email);
    const since = new Date(Date.now() - 1000);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await typeCode({ page, email, since });

    // O login de origem planner_signup volta ao cadastro, já nos Dados profissionais.
    await expect(page).toHaveURL(/\/cerimonialista\/cadastro$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Como os casais vão ver você' }),
    ).toBeVisible();

    // RN04: os erros no campo, sem chamar a API.
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.getByText('Informe o nome da assessoria.')).toBeVisible();
    await expect(page.getByText('Informe seu nome.')).toBeVisible();
    await expect(page.getByText('Adicione pelo menos uma cidade.')).toBeVisible();
    await expect(page.getByText('Aceite os termos para continuar.')).toBeVisible();

    // Só letras: um sufixo de 8 dígitos parece telefone, e a API recusa (CREDIT_NAME_INVALID).
    const creditName = `Prado Assessoria ${run.replace(/\d/g, (digit) => 'abcdefghij'[Number(digit)] ?? '')}`;
    await page.getByRole('textbox', { name: 'Nome da assessoria' }).fill(creditName);
    // Conta nova, sem nome: o Seu nome aparece (RN04).
    await page.getByRole('textbox', { name: 'Seu nome' }).fill('Juliana Prado');
    await page.getByRole('textbox', { name: 'Telefone' }).fill('19988127730');
    await page.getByRole('checkbox', { name: 'O mesmo do telefone' }).check({ force: true });

    // As Cidades de atuação (decisão 249): chips "Cidade (UF)", sem repetir.
    await addCity({ page, city: 'Campinas', state: 'SP' });
    await addCity({ page, city: 'Valinhos', state: 'SP' });
    await addCity({ page, city: 'campinas', state: 'SP' });
    await expect(page.getByText('Essa cidade já está na lista.')).toBeVisible();
    await page.getByRole('button', { name: 'Remover Valinhos (SP)' }).click();
    await expect(page.getByRole('button', { name: 'Remover Valinhos (SP)' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remover Campinas (SP)' })).toBeVisible();

    await page
      .getByRole('checkbox', { name: /Li e aceito os Termos de uso/ })
      .check({ force: true });
    const create = page.waitForResponse(
      (response) =>
        response.url().endsWith('/v1/me/planner') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    expect((await create).ok()).toBe(true);

    // RN06: o Link de indicação pronto, com o link do GET /v1/me/referrer.
    await expect(
      page.getByRole('heading', { level: 1, name: 'Seu link de indicação está pronto' }),
    ).toBeVisible();
    const referrer = (await (await page.request.get(`${API_URL}/v1/me/referrer`)).json()) as {
      link: string;
    };
    // O link em destaque, sem o https:// (Penpot A1).
    await expect(
      page.getByText(referrer.link.replace(/^https?:\/\//, ''), { exact: true }),
    ).toBeVisible();
    // O WhatsApp abre o wa.me com a mensagem e o link (o site de fora não é aberto de verdade).
    await page
      .context()
      .route('https://wa.me/**', (route) =>
        route.fulfill({ status: 200, contentType: 'text/html', body: '<p>WhatsApp</p>' }),
      );
    const whatsapp = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Compartilhar no WhatsApp' }).click();
    const popup = await whatsapp;
    expect(new URL(popup.url()).searchParams.get('text')).toContain(referrer.link);
    await popup.close();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Como funciona' })).toBeVisible();
    await page.getByRole('button', { name: 'Ir para Meus casamentos' }).click();
    await expect(page).toHaveURL(/\/cerimonialista$/);

    // O perfil foi gravado com os dados da tela.
    const planner = (await (await page.request.get(`${API_URL}/v1/me/planner`)).json()) as {
      creditName: string;
      cities: string[];
      whatsapp: string | null;
    };
    expect(planner).toMatchObject({ creditName, cities: ['Campinas (SP)'] });
    expect(planner.whatsapp).toBeTruthy();

    // RN03: quem já tem o perfil não vê o cadastro de novo, vai à Área.
    await page.goto('/cerimonialista/cadastro');
    await expect(page).toHaveURL(/\/cerimonialista$/);
  });

  test('o Fazer parceria do Entrar leva ao cadastro (RN01)', async ({ page }) => {
    await page.goto('/entrar');
    await page.getByRole('link', { name: 'Fazer parceria' }).click();
    await expect(page).toHaveURL(/\/cerimonialista\/cadastro$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Fazer parceria com o Kore' }),
    ).toBeVisible();
  });

  test('o Criar outro perfil do menu do casal: a conta da sessão e os Dados sem o Seu nome (RN08)', async ({
    page,
  }) => {
    const run = unique();
    const email = newEmail({ label: `bianca-${run}` });
    const ownerId = await createUser({ db, email, name: 'Bianca Lopes' });
    await createWedding({
      db,
      partners: ['Bianca Lopes', 'Henrique Matos'],
      eventDate: '2027-04-17',
      city: 'Vinhedo',
      status: 'draft',
      createdByUserId: ownerId,
      owners: [ownerId, null],
    });

    await page.goto('/entrar');
    await page.getByRole('textbox', { name: 'E-⁠mail' }).fill(email);
    const since = new Date(Date.now() - 1000);
    await page.getByRole('button', { name: 'Receber código' }).click();
    await typeCode({ page, email, since });
    await expect(page).toHaveURL(/\/app$/);
    // A navegação que fecha o login termina antes de abrir o menu (como o signIn do suporte).
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Menu do usuário' }).click();
    // No celular, o menu do usuário é uma folha (diálogo) com botões.
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Criar outro perfil/ })
      .click();
    // A5: com sessão, a conta e o Continuar, sem o login.
    await expect(page).toHaveURL(/\/cerimonialista\/cadastro$/);
    await expect(page.getByText(`Você vai usar a conta ${email}.`)).toBeVisible();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Como os casais vão ver você' }),
    ).toBeVisible();
    // A conta já tem nome: o Seu nome não aparece.
    await expect(page.getByRole('textbox', { name: 'Seu nome' })).toHaveCount(0);
  });
});
