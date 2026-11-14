import { expect, test, type Page } from '@playwright/test';
import { codeFrom, latestEmail, newEmail } from './mailpit';
import {
  connectBackoffice,
  createPlanner,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

/*
 * Meus casamentos (D4a da F6; Meus casamentos RN01, RN02, RN12 e RN13): a lista que a API
 * monta pela RLS (só os casamentos em que ela colabora), a busca e o filtro no app, o Alert
 * do perfil mínimo e o vazio. Os alertas pedem casamento publicado com prazo e grupos, que o
 * app sozinho não cria na F6: ficam nos testes unitários e no e2e da API.
 */

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

/** No celular, a lista é de cartões: um link por casamento. */
const card = ({ page, couple }: { page: Page; couple: string }) =>
  page.getByRole('link', { name: new RegExp(`^${couple}`) });

test.describe('Meus casamentos (/cerimonialista)', () => {
  test('a lista só com os casamentos em que ela colabora, a busca e o filtro (RN01, RN02)', async ({
    page,
  }) => {
    const email = newEmail({ label: `meus-${unique()}` });
    const userId = await createUser({ db, email, name: 'Juliana Prado' });
    const creditName = `Prado Assessoria ${letters()}`;
    const referrerId = await createPlanner({ db, userId, creditName });
    const suffix = letters();
    const fernanda = `Fernanda${suffix}`;
    const gabriela = `Gabriela${suffix}`;
    await createWedding({
      db,
      partners: [fernanda, 'João Lima'],
      eventDate: '2027-01-30',
      city: 'Vinhedo',
      status: 'awaiting_couple',
      createdByUserId: userId,
      collaboratorIds: [userId],
      referrerId,
    });
    await createWedding({
      db,
      partners: [gabriela, 'Rafael Souza'],
      eventDate: '2027-04-17',
      city: 'Sumaré',
      status: 'draft',
      createdByUserId: userId,
      collaboratorIds: [userId],
      referrerId,
    });
    // De outra assessoria: não entra (RN01).
    const otherId = await createUser({
      db,
      email: newEmail({ label: `outra-${unique()}` }),
      name: 'Carla Nunes',
    });
    await createWedding({
      db,
      partners: [`Outra${suffix}`, 'Pessoa'],
      eventDate: '2027-02-10',
      city: 'Campinas',
      status: 'draft',
      createdByUserId: otherId,
      collaboratorIds: [otherId],
    });

    await signIn({ page, email });
    await expect(page.getByRole('heading', { level: 1, name: 'Meus casamentos' })).toBeVisible();
    await expect(page.getByText(`2 casamentos da ${creditName} · 2 ativos`)).toBeVisible();
    await expect(card({ page, couple: `${fernanda} e João` })).toContainText(
      '30/01/2027 · Vinhedo (SP)',
    );
    await expect(card({ page, couple: `${fernanda} e João` })).toContainText('Aguardando o casal');
    await expect(card({ page, couple: `${gabriela} e Rafael` })).toContainText('Rascunho');
    await expect(card({ page, couple: `Outra${suffix}` })).toHaveCount(0);

    // A busca e o filtro rodam no app (RN02).
    await page.getByRole('searchbox', { name: 'Buscar pelo nome do casal' }).fill(gabriela);
    await expect(page.getByText('1 de 2 casamentos')).toBeVisible();
    await expect(card({ page, couple: `${fernanda} e João` })).toHaveCount(0);
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await page.getByRole('combobox', { name: 'Status' }).selectOption('awaiting_couple');
    await expect(card({ page, couple: `${gabriela} e Rafael` })).toHaveCount(0);
    await expect(card({ page, couple: `${fernanda} e João` })).toBeVisible();

    // A linha leva ao casamento dela (até o D4b, o Dashboard).
    await card({ page, couple: `${fernanda} e João` }).click();
    await expect(page).toHaveURL(/\/cerimonialista\/casamentos\/[0-9a-f-]+$/);
  });

  test('o perfil mínimo e o vazio: o Alert com Abrir Meu perfil e o Copiar link (RN12, RN13)', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const email = newEmail({ label: `vazio-${unique()}` });
    const userId = await createUser({ db, email, name: 'Clara Dias' });
    // O perfil mínimo do convite: sem cidades e sem os Termos (Cadastro e perfil RN10).
    await createPlanner({ db, userId, creditName: `Clara Dias ${letters()}` });
    await signIn({ page, email });
    await expect(page.getByText('Completar os dados profissionais')).toBeVisible();
    await expect(page.getByText('Você ainda não tem casamentos.')).toBeVisible();
    await page.getByRole('button', { name: 'Copiar link de indicação' }).click();
    await expect(
      page.getByRole('region', { name: /^Avisos/ }).getByText('Link copiado.'),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Abrir Meu perfil' }).click();
    await expect(page).toHaveURL(/\/cerimonialista\/perfil$/);
  });
});
