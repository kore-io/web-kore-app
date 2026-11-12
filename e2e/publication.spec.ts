import { expect, test } from '@playwright/test';
import { SITE_ORIGIN } from '../playwright.config';
import { signIn, toast } from './support/app';
import {
  connectBackoffice,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

let db: Db;

test.beforeAll(async () => {
  db = await connectBackoffice();
});

test.afterAll(async () => {
  await db.end();
});

/** O casamento em rascunho da dona, com endereço, data e UF (pronto para publicar). */
async function draftWedding() {
  const email = `e2e-pub-${unique()}@exemplo.kore.local`;
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
  const { rows } = await db.query<{ slug: string }>(`select slug from weddings where id = $1`, [
    weddingId,
  ]);
  return { email, weddingId, slug: rows[0]?.slug ?? '' };
}

// A colaboradora com o Publicar desabilitado (RN02) fica no teste de tela: a cerimonialista
// dentro do casamento chega ao app com a F6.
test.describe('Publicação por Cortesia (RN01 a RN07)', () => {
  test('a dona publica com a data de saída do ar: o Dashboard, o site no ar e o endereço travado', async ({
    page,
  }) => {
    const { email, weddingId, slug } = await draftWedding();
    await signIn({ page, email });

    await page.goto('/app/cobranca/publicar');
    await expect(page.getByRole('heading', { name: 'Publicar o site', level: 1 })).toBeVisible();
    const endDate = page.getByLabel('Data de saída do ar');
    await expect(endDate).toHaveValue('');
    await expect(page.getByText('Depois do casamento e até 15 de mai. de 2028.')).toBeVisible();
    await expect(
      page.getByText(`Depois de publicar, o endereço kore.com.br/${slug} não muda mais.`),
    ).toBeVisible();

    // Fora da faixa: o erro do campo, sem publicar (RN04).
    await endDate.fill('2028-06-01');
    await page.getByRole('button', { name: 'Publicar' }).click();
    await expect(
      page.getByText('Escolham uma data depois do casamento e até 15 de mai. de 2028.'),
    ).toBeVisible();

    await endDate.fill('2027-08-15');
    await page.getByRole('button', { name: 'Publicar' }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(toast({ page, text: 'Site publicado.' })).toBeVisible();

    // O que a publicação grava (RN05).
    const { rows } = await db.query<{
      status: string;
      end_date: Date;
      publication_source: string;
      paid_through: Date | null;
    }>(`select status, end_date, publication_source, paid_through from weddings where id = $1`, [
      weddingId,
    ]);
    expect(rows[0]).toMatchObject({
      status: 'published',
      publication_source: 'courtesy',
      paid_through: null,
    });

    // Publicado, o caminho volta ao Dashboard, e o endereço trava no Editor (RN06).
    await page.goto('/app/cobranca/publicar');
    await expect(page).toHaveURL(/\/app$/);
    await page.goto('/app/site/dados-basicos');
    await expect(page.getByRole('textbox', { name: 'Endereço do site' })).toBeDisabled();

    // O site responde como publicado (RN06; Site público RN04).
    await page.goto(`${SITE_ORIGIN}/${slug}`);
    await expect(page.getByRole('heading', { name: 'Ana & Marcos', level: 1 })).toBeVisible();
  });
});
