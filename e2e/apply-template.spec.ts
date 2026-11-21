import { expect, test, type Page } from '@playwright/test';
import { codeFrom, latestEmail, newEmail } from './mailpit';
import { toast } from './support/app';
import {
  connectBackoffice,
  createPlanner,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

/*
 * Aplicar modelo (D8b da F6; Modelos do cerimonialista RN07 a RN09; Penpot 17; decisão 298):
 * a colaboradora aplica um modelo de texto na Nossa história de um casamento em que
 * colabora; o nome do casal entra como texto simples e o site o mostra escapado. No Novo
 * casamento, o Começar de um modelo preenche a Aparência.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
const APP = { origin: 'http://localhost:5173' };

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
  await page.waitForLoadState('networkidle');
}

async function planner({ page }: { page: Page }) {
  const email = newEmail({ label: `aplicar-${unique()}` });
  const userId = await createUser({ db, email, name: 'Juliana Prado' });
  const referrerId = await createPlanner({ db, userId, creditName: `Prado ${letters()}` });
  await signIn({ page, email });
  return { userId, referrerId };
}

async function createTemplate({ page, data }: { page: Page; data: Record<string, unknown> }) {
  const response = await page.request.post(`${API_URL}/v1/me/planner-templates`, {
    headers: APP,
    data,
  });
  expect(response.status()).toBe(201);
}

test('Nossa história: aplica com os marcadores, salva, e o site mostra o <b>Ana</b> como texto (RN07, RN08)', async ({
  page,
  context,
}) => {
  const { userId, referrerId } = await planner({ page });
  const weddingId = await createWedding({
    db,
    partners: ['<b>Ana</b>', 'Marcos Vinícius Rocha'],
    eventDate: '2027-05-15',
    city: 'Campinas',
    status: 'draft',
    createdByUserId: userId,
    collaboratorIds: [userId],
    referrerId,
  });
  await createTemplate({
    page,
    data: {
      kind: 'section_content',
      sectionType: 'story',
      name: 'Nossa história: tom acolhedor',
      content: { text: '{casal} se conheceram em {cidade}, e casam em {data}.' },
    },
  });

  await page.goto(`/cerimonialista/casamentos/${weddingId}/site/nossa-historia`);
  await page.getByRole('button', { name: 'Aplicar modelo' }).click();
  const picker = page.getByRole('dialog', { name: 'Aplicar modelo' });
  await picker.getByRole('button', { name: /Nossa história: tom acolhedor/ }).click();
  const confirm = page.getByRole('alertdialog', {
    name: 'Aplicar "Nossa história: tom acolhedor"?',
  });
  await confirm.getByRole('button', { name: 'Aplicar' }).click();
  await expect(toast({ page, text: 'Modelo aplicado. Revise e salve.' })).toBeVisible();
  const expected = '<b>Ana</b> e Marcos se conheceram em Campinas, e casam em 15 de maio de 2027.';
  await expect(page.getByRole('textbox', { name: 'Texto' })).toHaveValue(expected);

  await page.getByRole('switch', { name: 'Mostrar a seção no site' }).locator('..').click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(toast({ page, text: 'Alterações salvas.' })).toBeVisible();

  // A prévia do rascunho: o nome chega como texto, sem virar negrito.
  const [tab] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: 'Pré-visualizar' }).click(),
  ]);
  await expect(tab.getByText(expected)).toBeVisible();
  await expect(tab.locator('b', { hasText: 'Ana' })).toHaveCount(0);
});

test('Novo casamento: o Começar de um modelo preenche a Aparência, sem confirmação (RN09; decisão 298)', async ({
  page,
}) => {
  await planner({ page });
  await createTemplate({
    page,
    data: {
      kind: 'appearance',
      name: 'Padrão Prado Assessoria',
      content: {
        fontPairKey: 'classico',
        starterPaletteKey: 'salvia',
        primaryColor: '#566C4B',
        accentColor: '#C9A66B',
        backgroundMode: 'light',
      },
    },
  });

  await page.goto('/cerimonialista/casamentos/novo');
  const first = `Isabela${letters()}`;
  await page.getByRole('textbox', { name: 'Nome 1 de 2' }).fill(first);
  await page.getByRole('textbox', { name: 'Nome 2 de 2' }).fill('André');
  await page.getByRole('textbox', { name: 'Cidade' }).fill('Americana');
  await page.getByRole('combobox', { name: 'UF' }).selectOption('SP');
  await page
    .getByRole('checkbox', { name: 'O casal ainda não sabe a data' })
    .check({ force: true });
  await expect(page.getByText('Endereço disponível. Dá para mudar até publicar.')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  const select = page.getByRole('combobox', { name: 'Começar de um modelo (opcional)' });
  await expect(select).toHaveValue('');
  await expect(select.locator('option:checked')).toHaveText('Sem modelo');
  await select.selectOption({ label: 'Padrão Prado Assessoria' });
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /Sálvia/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Claro' })).toBeChecked();

  const created = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/v1/me/weddings'),
  );
  await page.getByRole('button', { name: 'Criar casamento' }).click();
  expect((await created).postDataJSON()).toMatchObject({
    appearance: {
      fontPairKey: 'classico',
      starterPaletteKey: 'salvia',
      primaryColor: '#566C4B',
      accentColor: '#C9A66B',
      backgroundMode: 'light',
    },
  });
  await expect(
    page.getByText(
      'Passo 3 de 4 · O casamento já está criado como rascunho. Convide o casal agora ou deixe para depois.',
    ),
  ).toBeVisible();
});
