import { expect, test } from '@playwright/test';
import { signIn } from './support/app';
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

test.describe('Dashboard do casal (RN01 a RN06)', () => {
  test('sem convidados, antes de publicar e publicado: os cartões, o Checklist e os Envios', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const email = `e2e-dashboard-${unique()}@exemplo.kore.local`;
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

    // Sem convidados (RN06): o vazio, o Status do site e o Checklist.
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Olá, Ana', level: 1 })).toBeVisible();
    await expect(
      page.getByText(/^Faltam \d+ dias para o casamento · sáb\., 15 de mai\./),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Vocês ainda não cadastraram convidados.' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar convites' })).toBeDisabled();
    await expect(page.getByText('Publiquem o site para começar os envios.')).toBeVisible();
    const checklist = page.getByRole('heading', { name: 'Checklist' }).locator('..');
    await expect(checklist.getByRole('listitem').first()).toHaveAttribute('data-state', 'next');

    // Com grupos, ainda em rascunho (RN02, RN03).
    const newParty = async (name: string, guests: string[]) =>
      (await (
        await page.request.post(`${API_URL}/v1/weddings/${weddingId}/parties`, {
          headers: APP,
          data: { name, guests: guests.map((guest) => ({ name: guest })) },
        })
      ).json()) as { id: string };
    const moreira = await newParty('Família Moreira', ['Célia Moreira', 'Pedro Moreira']);
    await newParty('Tio Jorge', ['Jorge Moreira']);
    await page.reload();
    await expect(page.getByRole('link', { name: /^Convidados 3 / })).toContainText(
      'em 2 grupos · 3 pendentes',
    );
    await expect(page.getByRole('link', { name: /^Taxa de resposta 0% / })).toContainText(
      '0 de 3 responderam · sem prazo',
    );
    await expect(page.getByText('Os envios começam depois de publicar o site.')).toBeVisible();
    await expect(checklist.getByRole('listitem').first()).toHaveAttribute('data-state', 'done');

    // Publicado, com um convite enviado (RN02, RN03).
    await db.query(
      `update weddings set status = 'published', published_at = now(), end_date = '2027-08-15',
         publication_source = 'courtesy' where id = $1`,
      [weddingId],
    );
    const marked = await page.request.post(`${API_URL}/v1/weddings/${weddingId}/deliveries`, {
      headers: APP,
      data: { kind: 'invite', channel: 'link', partyIds: [moreira.id] },
    });
    expect(marked.ok()).toBe(true);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Enviar convites' })).toBeEnabled();
    const delivery = page.getByRole('heading', { name: 'Envios', level: 2 }).locator('..');
    await expect(delivery.getByRole('link')).toHaveText([
      'Não enviado1',
      'Enviado1',
      'Visualizado0',
      'Respondido0',
    ]);
    await expect(checklist).toContainText('Enviar os convites (1 de 2 grupos)');
    await expect(checklist).toContainText('Lembrar os pendentes (1 grupo)');
    const site = page.getByRole('heading', { name: 'Status do site' }).locator('..');
    await expect(site).toContainText('Publicado');
    await expect(site).toContainText('No ar até 15 de ago. de 2027.');

    // O status tocado abre Enviar convites com o filtro (RN02).
    await delivery.getByRole('link', { name: /^Enviado 1$/ }).click();
    await expect(page).toHaveURL(/\/app\/envios\/convites\?envio=enviado$/);
    await expect(page.getByRole('checkbox', { name: /Família Moreira/ })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Tio Jorge/ })).toHaveCount(0);
  });
});
