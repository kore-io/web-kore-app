import { expect, test } from '@playwright/test';
import { signIn, toast } from './support/app';
import {
  connectBackoffice,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
const APP = { origin: 'http://localhost:5173' };

let db: Db;

test.beforeAll(async () => {
  db = await connectBackoffice();
});

test.afterAll(async () => {
  await db.end();
});

test.describe('Prazo de resposta e respostas pelo casal (RN01 a RN07)', () => {
  test('a dona define o prazo em Envios e altera a resposta de um convidado; o Histórico e a lista mostram', async ({
    page,
  }) => {
    test.slow();
    const email = `e2e-prazo-${unique()}@exemplo.kore.local`;
    const userId = await createUser({ db, email, name: 'Ana Beatriz Moreira' });
    const weddingId = await createWedding({
      db,
      partners: ['Ana Beatriz Moreira', 'Marcos Vinícius Rocha'],
      eventDate: '2027-05-15',
      city: 'Campinas',
      status: 'draft',
      createdByUserId: userId,
      owners: [userId, null],
    });
    await signIn({ page, email });
    const party = (await (
      await page.request.post(`${API_URL}/v1/weddings/${weddingId}/parties`, {
        headers: APP,
        data: {
          name: 'Família Moreira',
          guests: [{ name: 'Célia Moreira' }, { name: 'Pedro Moreira' }],
        },
      })
    ).json()) as { id: string };

    // Envios › Prazo de resposta (RN01 a RN03).
    await page.goto('/app/envios');
    await expect(page).toHaveURL(/\/app\/envios\/prazo$/);
    await expect(
      page.getByText('Sem prazo, os convidados respondem até o dia do casamento.'),
    ).toBeVisible();
    await page.getByLabel('Prazo de resposta').fill('2027-04-30');
    await page.getByRole('button', { name: 'Salvar prazo' }).click();
    await expect(toast({ page, text: 'Prazo salvo.' })).toBeVisible();
    await expect(page.getByText(/^Faltam \d+ dias\. No site, o grupo vê/)).toBeVisible();
    const { rows } = await db.query<{ rsvp_deadline: Date }>(
      'select rsvp_deadline from weddings where id = $1',
      [weddingId],
    );
    expect(rows[0]?.rsvp_deadline).not.toBeNull();
    // Depois do casamento: o 422 no campo.
    await page.getByLabel('Prazo de resposta').fill('2027-06-01');
    await page.getByRole('button', { name: 'Salvar prazo' }).click();
    await expect(
      page.getByText(/O prazo precisa ser até o dia do casamento, 15 de mai/),
    ).toBeVisible();

    // Alterar resposta pelo Painel (RN04), com o Histórico e o Respondido em (RN05, RN07).
    await page.goto(`/app/convidados/grupos/${party.id}`);
    await page.getByRole('button', { name: 'Ações de Pedro Moreira' }).click();
    await page.getByRole('menuitem', { name: 'Alterar resposta' }).click();
    const dialog = page.getByRole('dialog', { name: 'Alterar a resposta de Pedro Moreira' });
    await dialog.getByRole('radio', { name: 'Não vai' }).locator('..').click();
    await expect(
      dialog.getByText(
        'A restrição alimentar e a música sugerida por Pedro Moreira serão apagadas.',
      ),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Salvar resposta' }).click();
    await expect(toast({ page, text: 'Resposta alterada.' })).toBeVisible();
    const history = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Histórico' }) });
    await expect(
      history.getByText('Resposta alterada por Ana Beatriz Moreira: Pedro Moreira não vai'),
    ).toBeVisible();
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Pedro Moreira' }).getByText('Recusado'),
    ).toBeVisible();

    // Célia também: o grupo fica respondido, e a lista mostra quem alterou.
    await page.getByRole('button', { name: 'Ações de Célia Moreira' }).click();
    await page.getByRole('menuitem', { name: 'Alterar resposta' }).click();
    const celia = page.getByRole('dialog', { name: 'Alterar a resposta de Célia Moreira' });
    await celia.getByRole('radio', { name: 'Vai', exact: true }).locator('..').click();
    await celia.getByRole('textbox', { name: 'Restrição alimentar (opcional)' }).fill('sem glúten');
    await celia.getByRole('button', { name: 'Salvar resposta' }).click();
    // O Toast da primeira alteração pode ainda estar na tela.
    await expect(toast({ page, text: 'Resposta alterada.' }).last()).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const { rows: parties } = await db.query<{ delivery_status: string }>(
      'select delivery_status from parties where id = $1',
      [party.id],
    );
    expect(parties[0]?.delivery_status).toBe('responded');
    await page.goto('/app/convidados');
    await expect(page.getByText(/alterada por Ana Beatriz Moreira/)).toBeVisible();
  });
});
