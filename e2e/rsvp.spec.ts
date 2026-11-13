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

/**
 * Um casamento publicado com a Família Nunes (Carla e Rafael, mais uma vaga de
 * acompanhante), o prazo e o WhatsApp do casal. A publicação vai direto no banco: o
 * fluxo dela tem o próprio E2E (publication.spec).
 */
async function publishedWithParty({ page }: { page: import('@playwright/test').Page }) {
  const email = `e2e-rsvp-${unique()}@exemplo.kore.local`;
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
  const api = (path: string) => `${API_URL}/v1/weddings/${weddingId}${path}`;
  await page.request.patch(api('/site'), {
    headers: APP,
    data: { contactWhatsapp: '+5519987654521' },
  });
  const party = (await (
    await page.request.post(api('/parties'), {
      headers: APP,
      data: {
        name: 'Família Nunes',
        guests: [{ name: 'Carla Nunes' }, { name: 'Rafael Nunes' }],
        plusOneSlots: 1,
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
  return { weddingId, party, slug: rows[0]?.slug ?? '' };
}

test.describe('Confirmar presença (RN01 a RN11; decisão 232)', () => {
  test('o grupo responde pelo link: os erros, o envio, a confirmação e Alterar respostas; o que muda no banco', async ({
    page,
    browser,
  }) => {
    test.slow();
    const { party, slug } = await publishedWithParty({ page });
    const guest = await (await browser.newContext()).newPage();
    await guest.goto(party.link.url);
    await expect(guest.getByText('Convite para Família Nunes')).toBeVisible();

    // A faixa leva à página do RSVP (232(1)).
    await guest.getByRole('link', { name: 'Confirmar presença' }).first().click();
    await expect(guest).toHaveURL(`${SITE_ORIGIN}/${slug}/confirmar-presenca`);
    await expect(
      guest.getByRole('heading', { name: 'Confirmar presença', level: 1 }),
    ).toBeVisible();
    await expect(guest.getByText('Vocês podem responder até 30 de abr. de 2027.')).toBeVisible();

    // Sem respostas: os erros, sem gravar (RN04, RN06).
    await guest.getByRole('button', { name: 'Enviar respostas' }).click();
    await expect(
      guest.getByText('Falta a resposta de Carla Nunes. Marquem Vou ou Não vou.'),
    ).toBeVisible();
    await expect(guest.getByText('Escolham quem está respondendo.')).toBeVisible();

    const carla = guest.getByRole('group', { name: 'Carla Nunes' });
    await carla.getByText('Vou', { exact: true }).click();
    await guest.getByRole('textbox', { name: 'Restrição alimentar (opcional)' }).fill('sem glúten');
    await guest
      .getByRole('group', { name: 'Rafael Nunes' })
      .getByText('Não vou', { exact: true })
      .click();
    await guest
      .getByRole('group', { name: 'Vocês podem levar 1 acompanhante' })
      .getByText('Vou levar', { exact: true })
      .click();
    await guest
      .getByRole('group', { name: 'Quem está respondendo?' })
      .getByText('Carla', { exact: true })
      .click();
    await guest.getByRole('button', { name: 'Enviar respostas' }).click();
    await expect(guest.getByText('Informem o nome do acompanhante.')).toBeVisible();
    await guest.getByRole('textbox', { name: 'Nome do acompanhante' }).fill('Rita Lopes');
    await guest.getByRole('button', { name: 'Enviar respostas' }).click();

    await expect(guest.getByText('Vocês confirmaram 2 pessoas.')).toBeVisible();
    await expect(guest.getByText('Dá para alterar até 30 de abr. de 2027.')).toBeVisible();

    // O que ficou gravado (RN05, RN07).
    const { rows: guests } = await db.query<{
      name: string | null;
      rsvp_status: string;
      is_plus_one: boolean;
    }>(
      `select name, rsvp_status, is_plus_one from guests where party_id = $1 and deleted_at is null order by is_plus_one, name`,
      [party.id],
    );
    expect(guests).toEqual([
      { name: 'Carla Nunes', rsvp_status: 'confirmed', is_plus_one: false },
      { name: 'Rafael Nunes', rsvp_status: 'declined', is_plus_one: false },
      { name: 'Rita Lopes', rsvp_status: 'confirmed', is_plus_one: true },
    ]);
    const { rows: parties } = await db.query<{ delivery_status: string; version: number }>(
      'select delivery_status, version from parties where id = $1',
      [party.id],
    );
    expect(parties[0]?.delivery_status).toBe('responded');

    // Alterar respostas reabre o formulário preenchido (RN09).
    await guest.getByRole('button', { name: 'Alterar respostas' }).click();
    await expect(
      guest.getByRole('group', { name: 'Rafael Nunes' }).getByRole('radio', { name: 'Não vou' }),
    ).toBeChecked();

    // O grupo mudou entre abrir e enviar: o 409 recarrega com as respostas atuais (RN07).
    await db.query('update parties set version = version + 1 where id = $1', [party.id]);
    await guest
      .getByRole('group', { name: 'Rafael Nunes' })
      .getByText('Vou', { exact: true })
      .click();
    await guest.getByRole('button', { name: 'Enviar respostas' }).click();
    await expect(guest.getByRole('alert')).toContainText(
      'As respostas deste grupo mudaram enquanto vocês preenchiam.',
    );
    await expect(
      guest.getByRole('group', { name: 'Rafael Nunes' }).getByRole('radio', { name: 'Não vou' }),
    ).toBeChecked();
  });

  test('depois do prazo, só leitura com o contato; o visitante volta ao Início (RN08; 232(1))', async ({
    page,
    browser,
  }) => {
    const { weddingId, party, slug } = await publishedWithParty({ page });
    await db.query(`update weddings set rsvp_deadline = current_date - 1 where id = $1`, [
      weddingId,
    ]);
    const guest = await (await browser.newContext()).newPage();
    await guest.goto(party.link.url);
    await expect(guest.getByText('Convite para Família Nunes')).toBeVisible();
    await guest.goto(`${SITE_ORIGIN}/${slug}/confirmar-presenca`);
    await expect(
      guest.getByText('O prazo terminou. Se algo mudou, fale com o casal.'),
    ).toBeVisible();
    await expect(guest.getByText('WhatsApp do casal:', { exact: false })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Enviar respostas' })).toHaveCount(0);

    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`${SITE_ORIGIN}/${slug}/confirmar-presenca`);
    await expect(visitor).toHaveURL(`${SITE_ORIGIN}/${slug}`);
    await expect(visitor.getByRole('link', { name: 'Confirmar presença' })).toHaveCount(0);
  });
});
