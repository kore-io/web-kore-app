import { expect, test } from '@playwright/test';
import { SITE_ORIGIN } from '../playwright.config';
import { signIn } from './support/app';
import {
  connectBackoffice,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

/*
 * O site do convidado fora do ar (E15 da F3; Data de saída RN08; Bloqueado RN05; decisões 240
 * e 306(2)): pelo mesmo link do grupo, o site no ar, o RSVP só leitura na carência, a página
 * do expirado (também na exclusão agendada) e a do bloqueado, sem dado do casal. O estado vem
 * do banco.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
const APP = { origin: 'http://localhost:5173' };
const EXPIRED = 'Este site não está mais disponível.';
const UNAVAILABLE = 'Este site não está disponível no momento.';

let db: Db;
test.beforeAll(async () => {
  db = await connectBackoffice();
});
test.afterAll(async () => {
  await db.end();
});

test('o mesmo link do grupo: no ar, a carência só leitura, o expirado, a exclusão e o bloqueio', async ({
  page,
  browser,
}) => {
  test.slow();
  const email = `e2e-fora-${unique()}@exemplo.kore.local`;
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
  const {
    rows: [row],
  } = await db.query<{ slug: string }>('select slug from weddings where id = $1', [weddingId]);
  const slug = row?.slug ?? '';
  await signIn({ page, email });
  const party = (await (
    await page.request.post(`${API_URL}/v1/weddings/${weddingId}/parties`, {
      headers: APP,
      data: { name: 'Família Moreira', guests: [{ name: 'Célia Moreira' }] },
    })
  ).json()) as { link: { url: string } };
  const setState = (sql: string) =>
    db.query(`update weddings set ${sql} where id = $1`, [weddingId]);
  await setState(`status = 'published', published_at = now(), event_date = current_date + 60,
    end_date = current_date + 150,
    paid_through = current_date + 150, publication_source = 'payment'`);

  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const site = await guest.newPage();
  // No ar: o site do grupo.
  await site.goto(party.link.url);
  await expect(site.getByText('Convite para Família Moreira')).toBeVisible();

  // Carência: o site continua, e o RSVP fica só leitura (240).
  await setState(`status = 'grace', event_date = current_date - 30, end_date = current_date - 4,
    paid_through = current_date - 4, grace_until = current_date + 3`);
  await site.goto(`${SITE_ORIGIN}/${slug}/confirmar-presenca`);
  await expect(
    site.getByText('O casamento já aconteceu. As respostas ficam guardadas aqui.'),
  ).toBeVisible();

  const offPage = async (title: string) => {
    await site.goto(party.link.url);
    await expect(site.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(site.getByText(/Ana|Marcos|Moreira/)).toHaveCount(0);
    await site.goto(`${SITE_ORIGIN}/${slug}`);
    await expect(site.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await site.goto(`${SITE_ORIGIN}/${slug}/confirmar-presenca`);
    await expect(site.getByRole('heading', { level: 1, name: title })).toBeVisible();
  };

  // Expirado: a página do B1.
  await setState(`status = 'expired', grace_until = current_date - 1, expired_at = current_date`);
  await offPage(EXPIRED);

  // Exclusão agendada, com o site no ar pelo status: a mesma página do expirado (RN08).
  await setState(`status = 'published', event_date = current_date + 60, end_date = current_date + 150,
    paid_through = current_date + 150, grace_until = null, expired_at = null,
    deletion_scheduled_for = current_date + 7`);
  await offPage(EXPIRED);

  // Bloqueado: a página neutra, que não diz que foi bloqueado (RN05).
  await setState(`deletion_scheduled_for = null, blocked_at = now()`);
  await offPage(UNAVAILABLE);

  // Desbloqueado: o site volta na hora (no-store).
  await setState(`blocked_at = null`);
  await site.goto(`${SITE_ORIGIN}/${slug}`);
  await expect(site.getByText('Convite para Família Moreira')).toBeVisible();
  await guest.close();
});
