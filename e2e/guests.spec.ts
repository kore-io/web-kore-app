import { expect, test, type Page } from '@playwright/test';
import {
  connectBackoffice,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
const APP_ORIGIN = 'http://localhost:5173';

/** Entra pelo provedor dev do Google (decisão 147) e espera a área do casal. */
async function signIn({ page, email }: { page: Page; email: string }) {
  await page.goto('/entrar');
  await page.getByRole('button', { name: 'Continuar com Google' }).click();
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/(app|perfis)$/);
}

async function createParty({
  page,
  weddingId,
  body,
}: {
  page: Page;
  weddingId: string;
  body: unknown;
}) {
  const response = await page.request.post(`${API_URL}/v1/weddings/${weddingId}/parties`, {
    headers: { origin: APP_ORIGIN },
    data: body,
  });
  expect(response.status(), await response.text()).toBe(201);
}

/**
 * Casamento de teste com 27 grupos (a lista pagina de 25 em 25): a Família Moreira (Luiz
 * sem contato, Célia com telefone, Pedro), Vó Helena (sem telefone ou e-mail), Carla e
 * Rafael (com uma vaga de acompanhante) e 24 grupos de uma pessoa.
 */
async function weddingWithParties({ db, page }: { db: Db; page: Page }) {
  const email = `e2e-convidados-${unique()}@exemplo.kore.local`;
  const userId = await createUser({ db, email, name: 'Ana Beatriz Moreira' });
  const weddingId = await createWedding({
    db,
    partners: ['Ana', 'Marcos'],
    eventDate: '2027-05-15',
    city: 'Campinas',
    status: 'draft',
    createdByUserId: userId,
    owners: [userId, null],
  });
  await signIn({ page, email });
  await createParty({
    page,
    weddingId,
    body: {
      name: 'Família Moreira',
      guests: [
        { name: 'Luiz Moreira' },
        { name: 'Célia Moreira', phone: '(19) 99876-3310' },
        { name: 'Pedro Moreira' },
      ],
    },
  });
  await createParty({
    page,
    weddingId,
    body: { name: 'Vó Helena', guests: [{ name: 'Helena Moreira' }] },
  });
  await createParty({
    page,
    weddingId,
    body: {
      name: 'Carla e Rafael',
      guests: [{ name: 'Carla Nunes', phone: '11998768024' }, { name: 'Rafael Nunes' }],
      plusOneSlots: 1,
    },
  });
  for (let index = 1; index <= 24; index += 1) {
    const number = String(index).padStart(2, '0');
    await createParty({
      page,
      weddingId,
      body: { name: `Grupo E2E ${number}`, guests: [{ name: `Pessoa ${number}` }] },
    });
  }
}

test.describe('Convidados › Grupos e convidados (RN13)', () => {
  let db: Db;
  test.beforeAll(async () => {
    db = await connectBackoffice();
  });
  test.afterAll(async () => {
    await db.end();
  });

  test('celular: resumo, cartões, rolagem infinita, busca sem acento e filtros', async ({
    page,
  }) => {
    await weddingWithParties({ db, page });
    await page.goto('/app/convidados');

    await expect(
      page.getByText('31 convidados em 27 grupos · 0 confirmados, 0 recusados e 31 pendentes'),
    ).toBeVisible();
    await expect(page.getByText('Mostrando 25 de 27 grupos')).toBeVisible();
    const rows = page.getByRole('table', { name: 'Grupos e convidados' }).getByRole('row');
    // No celular o cabeçalho fica escondido, fora da árvore de acessibilidade.
    await expect(rows).toHaveCount(25);

    // Rolagem infinita (decisão 197): no fim da lista, a 2ª página entra.
    await page.getByText('Mostrando 25 de 27 grupos').scrollIntoViewIfNeeded();
    await expect(page.getByText('Mostrando 27 de 27 grupos')).toBeVisible();
    await expect(page.getByText('Helena Moreira · sem telefone ou e-⁠mail')).toBeVisible();

    // Busca sem acento pelo nome de um convidado (RN13), e o telefone mascarado do contato.
    await page.getByRole('searchbox', { name: 'Buscar por nome' }).fill('celia');
    await expect(page.getByText('Mostrando 1 de 1 grupo')).toBeVisible();
    await expect(page.getByText('Célia Moreira · (19) 9****-3310')).toBeVisible();
    await expect(page).toHaveURL(/\?q=celia$/);
    await expect(page.getByText('1 recusado')).toHaveCount(0);

    // Filtros pela folha do celular: Envio respondido não tem ninguém na F1.
    await page.getByRole('searchbox', { name: 'Buscar por nome' }).fill('');
    await page.getByRole('button', { name: 'Filtros' }).click();
    const sheet = page.getByRole('dialog', { name: 'Filtros' });
    await sheet.getByRole('combobox', { name: 'Envio' }).selectOption('respondido');
    await sheet.getByRole('button', { name: 'Mostrar resultados' }).click();
    await expect(page.getByText('Nenhum grupo encontrado.')).toBeVisible();
    await expect(page).toHaveURL(/\?envio=respondido$/);
  });

  test.describe('computador', () => {
    test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

    test('a tabela com o cabeçalho, a vaga pendente e a seleção', async ({ page }) => {
      await weddingWithParties({ db, page });
      await page.goto('/app/convidados?resposta=pendentes');
      const table = page.getByRole('table', { name: 'Grupos e convidados' });
      await expect(table.getByRole('columnheader', { name: 'Respondido em' })).toBeVisible();
      const carla = table.getByRole('row').filter({ hasText: 'Carla e Rafael' });
      await expect(
        carla.getByText('nenhum recusado · 2 pendentes · 1 vaga pendente'),
      ).toBeVisible();
      await expect(carla.getByText('Não enviado')).toBeVisible();

      // Quem usa toca no controle desenhado (o rótulo, com a área de toque de 44 px).
      const checkbox = carla.getByRole('checkbox', { name: 'Selecionar Carla e Rafael' });
      await checkbox.locator('..').click();
      await expect(checkbox).toBeChecked();
      await expect(page.getByRole('status').filter({ hasText: 'selecionado' })).toHaveText(
        '1 grupo selecionado',
      );
      await expect(
        table.getByRole('checkbox', { name: 'Selecionar todos os grupos' }),
      ).toHaveJSProperty('indeterminate', true);
    });
  });
});
