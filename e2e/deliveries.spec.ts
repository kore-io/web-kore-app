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

test.describe('Envios (RN01 a RN08; decisão 235)', () => {
  test('o convite pelo WhatsApp: grupos, mensagem editada, a fila e o envio marcado; o save the date por Copiar link', async ({
    page,
    context,
  }) => {
    // O convite inteiro e o save the date: um fluxo longo contra a API.
    test.setTimeout(240_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    // O clique abre o wa.me numa aba: o teste guarda a URL em vez de sair do app.
    await page.addInitScript(() => {
      (window as unknown as { opened: string[] }).opened = [];
      window.open = (url?: string | URL) => {
        (window as unknown as { opened: string[] }).opened.push(String(url));
        return null;
      };
    });
    const email = `e2e-envios-${unique()}@exemplo.kore.local`;
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
    const newParty = async (name: string, phone: string | null) =>
      (await (
        await page.request.post(`${API_URL}/v1/weddings/${weddingId}/parties`, {
          headers: APP,
          data: { name, guests: [{ name: `${name} contato`, ...(phone && { phone }) }] },
        })
      ).json()) as { id: string };
    const moreira = await newParty('Família Moreira', '+5519998763310');
    const jorge = await newParty('Tio Jorge', null);

    // Antes de publicar: a legenda e o Continuar desabilitado (RN01).
    await page.goto('/app/envios');
    await expect(page).toHaveURL(/\/app\/envios\/convites$/);
    await expect(page.getByText('Publiquem o site para começar os envios.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();

    await db.query(
      `update weddings set status = 'published', published_at = now(), end_date = '2027-08-15',
         publication_source = 'courtesy' where id = $1`,
      [weddingId],
    );
    await page.reload();
    await page.getByRole('checkbox', { name: /Família Moreira/ }).check({ force: true });
    await page.getByRole('checkbox', { name: /Tio Jorge/ }).check({ force: true });
    await expect(page.getByText('2 grupos marcados')).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Canal e mensagem (RN05, RN06): a prévia do servidor e a mensagem guardada.
    await expect(page).toHaveURL(/etapa=canal/);
    await expect(page.getByText(/^Prévia · /)).toBeVisible();
    const message = page.getByRole('textbox', { name: 'Mensagem' });
    await message.fill('Oi, {nome_do_grupo}! Confirme por aqui: {link}');
    await page.getByRole('button', { name: 'Ir para a fila (2 grupos)' }).click();
    await expect(page).toHaveURL(/etapa=fila/);

    // A fila (RN07): o contador, o grupo sem telefone e o envio pelo WhatsApp.
    await expect(page.getByText('0 de 2 enviados')).toBeVisible();
    const jorgeCard = page.getByRole('listitem').filter({ hasText: 'Tio Jorge' });
    await expect(jorgeCard.getByText(/O contato deste grupo não tem telefone/)).toBeVisible();
    const moreiraCard = page.getByRole('listitem').filter({ hasText: 'Família Moreira' });
    await moreiraCard.getByRole('button', { name: 'Abrir WhatsApp' }).click();
    const opened = await page.evaluate(() => (window as unknown as { opened: string[] }).opened);
    expect(opened[0]).toMatch(
      /^https:\/\/wa\.me\/5519998763310\?text=Oi%2C%20Fam%C3%ADlia%20Moreira!/,
    );
    expect(decodeURIComponent(opened[0] ?? '')).toContain('/grupo/');
    await expect(moreiraCard.getByRole('button', { name: 'Enviar de novo' })).toBeVisible();
    await expect(page.getByText('1 de 2 enviados')).toBeVisible();
    await expect
      .poll(async () => {
        const { rows } = await db.query<{ delivery_status: string; last_channel: string }>(
          'select delivery_status, last_channel from parties where id = $1',
          [moreira.id],
        );
        return rows[0];
      })
      .toEqual({ delivery_status: 'sent', last_channel: 'whatsapp' });
    const { rows: templates } = await db.query<{ body: string }>(
      `select body from message_templates where wedding_id = $1 and kind = 'invite'`,
      [weddingId],
    );
    expect(templates[0]?.body).toBe('Oi, {nome_do_grupo}! Confirme por aqui: {link}');

    // O save the date por Copiar link, para o Tio Jorge (RN03).
    await page.goto('/app/envios/save-the-date');
    await page.getByRole('checkbox', { name: /Tio Jorge/ }).check({ force: true });
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('radio', { name: 'Copiar link' }).check({ force: true });
    await page.getByRole('button', { name: 'Ir para a fila (1 grupo)' }).click();
    await page.getByRole('button', { name: 'Copiar mensagem' }).click();
    await expect(toast({ page, text: 'Mensagem copiada.' })).toBeVisible();
    await expect(page.getByText(/^Mensagem copiada às /)).toBeVisible();
    await expect
      .poll(async () => {
        const { rows } = await db.query<{
          save_the_date_sent_at: Date | null;
          delivery_status: string;
        }>('select save_the_date_sent_at, delivery_status from parties where id = $1', [jorge.id]);
        return rows[0]?.save_the_date_sent_at !== null && rows[0]?.delivery_status === 'not_sent';
      })
      .toBe(true);
  });
});
