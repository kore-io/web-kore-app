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

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
const APP = { origin: 'http://localhost:5173' };

let db: Db;

test.beforeAll(async () => {
  db = await connectBackoffice();
});

test.afterAll(async () => {
  await db.end();
});

test.describe('Site › a prévia (B4; Pré-visualização RN01 a RN07)', () => {
  test('do Pré-visualizar do Editor ao rascunho com a barra; Ver como o grupo; o token não vale duas vezes; a prévia não grava visita', async ({
    page,
    context,
    browser,
  }) => {
    const email = `e2e-site-${unique()}@exemplo.kore.local`;
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
    const api = (path: string) => `${API_URL}/v1/weddings/${weddingId}${path}`;
    await page.request.put(api('/site/sections/ceremony'), {
      headers: APP,
      data: {
        title: 'Cerimônia & Recepção',
        enabled: true,
        content: {
          venues: [
            {
              title: 'Cerimônia',
              placeName: 'Capela Nossa Senhora das Graças',
              date: null,
              time: null,
              address: 'Rua A',
            },
          ],
        },
      },
    });
    const party = (await (
      await page.request.post(api('/parties'), {
        headers: APP,
        data: { name: 'Família Moreira', guests: [{ name: 'Luiz' }] },
      })
    ).json()) as { id: string };

    // O rascunho sem a prévia: a página do Kore.
    const outsider = await browser.newContext();
    const outside = await outsider.newPage();
    await outside.goto(`${SITE_ORIGIN}/${slug}`);
    await expect(
      outside.getByRole('heading', { level: 1, name: 'Este site ainda não foi publicado.' }),
    ).toBeVisible();

    // Pré-visualizar abre a nova aba no rascunho, como visitante.
    await page.goto('/app/site/dados-basicos');
    const created = page.waitForResponse((response) => response.url().endsWith('/site-previews'));
    const [tab] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('button', { name: 'Pré-visualizar' }).click(),
    ]);
    const { url } = (await (await created).json()) as { url: string };
    expect(url.startsWith(`${SITE_ORIGIN}/${slug}?previa=`)).toBe(true);
    await expect(tab.getByText('Prévia. O site ainda não foi publicado.')).toBeVisible();
    await expect(tab).toHaveURL(`${SITE_ORIGIN}/${slug}`);
    await expect(tab.getByRole('heading', { level: 1, name: 'Ana & Marcos' })).toBeVisible();
    await expect(
      tab.getByText('Entre pelo link do seu convite para ver o local e o horário.'),
    ).toBeVisible();

    // Ver como o grupo: os locais e a faixa do grupo.
    await tab.getByRole('radio', { name: 'Grupo' }).locator('..').click();
    await expect(
      tab.getByText('Prévia como Família Moreira. O site ainda não foi publicado.'),
    ).toBeVisible();
    await expect(tab.getByText('Convite para Família Moreira')).toBeVisible();
    await expect(
      tab.getByRole('heading', { level: 3, name: 'Capela Nossa Senhora das Graças' }),
    ).toBeVisible();

    // O mesmo token de novo (outro navegador): a prévia não vale mais.
    await outside.goto(url);
    await expect(
      outside.getByRole('heading', { level: 1, name: 'Esta prévia não vale mais.' }),
    ).toBeVisible();
    await outsider.close();

    // A prévia como grupo não grava a visita do grupo (RN07).
    const {
      rows: [visit],
    } = await db.query<{ first_viewed_at: Date | null }>(
      'select first_viewed_at from parties where id = $1',
      [party.id],
    );
    expect(visit?.first_viewed_at).toBeNull();
  });

  test('Ver como este grupo, no Painel do grupo, abre a prévia como aquele grupo', async ({
    page,
    context,
  }) => {
    const email = `e2e-site-${unique()}@exemplo.kore.local`;
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
        data: { name: 'Família Rocha', guests: [{ name: 'Bruno' }] },
      })
    ).json()) as { id: string };
    await page.goto(`/app/convidados/grupos/${party.id}`);
    const [tab] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('button', { name: 'Ver como este grupo' }).click(),
    ]);
    await expect(
      tab.getByText('Prévia como Família Rocha. O site ainda não foi publicado.'),
    ).toBeVisible();
    await expect(tab.getByText('Convite para Família Rocha')).toBeVisible();
  });
});
