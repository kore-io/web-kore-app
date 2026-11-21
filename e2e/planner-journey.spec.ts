import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { codeFrom, latestEmail, newEmail } from './mailpit';
import { signIn as signInCouple, toast } from './support/app';
import {
  connectBackoffice,
  createPlanner,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

/*
 * A cerimonialista de ponta a ponta (D11 da F6; Colaboradora dentro do casamento RN08 e o
 * Gherkin; decisão 198(2)): o cadastro, o Novo casamento com o link do casal, o aceite, o
 * casamento aberto pelo detalhe, o Aplicar modelo, os grupos (Novo grupo e lista colada), a
 * resposta de um grupo na central dela, o que ela não pode (lixeira de quem respondeu, a
 * data, Colaboradores), o envio pela fila e o Sair. Depois, as duas abas (dona e
 * colaboradora; dois casamentos) e a perda de acesso com o casal removendo.
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

/** O código do e-mail, no passo do código que a tela já mostra. */
async function typeCode({ page, email, since }: { page: Page; email: string; since: Date }) {
  await expect(page.getByRole('heading', { name: 'Confira seu e-⁠mail' })).toBeVisible();
  const code = codeFrom({ email: await latestEmail({ request: page.request, to: email, since }) });
  await page.keyboard.type(code);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function signInPlanner({ page, email }: { page: Page; email: string }) {
  await page.goto('/entrar');
  await page.getByRole('textbox', { name: 'E-⁠mail' }).fill(email);
  const since = new Date(Date.now() - 1000);
  await page.getByRole('button', { name: 'Receber código' }).click();
  await typeCode({ page, email, since });
  await expect(page).not.toHaveURL(/\/entrar/);
  await page.waitForLoadState('networkidle');
}

async function newGroup({ page, name, guest }: { page: Page; name: string; guest: string }) {
  await page.getByRole('button', { name: 'Novo grupo' }).click();
  await page.getByRole('textbox', { name: 'Nome do grupo' }).fill(name);
  await page
    .getByRole('group', { name: 'Convidados' })
    .getByRole('textbox', { name: 'Nome' })
    .first()
    .fill(guest);
  await page.getByRole('button', { name: 'Salvar grupo' }).click();
}

async function partyWedding(name: string): Promise<string | undefined> {
  const { rows } = await db.query<{ wedding_id: string }>(
    'select wedding_id from parties where name = $1 and deleted_at is null',
    [name],
  );
  return rows[0]?.wedding_id;
}

test('a jornada da cerimonialista: do cadastro ao Sair, com a resposta na central dela (RN08)', async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  // 1. O cadastro no local (Cadastro e perfil RN01 a RN06).
  const plannerEmail = newEmail({ label: `jornada-${unique()}` });
  await page.goto('/cerimonialista/cadastro');
  await page.getByRole('textbox', { name: 'E-⁠mail' }).fill(plannerEmail);
  const since = new Date(Date.now() - 1000);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await typeCode({ page, email: plannerEmail, since });
  await expect(
    page.getByRole('heading', { level: 1, name: 'Como os casais vão ver você' }),
  ).toBeVisible();
  const organization = `Prado Assessoria ${letters()}`;
  await page.getByRole('textbox', { name: 'Nome da assessoria' }).fill(organization);
  await page.getByRole('textbox', { name: 'Seu nome' }).fill('Juliana Prado');
  await page.getByRole('textbox', { name: 'Telefone' }).fill('19988127730');
  await page.getByRole('checkbox', { name: 'O mesmo do telefone' }).check({ force: true });
  await page.getByRole('textbox', { name: 'Cidade', exact: true }).fill('Campinas');
  await page.getByRole('combobox', { name: 'UF' }).selectOption('SP');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await page.getByRole('checkbox', { name: /Li e aceito os Termos de uso/ }).check({ force: true });
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Seu link de indicação está pronto' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Ir para Meus casamentos' }).click();
  await expect(page).toHaveURL(/\/cerimonialista$/);

  // Um modelo de texto para a Nossa história (Modelos RN07, RN08).
  const template = await page.request.post(`${API_URL}/v1/me/planner-templates`, {
    headers: APP,
    data: {
      kind: 'section_content',
      sectionType: 'story',
      name: 'Nossa história: tom acolhedor',
      content: { text: '{casal} se conheceram em {cidade}.' },
    },
  });
  expect(template.status()).toBe(201);

  // 2. Novo casamento com o link do casal (Novo casamento RN02 a RN06).
  const first = `Isabela${letters()}`;
  const couple = `${first} e André`;
  await page.goto('/cerimonialista/casamentos/novo');
  await page.getByRole('textbox', { name: 'Nome 1 de 2' }).fill(first);
  await page.getByRole('textbox', { name: 'Nome 2 de 2' }).fill('André');
  await page.getByRole('textbox', { name: 'Cidade' }).fill('Americana');
  await page.getByRole('combobox', { name: 'UF' }).selectOption('SP');
  await page.getByRole('textbox', { name: 'Data do casamento (opcional)' }).fill('2027-05-15');
  await expect(page.getByText('Endereço disponível. Dá para mudar até publicar.')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Criar casamento' }).click();
  await page.getByRole('button', { name: 'Gerar link' }).click();
  await expect(page.getByRole('heading', { name: 'Casamento criado.' })).toBeVisible();
  const link = await page
    .getByRole('region', { name: 'Link para o casal' })
    .getByRole('textbox', { name: 'Link para o casal' })
    .inputValue();
  const weddingId = new URL(page.url()).searchParams.get('casamento') ?? '';
  expect(weddingId).not.toBe('');

  // 3. O casal aceita pelo link (Convites de acesso RN09).
  const coupleEmail = newEmail({ label: `isabela-${unique()}` });
  const coupleContext = await browser.newContext();
  const couplePage = await coupleContext.newPage();
  await couplePage.goto(link);
  await expect(couplePage.getByText(`Assessoria: ${organization}`)).toBeVisible();
  await couplePage.getByRole('button', { name: 'Aceitar e virar dono' }).click();
  await expect(couplePage).toHaveURL(/\/entrar$/);
  await couplePage.getByRole('textbox', { name: 'E-⁠mail' }).fill(coupleEmail);
  const coupleSince = new Date(Date.now() - 1000);
  await couplePage.getByRole('button', { name: 'Receber código' }).click();
  await typeCode({ page: couplePage, email: coupleEmail, since: coupleSince });
  await expect(couplePage.getByRole('heading', { level: 1, name: 'Quem é você?' })).toBeVisible();
  await couplePage
    .locator('label')
    .filter({ hasText: new RegExp(`^${first}$`) })
    .click();
  await couplePage
    .locator('label')
    .filter({ hasText: /^Noiva$/ })
    .click();
  await couplePage.getByRole('button', { name: 'Continuar' }).click();
  await expect(couplePage).toHaveURL(/\/app$/);
  await coupleContext.close();

  // 4. Ela entra no casamento pelo detalhe (RN01, RN02).
  await page.goto('/cerimonialista');
  await page
    .getByRole('link', { name: new RegExp(`^${couple}`) })
    .first()
    .click();
  await page
    .getByRole('dialog', { name: couple })
    .getByRole('button', { name: 'Editar o site' })
    .click();
  await expect(page).toHaveURL(new RegExp(`/cerimonialista/casamentos/${weddingId}/site/`));
  await expect(page.getByText('Você colabora neste casamento.')).toBeVisible();
  const base = `/cerimonialista/casamentos/${weddingId}`;

  // 5. Aplica o modelo na Nossa história e salva (Modelos RN07, RN08).
  await page.goto(`${base}/site/nossa-historia`);
  await page.getByRole('button', { name: 'Aplicar modelo' }).click();
  await page
    .getByRole('dialog', { name: 'Aplicar modelo' })
    .getByRole('button', { name: /Nossa história: tom acolhedor/ })
    .click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByRole('textbox', { name: 'Texto' })).toHaveValue(
    `${first} e André se conheceram em Americana.`,
  );
  await page.getByRole('switch', { name: 'Mostrar a seção no site' }).locator('..').click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(toast({ page, text: 'Alterações salvas.' })).toBeVisible();

  // 6. Depois do aceite, a data, a UF e o endereço ficam em leitura (RN03).
  await page.goto(`${base}/site/dados-basicos`);
  await expect(
    page.getByText('Só o casal pode mudar a data, a UF e o endereço.').first(),
  ).toBeVisible();
  await expect(page.getByLabel('Data do casamento')).toBeDisabled();

  // 7. Os grupos: o Novo grupo e a lista colada (Grupos RN03; Importação RN10 a RN12).
  await page.goto(`${base}/convidados`);
  const beatriz = `Beatriz e Leonardo ${letters()}`;
  await newGroup({ page, name: beatriz, guest: 'Beatriz Lima' });
  await expect(page).toHaveURL(new RegExp(`${base}/convidados`));
  await expect.poll(() => partyWedding(beatriz)).toBe(weddingId);
  await page.goto(`${base}/convidados/importar`);
  await page.getByRole('button', { name: 'Colar a lista' }).click();
  const marcia = `Tia Márcia ${letters()}`;
  await page.getByRole('textbox', { name: 'Colar a lista' }).fill(`${marcia}: Márcia Rocha`);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Importar 1 convidado' }).click();
  await expect.poll(() => partyWedding(marcia)).toBe(weddingId);

  // 8. Um grupo, o site no ar e a resposta pelo link (RSVP RN01 a RN07).
  const party = (await (
    await page.request.post(`${API_URL}/v1/weddings/${weddingId}/parties`, {
      headers: APP,
      data: {
        name: 'Família Nunes',
        guests: [{ name: 'Carla Nunes' }],
      },
    })
  ).json()) as { id: string; link: { url: string } };
  await db.query(
    `update weddings set status = 'published', published_at = now(), end_date = '2027-08-15',
       publication_source = 'courtesy' where id = $1`,
    [weddingId],
  );
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(party.link.url);
  await guest.getByRole('link', { name: 'Confirmar presença' }).first().click();
  await guest.getByRole('group', { name: 'Carla Nunes' }).getByText('Vou', { exact: true }).click();
  await guest
    .getByRole('group', { name: 'Quem está respondendo?' })
    .getByText('Carla', { exact: true })
    .click();
  await guest.getByRole('button', { name: 'Enviar respostas' }).click();
  await expect(guest.getByText(/confirmaram 1 pessoa/)).toBeVisible();
  await guestContext.close();

  // 9. A resposta chega na central dela (Notificações da cerimonialista RN02, RN05).
  await page.goto('/cerimonialista/notificacoes');
  await expect(
    page.getByRole('button', { name: new RegExp(`^Família Nunes respondeu em ${couple}`) }),
  ).toBeVisible();

  // 10. O grupo que respondeu não vai para a lixeira por ela (RN03).
  await page.goto(`${base}/convidados`);
  await page.getByRole('button', { name: 'Ações de Família Nunes' }).click();
  await expect(page.getByRole('menuitem', { name: 'Mover para a lixeira' })).toBeDisabled();
  await page.keyboard.press('Escape');

  // 11. O envio do convite pela fila, por Copiar link (Envios RN03, RN05 a RN07).
  await page.goto(`${base}/envios/convites`);
  await page.getByRole('checkbox', { name: new RegExp(beatriz) }).check({ force: true });
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('radio', { name: 'Copiar link' }).check({ force: true });
  await page.getByRole('button', { name: 'Ir para a fila (1 grupo)' }).click();
  await page.getByRole('button', { name: 'Copiar mensagem' }).click();
  await expect(toast({ page, text: 'Mensagem copiada.' })).toBeVisible();
  await expect
    .poll(async () => {
      const { rows } = await db.query<{ delivery_status: string }>(
        'select delivery_status from parties where name = $1',
        [beatriz],
      );
      return rows[0]?.delivery_status;
    })
    .toBe('sent');

  // 12. Colaboradores em leitura e o Sair (RN05).
  await page.goto(`${base}/colaboradores`);
  await expect(
    page.getByRole('region', { name: 'Cerimonialista' }).getByRole('button', { name: 'Remover' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Sair deste casamento' }).click();
  await page
    .getByRole('alertdialog', { name: `Sair de ${couple}?` })
    .getByRole('button', { name: 'Sair do casamento' })
    .click();
  await expect(page).toHaveURL(/\/cerimonialista$/);
  await expect(toast({ page, text: `Você saiu do casamento de ${couple}.` })).toBeVisible();
});

/** Uma cerimonialista com casamentos semeados (dona de um, colaboradora de outros). */
async function plannerWith({ owned, collaborating }: { owned: boolean; collaborating: number }) {
  const email = newEmail({ label: `abas-${unique()}` });
  const userId = await createUser({ db, email, name: 'Juliana Prado' });
  const referrerId = await createPlanner({ db, userId, creditName: `Prado ${letters()}` });
  const ownerId = await createUser({
    db,
    email: `e2e-dona-${unique()}@exemplo.kore.local`,
    name: 'Ana Beatriz Moreira',
  });
  const own = owned
    ? await createWedding({
        db,
        partners: ['Juliana Prado', 'Pedro Alves'],
        eventDate: '2027-09-10',
        city: 'Campinas',
        status: 'draft',
        createdByUserId: userId,
        owners: [userId, null],
      })
    : null;
  const weddings: string[] = [];
  for (let index = 0; index < collaborating; index += 1) {
    weddings.push(
      await createWedding({
        db,
        partners: [index === 0 ? 'Ana Beatriz Moreira' : 'Fernanda Alves', 'Marcos Rocha'],
        eventDate: '2027-05-15',
        city: 'Campinas',
        status: 'draft',
        createdByUserId: ownerId,
        owners: [ownerId, null],
        collaboratorIds: [userId],
        referrerId,
      }),
    );
  }
  return { email, userId, own, weddings, ownerId };
}

test('dona e colaboradora em duas abas: cada casamento no seu lugar, e o grupo entra no certo (RN01, RN03)', async ({
  context,
}) => {
  const { email, own, weddings } = await plannerWith({ owned: true, collaborating: 1 });
  const [collab] = weddings;
  const first = await context.newPage();
  await signInPlanner({ page: first, email });
  const second = await context.newPage();
  await second.goto(`/cerimonialista/casamentos/${collab}/convidados`);
  await expect(second.getByText('Você colabora neste casamento.')).toBeVisible();

  // A primeira aba abre o casamento dela pela rota da cerimonialista: troca para casal e vai a /app.
  await first.goto(`/cerimonialista/casamentos/${own}`);
  await expect(first).toHaveURL(/\/app$/);

  // A segunda aba segue na versão da cerimonialista, e o grupo entra no casamento de Ana e Marcos.
  const dias = `Família Dias ${letters()}`;
  await newGroup({ page: second, name: dias, guest: 'Paulo Dias' });
  await expect.poll(() => partyWedding(dias)).toBe(collab);
  await second.goto(`/cerimonialista/casamentos/${collab}/site/nossa-historia`);
  await expect(second.getByRole('button', { name: 'Aplicar modelo' })).toBeVisible();
});

test('dois casamentos em duas abas: o grupo entra no casamento da aba (RN01)', async ({
  context,
}) => {
  const { email, weddings } = await plannerWith({ owned: false, collaborating: 2 });
  const [ana, fernanda] = weddings;
  const first = await context.newPage();
  await signInPlanner({ page: first, email });
  await first.goto(`/cerimonialista/casamentos/${ana}/convidados`);
  const second = await context.newPage();
  await second.goto(`/cerimonialista/casamentos/${fernanda}/convidados`);
  const name = `Primos ${letters()}`;
  await newGroup({ page: second, name, guest: 'Lucas Alves' });
  await expect.poll(() => partyWedding(name)).toBe(fernanda);
});

test('o casal remove a cerimonialista: o salvar seguinte volta a Meus casamentos, e a central tem o aviso (RN07)', async ({
  page,
  browser,
}) => {
  const { email, weddings, ownerId } = await plannerWith({ owned: false, collaborating: 1 });
  const [weddingId] = weddings;
  await signInPlanner({ page, email });
  await page.goto(`/cerimonialista/casamentos/${weddingId}/convidados/novo`);
  const lost = `Grupo perdido ${letters()}`;
  await page.getByRole('textbox', { name: 'Nome do grupo' }).fill(lost);
  await page
    .getByRole('group', { name: 'Convidados' })
    .getByRole('textbox', { name: 'Nome' })
    .first()
    .fill('Rui Alves');

  // O casal remove a cerimonialista enquanto ela edita (Papéis RN02).
  const { rows } = await db.query<{ email: string }>('select email from users where id = $1', [
    ownerId,
  ]);
  const ownerContext: BrowserContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await signInCouple({ page: owner, email: rows[0]?.email ?? '' });
  const members = (await (
    await owner.request.get(`${API_URL}/v1/weddings/${weddingId}/memberships`, { headers: APP })
  ).json()) as { members: { id: string; role: string }[] };
  const planner = members.members.find((member) => member.role === 'collaborator');
  const removed = await owner.request.delete(
    `${API_URL}/v1/weddings/${weddingId}/memberships/${planner?.id ?? ''}`,
    { headers: APP },
  );
  expect(removed.ok()).toBe(true);
  await ownerContext.close();

  await page.getByRole('button', { name: 'Salvar grupo' }).click();
  await expect(page).toHaveURL(/\/cerimonialista$/);
  await expect(toast({ page, text: 'Este casamento não está mais disponível.' })).toBeVisible();
  expect(await partyWedding(lost)).toBeUndefined();
  await page.goto('/cerimonialista/notificacoes');
  await expect(
    page.getByRole('button', { name: /^Sua colaboração em Ana e Marcos foi encerrada/ }),
  ).toBeVisible();
});
