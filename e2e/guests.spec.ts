import { expect, test, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import {
  connectBackoffice,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

/**
 * O Toast visível, dentro da região de avisos: o Radix também cria, por 1 s, uma cópia
 * escondida do texto para o leitor de tela, fora da região.
 */
function toast({ page, text }: { page: Page; text: string }) {
  return page.getByRole('region', { name: /^Avisos/ }).getByText(text);
}
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
        {
          name: 'Célia Moreira',
          phone: '(19) 99876-3310',
          email: 'celia.moreira@exemplo.kore.local',
        },
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
  return { weddingId };
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

  test('Painel do grupo: abre pela lista, mascara o telefone, copia e regenera o link (RN11, RN12, RN14)', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await weddingWithParties({ db, page });
    await page.goto('/app/convidados?q=moreira');
    await page.getByRole('link', { name: 'Família Moreira' }).click();
    await expect(page).toHaveURL(/\/app\/convidados\/grupos\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: 'Família Moreira', level: 1 })).toBeVisible();
    await expect(page.getByText('3 convidados · Contato: Célia Moreira')).toBeVisible();
    await expect(page.getByText('(19) 9****-3310')).toBeVisible();
    // Telefone e e-mail mascarados pelo servidor (decisão 202); os inteiros não aparecem.
    await expect(page.getByText('ce***@exemplo.kore.local')).toBeVisible();
    await expect(page.getByText('celia.moreira@exemplo.kore.local')).toHaveCount(0);

    const link = page.locator('.kore-party-panel__link');
    const oldUrl = (await link.textContent()) ?? '';
    expect(oldUrl).toMatch(/^http:\/\/localhost:5173\/e2e-[^/]+\/grupo\/\S+$/);
    await page.getByRole('button', { name: 'Copiar link' }).click();
    await expect(toast({ page, text: 'Link copiado.' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(oldUrl);

    await page.getByRole('button', { name: 'Regenerar link' }).click();
    const dialog = page.getByRole('alertdialog', {
      name: 'Regenerar o link do grupo Família Moreira?',
    });
    await dialog.getByRole('button', { name: 'Regenerar link' }).click();
    await expect(dialog).toBeHidden();
    await expect(link).not.toHaveText(oldUrl);

    await page.getByRole('link', { name: '‹ Voltar para Convidados' }).click();
    await expect(page).toHaveURL(/\/app\/convidados$/);
  });

  test('Mover de grupo: leva o convidado ao outro grupo e recusa o último (RN08, RN10; decisão 201)', async ({
    page,
  }) => {
    await weddingWithParties({ db, page });
    await page.goto('/app/convidados?q=moreira');
    await page.getByRole('link', { name: 'Família Moreira' }).click();

    await page.getByRole('button', { name: 'Ações de Pedro Moreira' }).click();
    await page.getByRole('menuitem', { name: 'Mover de grupo' }).click();
    const dialog = page.getByRole('dialog', { name: 'Mover Pedro Moreira para outro grupo' });
    await dialog.getByRole('searchbox', { name: 'Buscar por nome' }).fill('helena');
    const select = dialog.getByRole('combobox', { name: 'Grupo' });
    await expect(select.getByRole('option', { name: 'Vó Helena' })).toBeAttached();
    await select.selectOption({ label: 'Vó Helena' });
    await dialog.getByRole('button', { name: 'Mover' }).click();
    await expect(toast({ page, text: 'Pedro Moreira foi para Vó Helena.' })).toBeVisible();
    await expect(page.getByText('2 convidados · Contato: Célia Moreira')).toBeVisible();

    // No destino, Pedro entra no fim do grupo (RN17).
    await page.getByRole('link', { name: '‹ Voltar para Convidados' }).click();
    await page.getByRole('searchbox', { name: 'Buscar por nome' }).fill('helena');
    await page.getByRole('link', { name: 'Vó Helena' }).click();
    const guests = page
      .getByRole('heading', { name: 'Convidados', level: 2 })
      .locator('..')
      .getByRole('listitem');
    await expect(guests).toHaveCount(2);
    await expect(guests.nth(1)).toContainText('Pedro Moreira');

    // Um grupo de uma pessoa: o último convidado com nome não sai (RN08).
    await page.getByRole('link', { name: '‹ Voltar para Convidados' }).click();
    await page.getByRole('searchbox', { name: 'Buscar por nome' }).fill('E2E 01');
    await page.getByRole('link', { name: 'Grupo E2E 01' }).click();
    await page.getByRole('button', { name: 'Ações de Pessoa 01' }).click();
    await page.getByRole('menuitem', { name: 'Mover de grupo' }).click();
    await expect(
      toast({
        page,
        text: 'O grupo precisa de pelo menos um convidado. Para tirar todos, movam o grupo para a lixeira.',
      }),
    ).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Tags: cria, edita nome e cor, recusa nome repetido e manda para a lixeira (Tags RN01 a RN06)', async ({
    page,
  }) => {
    await weddingWithParties({ db, page });
    await page.goto('/app/convidados');
    await page
      .getByRole('navigation', { name: 'Convidados' })
      .getByRole('link', { name: /^Tags/ })
      .click();
    await expect(page).toHaveURL(/\/app\/convidados\/tags$/);
    await expect(page.getByRole('heading', { name: '0 de 10 tags' })).toBeVisible();

    const field = page.getByRole('textbox', { name: 'Nome da tag nova' });
    await field.fill('Igreja');
    await page.getByRole('button', { name: 'Criar tag' }).click();
    await expect(page.getByRole('heading', { name: '1 de 10 tags' })).toBeVisible();
    await field.fill('IGREJA');
    await page.getByRole('button', { name: 'Criar tag' }).click();
    await expect(page.getByText('Já existe uma tag com este nome.')).toBeVisible();

    await page
      .getByRole('listitem')
      .filter({ hasText: 'Igreja' })
      .getByRole('button', { name: 'Editar' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Editar tag' });
    await dialog.getByRole('textbox', { name: 'Nome da tag' }).fill('Igreja Matriz');
    // Quem usa toca na cor (o rótulo, com a área de toque de 44 px).
    const champagne = dialog.getByRole('radio', { name: 'Champanhe' });
    await champagne.locator('..').click();
    await expect(champagne).toBeChecked();
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(toast({ page, text: 'Alterações salvas.' })).toBeVisible();
    await expect(page.getByText('Igreja Matriz')).toHaveClass(/kore-tag--champagne/);

    await page
      .getByRole('listitem')
      .filter({ hasText: 'Igreja Matriz' })
      .getByRole('button', { name: 'Editar' })
      .click();
    await dialog.getByRole('button', { name: 'Excluir tag' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Excluir a tag Igreja Matriz?' });
    await confirm.getByRole('button', { name: 'Excluir tag' }).click();
    await expect(toast({ page, text: 'A tag Igreja Matriz foi para a lixeira.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '0 de 10 tags' })).toBeVisible();
  });

  test('filtro de Tag: mostra só o grupo com a tag, pela folha do celular (Tags RN09)', async ({
    page,
  }) => {
    const { weddingId } = await weddingWithParties({ db, page });
    const created = await page.request.post(`${API_URL}/v1/weddings/${weddingId}/tags`, {
      headers: { origin: APP_ORIGIN },
      data: { name: 'Padrinhos', color: 'champagne' },
    });
    expect(created.status(), await created.text()).toBe(201);
    const { id: tagId } = (await created.json()) as { id: string };
    await createParty({
      page,
      weddingId,
      body: { name: 'Padrinhos do noivo', guests: [{ name: 'Bruno Lima' }], tagIds: [tagId] },
    });

    await page.goto('/app/convidados');
    await page.getByRole('button', { name: 'Filtros' }).click();
    const sheet = page.getByRole('dialog', { name: 'Filtros' });
    await sheet.getByRole('combobox', { name: 'Tag' }).selectOption({ label: 'Tag: Padrinhos' });
    await sheet.getByRole('button', { name: 'Mostrar resultados' }).click();
    await expect(page.getByText('Mostrando 1 de 1 grupo')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Padrinhos do noivo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filtros (1)' })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`\\?tag=${tagId}$`));
  });

  test('Mover para a lixeira: o convidado, o grupo e a seleção saem da lista e do resumo (Lixeira RN02 a RN06)', async ({
    page,
  }) => {
    await weddingWithParties({ db, page });
    await page.goto('/app/convidados?q=moreira');
    await page.getByRole('link', { name: 'Família Moreira' }).click();

    await page.getByRole('button', { name: 'Ações de Pedro Moreira' }).click();
    await page.getByRole('menuitem', { name: 'Mover para a lixeira' }).click();
    await page
      .getByRole('alertdialog', { name: 'Mover Pedro Moreira para a lixeira?' })
      .getByRole('button', { name: 'Mover para a lixeira' })
      .click();
    await expect(toast({ page, text: 'Pedro Moreira foi para a lixeira.' })).toBeVisible();
    await expect(page.getByText('2 convidados · Contato: Célia Moreira')).toBeVisible();

    await page
      .locator('.kore-party-panel__link')
      .locator('..')
      .getByRole('button', { name: 'Mover para a lixeira' })
      .click();
    const dialog = page.getByRole('alertdialog', {
      name: 'Mover o grupo Família Moreira para a lixeira?',
    });
    await expect(dialog).toContainText('O grupo e os 2 convidados ficam 30 dias na lixeira');
    await dialog.getByRole('button', { name: 'Mover para a lixeira' }).click();
    await expect(toast({ page, text: 'Família Moreira foi para a lixeira.' })).toBeVisible();
    await expect(page).toHaveURL(/\/app\/convidados$/);
    await expect(
      page.getByText('28 convidados em 26 grupos · 0 confirmados, 0 recusados e 28 pendentes'),
    ).toBeVisible();

    await page.getByRole('searchbox', { name: 'Buscar por nome' }).fill('E2E 0');
    await expect(page.getByText('Mostrando 9 de 9 grupos')).toBeVisible();
    for (const name of ['Grupo E2E 01', 'Grupo E2E 02']) {
      await page
        .getByRole('checkbox', { name: `Selecionar ${name}` })
        .locator('..')
        .click();
    }
    await page.getByRole('button', { name: 'Mover para a lixeira' }).click();
    await page
      .getByRole('alertdialog', { name: 'Mover 2 grupos para a lixeira?' })
      .getByRole('button', { name: 'Mover para a lixeira' })
      .click();
    await expect(toast({ page, text: '2 grupos foram para a lixeira.' })).toBeVisible();
    await expect(page.getByText('Mostrando 7 de 7 grupos')).toBeVisible();
  });

  test('Lixeira: mostra o grupo e a tag removidos e restaura os dois (Lixeira RN08, RN09)', async ({
    page,
  }) => {
    const { weddingId } = await weddingWithParties({ db, page });
    const created = await page.request.post(`${API_URL}/v1/weddings/${weddingId}/tags`, {
      headers: { origin: APP_ORIGIN },
      data: { name: 'Vizinhos' },
    });
    const { id: tagId } = (await created.json()) as { id: string };
    await page.request.delete(`${API_URL}/v1/weddings/${weddingId}/tags/${tagId}`, {
      headers: { origin: APP_ORIGIN },
    });
    await page.goto('/app/convidados?q=helena');
    await page.getByRole('link', { name: 'Vó Helena' }).click();
    await page
      .locator('.kore-party-panel__link')
      .locator('..')
      .getByRole('button', { name: 'Mover para a lixeira' })
      .click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Mover para a lixeira' })
      .click();
    await expect(page).toHaveURL(/\/app\/convidados$/);

    await page
      .getByRole('navigation', { name: 'Convidados' })
      .getByRole('link', { name: 'Lixeira' })
      .click();
    await expect(
      page.getByText('Itens na lixeira são apagados de vez depois de 30 dias.'),
    ).toBeVisible();
    const party = page.getByRole('listitem').filter({ hasText: 'Grupo · Vó Helena' });
    await expect(party).toContainText(
      /1 convidado · removido em \d{2}\/\d{2} · apagado depois de \d{2}\/\d{2}/,
    );
    await party.getByRole('button', { name: 'Restaurar' }).click();
    await expect(toast({ page, text: 'Vó Helena voltou para a lista.' })).toBeVisible();
    await expect(party).toHaveCount(0);

    await page
      .getByRole('listitem')
      .filter({ hasText: 'Tag · Vizinhos' })
      .getByRole('button', { name: 'Restaurar' })
      .click();
    await expect(toast({ page, text: 'A tag Vizinhos voltou.' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Convidados' })).toContainText(
      'Tags · 1 de 10',
    );
  });

  test('Importar planilha: o modelo do app, a prévia com erro e repetida, e a importação (Importação RN02 a RN09)', async ({
    page,
  }) => {
    await weddingWithParties({ db, page });
    await page.goto('/app/convidados/importar');

    // O modelo que o app serve, preenchido: a API tem de aceitar os títulos dele (209).
    const download = await page.request.get('/modelo-convidados-kore.xlsx');
    expect(download.status()).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await download.body()));
    const sheet = workbook.worksheets[0];
    sheet?.addRow(['Família Silva', 'Ana Silva', '(19) 99876-1111', '', 'Adulta', '', '']);
    sheet?.addRow(['Família Silva', 'Beto Silva', '9876-1402', '', '', '', '']);
    sheet?.addRow(['família silva', 'ana silva', '', '', '', '', '']);
    sheet?.addRow([
      'Vó Rosa',
      'Rosa Lima',
      '',
      'rosa@exemplo.kore.local',
      'adulto',
      'sem glúten',
      '',
    ]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await page.getByLabel(/Arrastem a planilha/).setInputFiles({
      name: 'convidados-teste.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });
    await expect(page.getByText('convidados-teste.xlsx')).toBeVisible();
    await expect(page.getByText('2 grupos · 2 convidados')).toBeVisible();
    await expect(page.getByText('Linha 3 · Beto Silva')).toBeVisible();
    await expect(
      page.getByText('O telefone tem 8 números. Usem DDD + número, ex.: (19) 99999-9999.'),
    ).toBeVisible();
    await expect(
      page.getByText('Repetido: já está na linha 2, no grupo Família Silva.'),
    ).toBeVisible();
    await expect(
      page.getByText('As 2 linhas que ficaram de fora vocês cadastram depois, uma a uma.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Importar 2 convidados' }).click();
    await expect(toast({ page, text: '2 grupos importados' })).toBeVisible();
    await expect(page).toHaveURL(/\/app\/convidados$/);
    await expect(
      page.getByText('33 convidados em 29 grupos · 0 confirmados, 0 recusados e 33 pendentes'),
    ).toBeVisible();
  });

  test.describe('computador', () => {
    test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

    test('Adicionar tag aplica a tag aos grupos marcados (Tags RN08; decisão 204)', async ({
      page,
    }) => {
      const { weddingId } = await weddingWithParties({ db, page });
      const created = await page.request.post(`${API_URL}/v1/weddings/${weddingId}/tags`, {
        headers: { origin: APP_ORIGIN },
        data: { name: 'Padrinhos', color: 'champagne' },
      });
      expect(created.status()).toBe(201);
      await page.goto('/app/convidados?q=e2e 0');
      const table = page.getByRole('table', { name: 'Grupos e convidados' });
      for (const name of ['Grupo E2E 01', 'Grupo E2E 02']) {
        await table
          .getByRole('checkbox', { name: `Selecionar ${name}` })
          .locator('..')
          .click();
      }
      await page.getByRole('button', { name: 'Adicionar tag' }).click();
      await page.getByRole('menuitem', { name: 'Padrinhos' }).click();
      await expect(toast({ page, text: 'Tag aplicada a 2 grupos.' })).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: 'selecionad' })).toHaveCount(0);

      await page.goto('/app/convidados');
      await page
        .getByRole('combobox', { name: 'Tag' })
        .first()
        .selectOption({ label: 'Tag: Padrinhos' });
      await expect(page.getByText('Mostrando 2 de 2 grupos')).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Convidados' })).toContainText(
        'Tags · 1 de 10',
      );
    });

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
