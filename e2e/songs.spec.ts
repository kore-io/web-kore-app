import { readFile } from 'node:fs/promises';
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

test.describe('Pergunta de música e Músicas (Música RN01 a RN06)', () => {
  // A data da sugestão sai na hora do aparelho: o teste fixa a do casamento.
  test.use({ timezoneId: 'America/Sao_Paulo' });

  test('ligar a pergunta, a Sidebar, a lista sem juntar repetidas, o Exportar e desligar', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const email = `e2e-musica-${unique()}@exemplo.kore.local`;
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
    // No celular (o padrão dos E2E), a Sidebar fica no menu.
    const songsInMenu = async () => {
      await page.getByRole('button', { name: 'Abrir menu' }).click();
      const link = page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link', {
        name: 'Músicas',
      });
      const count = await link.count();
      return { link, count };
    };
    const closeMenu = () => page.getByRole('button', { name: 'Fechar menu' }).click();

    // Desligada: sem Músicas na Sidebar, e o caminho leva ao Editor (RN03).
    await page.goto('/app/musicas');
    await expect(page).toHaveURL(/\/app\/site\/pergunta-de-musica$/);
    expect((await songsInMenu()).count).toBe(0);
    await closeMenu();
    const field = page.getByRole('textbox', { name: 'Texto da pergunta' });
    await expect(field).toBeDisabled();
    await expect(field).toHaveValue('Que música não pode faltar na festa?');

    // Ligar e trocar o texto (RN01).
    await page.getByRole('switch', { name: 'Fazer a pergunta no RSVP' }).check({ force: true });
    await field.fill('Qual música faz você dançar?');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(toast({ page, text: 'Alterações salvas.' })).toBeVisible();
    const { rows: wedding } = await db.query<{ enabled: boolean; text: string | null }>(
      `select song_question_enabled as enabled, song_question_text as text from weddings where id = $1`,
      [weddingId],
    );
    expect(wedding[0]).toEqual({ enabled: true, text: 'Qual música faz você dançar?' });

    // Músicas vazia: o Empty State e o Exportar desabilitado com o motivo (RN05, RN06).
    const menu = await songsInMenu();
    await expect(menu.link).toBeVisible();
    await menu.link.click();
    await expect(page).toHaveURL(/\/app\/musicas$/);
    await expect(page.getByText('Ainda não há sugestões', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exportar para o DJ' })).toBeDisabled();

    // Duas sugestões iguais e uma diferente, confirmadas, com horas diferentes.
    const party = (await (
      await page.request.post(`${API_URL}/v1/weddings/${weddingId}/parties`, {
        headers: APP,
        data: {
          name: 'Família Moreira',
          guests: [{ name: 'Célia Moreira' }, { name: 'Pedro Moreira' }, { name: 'Luiz Moreira' }],
        },
      })
    ).json()) as { id: string };
    const songs: [string, string, string][] = [
      ['Célia Moreira', 'Evidências', '2026-09-12T20:14:00-03:00'],
      ['Pedro Moreira', 'Evidências', '2026-09-12T21:00:00-03:00'],
      ['Luiz Moreira', 'Garota de Ipanema', '2026-09-13T10:05:00-03:00'],
    ];
    for (const [name, song, at] of songs) {
      await db.query(
        `update guests set rsvp_status = 'confirmed', responded_at = $4, song_suggestion = $3,
           song_suggested_at = $4 where party_id = $1 and name = $2`,
        [party.id, name, song, at],
      );
    }
    await page.reload();
    // No celular, o cabeçalho da tabela some (cartões): conta só as linhas do corpo.
    const rows = page.getByRole('table', { name: 'Músicas' }).locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Evidências');
    await expect(rows.nth(0)).toContainText('Célia Moreira');
    await expect(rows.nth(0)).toContainText('Família Moreira');
    await expect(rows.nth(0)).toContainText('12/09 às 20h14');
    await expect(rows.nth(1)).toContainText('Evidências');
    await expect(rows.nth(1)).toContainText('Pedro Moreira');
    await expect(rows.nth(2)).toContainText('Garota de Ipanema');

    // Exportar para o DJ: o .xlsx na hora e o Toast (RN06).
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportar para o DJ' }).click(),
    ]);
    expect(file.suggestedFilename()).toMatch(/^musicas-.+\.xlsx$/);
    const bytes = await readFile((await file.path()) ?? '');
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
    await expect(toast({ page, text: 'Lista exportada.' })).toBeVisible();

    // Desligar só esconde (RN02): Músicas some e as sugestões ficam no banco.
    await page.goto('/app/site/pergunta-de-musica');
    await page.getByRole('switch', { name: 'Fazer a pergunta no RSVP' }).uncheck({ force: true });
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(toast({ page, text: 'Alterações salvas.' })).toBeVisible();
    await expect
      .poll(async () => {
        const { count } = await songsInMenu();
        await closeMenu();
        return count;
      })
      .toBe(0);
    const { rows: kept } = await db.query<{ count: string }>(
      `select count(*) from guests where party_id = $1 and song_suggestion is not null`,
      [party.id],
    );
    expect(kept[0]?.count).toBe('3');
  });
});
