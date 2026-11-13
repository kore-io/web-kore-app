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

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
const APP = { origin: 'http://localhost:5173' };

let db: Db;

test.beforeAll(async () => {
  db = await connectBackoffice();
});

test.afterAll(async () => {
  await db.end();
});

/**
 * O E2E das F4 e F5 de ponta a ponta (plano do front, C10): o casal envia o convite, o
 * grupo responde pelo link, e o sino, a central e o Dashboard do casal refletem a resposta.
 * A publicação vai direto no banco: o fluxo dela tem o próprio E2E, e a publicação por
 * Cortesia mudou na API (#122, Publicar e pagar RN17).
 */
test.describe('F4 e F5 de ponta a ponta (C10)', () => {
  test('enviar o convite, o grupo responder pelo link, e o sino, a central e o Dashboard refletirem', async ({
    page,
    browser,
    context,
  }) => {
    test.slow();
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const email = `e2e-f4f5-${unique()}@exemplo.kore.local`;
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
          name: 'Família Nunes',
          guests: [{ name: 'Carla Nunes' }, { name: 'Rafael Nunes' }],
        },
      })
    ).json()) as { id: string; link: { url: string } };
    await db.query(
      `update weddings set status = 'published', published_at = now(), end_date = '2027-08-15',
         publication_source = 'courtesy', rsvp_deadline = '2027-04-30' where id = $1`,
      [weddingId],
    );
    const { rows } = await db.query<{ slug: string }>('select slug from weddings where id = $1', [
      weddingId,
    ]);
    const slug = rows[0]?.slug ?? '';

    // 1. O casal envia o convite por Copiar link (Envios RN05 a RN07).
    await page.goto('/app/envios/convites');
    await page.getByRole('checkbox', { name: /Família Nunes/ }).check({ force: true });
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('radio', { name: 'Copiar link' }).check({ force: true });
    await page.getByRole('button', { name: 'Ir para a fila (1 grupo)' }).click();
    await page.getByRole('button', { name: 'Copiar mensagem' }).click();
    await expect(toast({ page, text: 'Mensagem copiada.' })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('/grupo/');
    await expect
      .poll(async () => {
        const { rows: sent } = await db.query<{ delivery_status: string }>(
          'select delivery_status from parties where id = $1',
          [party.id],
        );
        return sent[0]?.delivery_status;
      })
      .toBe('sent');

    // 2. O grupo responde pelo link do convite (RSVP RN04 a RN07).
    const guest = await (await browser.newContext()).newPage();
    await guest.goto(party.link.url);
    await guest.getByRole('link', { name: 'Confirmar presença' }).first().click();
    await expect(guest).toHaveURL(`${SITE_ORIGIN}/${slug}/confirmar-presenca`);
    await guest
      .getByRole('group', { name: 'Carla Nunes' })
      .getByText('Vou', { exact: true })
      .click();
    await guest
      .getByRole('group', { name: 'Rafael Nunes' })
      .getByText('Não vou', { exact: true })
      .click();
    await guest
      .getByRole('group', { name: 'Quem está respondendo?' })
      .getByText('Carla', { exact: true })
      .click();
    await guest.getByRole('button', { name: 'Enviar respostas' }).click();
    await expect(guest.getByText('Vocês confirmaram 1 pessoa.')).toBeVisible();
    await guest.context().close();

    // 3. O sino do casal conta a resposta e leva à central (Central RN02, RN06).
    await page.goto('/app');
    await page.getByRole('button', { name: 'Notificações, 1 não lida' }).click();
    await expect(page).toHaveURL(/\/app\/notificacoes$/);
    const item = page.getByRole('button', { name: /Família Nunes respondeu o convite/ });
    await expect(item).toContainText('1 confirmado, 1 recusado');

    // 4. O Dashboard reflete a resposta (Dashboard RN02 a RN04, RN08).
    await page.goto('/app');
    await expect(page.getByRole('link', { name: /^Convidados 2 / })).toContainText(
      'em 1 grupo · 1 confirmado e 1 recusado',
    );
    await expect(page.getByRole('link', { name: /^Taxa de resposta 100% / })).toContainText(
      '2 de 2 responderam · prazo: 30 de abr. de 2027',
    );
    const delivery = page.getByRole('heading', { name: 'Envios', level: 2 }).locator('..');
    await expect(delivery.getByRole('link', { name: /^Respondido 1 grupo$/ })).toBeVisible();
    const activity = page.getByRole('heading', { name: 'Atividade recente' }).locator('..');
    const activityItem = activity.getByRole('link', { name: /Família Nunes respondeu o convite/ });
    await expect(activityItem).toBeVisible();

    // 5. Abrir pela Atividade leva ao grupo e zera o sino (Central RN05).
    await activityItem.click();
    await expect(page).toHaveURL(new RegExp(`/app/convidados/grupos/${party.id}$`));
    await expect(page.getByRole('button', { name: 'Notificações', exact: true })).toBeVisible();
  });
});
