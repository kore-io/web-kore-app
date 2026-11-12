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

let db: Db;

test.beforeAll(async () => {
  db = await connectBackoffice();
});

test.afterAll(async () => {
  await db.end();
});

async function newWedding() {
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
  return { weddingId, slug: row?.slug ?? '', email };
}

/** A publicação chega na F4; o E2E grava o status e o publishedAt direto (Site público RN13). */
async function publish({ weddingId }: { weddingId: string }) {
  await db.query(`update weddings set status = 'published', published_at = now() where id = $1`, [
    weddingId,
  ]);
}

test.describe('Site do casal › o bundle público na 5174 (B1; Site público RN01 a RN04, RN10)', () => {
  test('rascunho, endereço que não existe e o site publicado, com os cabeçalhos da API', async ({
    page,
  }) => {
    const { weddingId, slug } = await newWedding();

    // Rascunho: a página do Kore, sem nome do casal, e a API com 404 SITE_DRAFT.
    await page.goto(`${SITE_ORIGIN}/${slug}`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Este site ainda não foi publicado.' }),
    ).toBeVisible();
    await expect(page.getByText(/Ana|Marcos/)).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );

    // Um endereço que não existe.
    await page.goto(`${SITE_ORIGIN}/nao-existe-${unique()}`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Não encontramos este endereço.' }),
    ).toBeVisible();

    // Publicado: a Topbar, o Hero e o rodapé, nas cores do casal.
    await publish({ weddingId });
    const response = page.waitForResponse(`${API_URL}/v1/sites/${slug}`);
    await page.goto(`${SITE_ORIGIN}/${slug}`);
    const api = await response;
    expect(api.status()).toBe(200);
    const headers = api.headers();
    expect(headers['cache-control']).toBe('private, no-store');
    expect(headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(headers['access-control-allow-origin']).toBe(SITE_ORIGIN);
    expect(headers['access-control-allow-credentials']).toBe('true');

    await expect(page.getByRole('heading', { level: 1, name: 'Ana & Marcos' })).toBeVisible();
    await expect(page.getByText('sábado, 15 de maio de 2027 · Campinas (SP)')).toBeVisible();
    await expect(page.getByText(/^Faltam \d+ dias$/)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-site-fonts', 'romantico');
    // Com o Simule ligado no local, o "Feito com Kore" leva a ele (Site público RN10).
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: 'Feito com Kore' })).toHaveAttribute(
      'href',
      '/simule?origem=site',
    );
    // O menu (celular) abre pelo botão: a Cerimônia está ligada, mas vazia; a contagem
    // não entra no menu. Sem seção no menu, o botão nem aparece.
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveCount(0);
  });

  test('o app não lê o site com a sessão do casal pela origem do site (RN07)', async ({ page }) => {
    // Uma rota do app chamada pela origem do site não recebe o CORS do site.
    const response = await page.request.get(`${API_URL}/v1/me`, {
      headers: { origin: SITE_ORIGIN },
    });
    expect(response.headers()['access-control-allow-origin']).toBeUndefined();
  });
  test('o visitante: as seções do Início, o texto como foi escrito, a FAQ em sanfona e nada do grupo na resposta (B2; S3 RN04 a RN10; Site público RN05, RN13)', async ({
    page,
  }) => {
    const { weddingId, slug, email } = await newWedding();
    // O casal preenche as seções pelo Editor (a API), com o contato e dois locais.
    await signIn({ page, email });
    const app = { origin: 'http://localhost:5173' };
    const put = (type: string, data: object) =>
      page.request.put(`${API_URL}/v1/weddings/${weddingId}/site/sections/${type}`, {
        headers: app,
        data,
      });
    expect(
      (
        await put('story', {
          title: 'Como tudo começou',
          enabled: true,
          content: {
            text: 'A gente se conheceu em 2019.\n\nCinco anos depois, o pedido.',
            imageIds: [],
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await put('lodging', {
          title: 'Hospedagem e transporte',
          enabled: true,
          content: { text: '<b>oi</b> veja www.exemplo.com' },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await put('dress_code', {
          title: 'Dress code',
          enabled: true,
          content: { text: 'Passeio completo.', imageId: null },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await put('ceremony', {
          title: 'Cerimônia & Recepção',
          enabled: true,
          content: {
            venues: [
              {
                title: 'Cerimônia',
                placeName: 'Capela Nossa Senhora das Graças',
                date: '2027-05-15',
                time: '16:30',
                address: 'Rua Barão de Jaguara, 1200, Campinas, SP',
              },
            ],
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await put('faq', {
          title: 'Perguntas frequentes',
          enabled: true,
          content: {
            items: [
              { question: 'E se chover?', answer: 'Há área coberta.' },
              { question: 'Qual é o traje?', answer: 'Passeio completo, sem gravata.' },
            ],
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await page.request.patch(`${API_URL}/v1/weddings/${weddingId}/site`, {
          headers: app,
          data: { contactWhatsapp: '+5519987654521' },
        })
      ).status(),
    ).toBe(200);
    await publish({ weddingId });

    // O visitante, num navegador sem sessão.
    const visitor = await page.context().browser()?.newContext();
    if (!visitor) throw new Error('sem navegador');
    const site = await visitor.newPage();
    const response = site.waitForResponse(`${API_URL}/v1/sites/${slug}`);
    await site.goto(`${SITE_ORIGIN}/${slug}`);
    const body = JSON.stringify(await (await response).json());
    // Nada do grupo vai ao visitante: o lugar, o endereço, o horário e o contato.
    for (const secret of ['Capela', 'Barão de Jaguara', '16:30', '987654521']) {
      expect(body).not.toContain(secret);
    }

    await expect(site.getByRole('heading', { level: 2, name: 'Como tudo começou' })).toBeVisible();
    await expect(site.getByText('Cinco anos depois, o pedido.')).toBeVisible();
    await expect(site.getByText('<b>oi</b> veja www.exemplo.com')).toBeVisible();
    await expect(site.locator('#hospedagem-e-transporte').getByRole('link')).toHaveCount(0);
    await expect(
      site.getByText('Entre pelo link do seu convite para ver o local e o horário.'),
    ).toBeVisible();
    await expect(site.getByText('Capela Nossa Senhora das Graças')).toHaveCount(0);
    await expect(site.getByRole('contentinfo').getByText(/Dúvidas\?/)).toHaveCount(0);

    // A FAQ começa fechada; cada pergunta abre e fecha sozinha.
    await expect(site.getByText('Passeio completo, sem gravata.')).toBeHidden();
    await site.getByRole('button', { name: 'Qual é o traje?' }).click();
    await expect(site.getByText('Passeio completo, sem gravata.')).toBeVisible();
    await expect(site.getByText('Há área coberta.')).toBeHidden();

    // O menu leva à seção pelo título.
    await site.getByRole('button', { name: 'Abrir menu' }).click();
    await site
      .getByRole('navigation', { name: 'Menu principal' })
      .getByRole('link', { name: 'Perguntas frequentes' })
      .click();
    await expect(site).toHaveURL(new RegExp(`/${slug}#faq$`));
    await visitor.close();
  });
  test('o grupo pelo link: o token sai do endereço, a faixa, os locais com as rotas e o contato; outro grupo troca, e a lixeira volta a visitante (B3; Site público RN05, RN06)', async ({
    page,
    browser,
  }) => {
    const { weddingId, slug, email } = await newWedding();
    await signIn({ page, email });
    const app = { origin: 'http://localhost:5173' };
    const api = (path: string) => `${API_URL}/v1/weddings/${weddingId}${path}`;
    expect(
      (
        await page.request.put(api('/site/sections/ceremony'), {
          headers: app,
          data: {
            title: 'Cerimônia & Recepção',
            enabled: true,
            content: {
              venues: [
                {
                  title: 'Cerimônia',
                  placeName: 'Capela Nossa Senhora das Graças',
                  date: '2027-05-15',
                  time: '16:30',
                  address: 'Rua A & B, 10 #2',
                },
              ],
            },
          },
        })
      ).status(),
    ).toBe(200);
    await page.request.patch(api('/site'), {
      headers: app,
      data: { contactWhatsapp: '+5519987654521' },
    });
    const newParty = async (name: string) =>
      (await (
        await page.request.post(api('/parties'), {
          headers: app,
          data: { name, guests: [{ name: `${name} 1` }] },
        })
      ).json()) as { id: string; link: { url: string } };
    const moreira = await newParty('Família Moreira');
    const rocha = await newParty('Família Rocha');
    await publish({ weddingId });

    // A Família Moreira abre o link do convite.
    const guest = await browser.newContext();
    const site = await guest.newPage();
    const link = new URL(moreira.link.url);
    expect(link.origin).toBe(SITE_ORIGIN);
    await site.goto(moreira.link.url);
    await expect(site.getByText('Convite para Família Moreira')).toBeVisible();
    await expect(site).toHaveURL(`${SITE_ORIGIN}/${slug}`);
    const card = site.getByRole('listitem').filter({ hasText: 'Capela Nossa Senhora das Graças' });
    await expect(card.getByText('Sáb., 15 de mai. de 2027 · 16h30')).toBeVisible();
    await expect(
      card.getByRole('link', { name: 'Abrir no Google Maps (abre em nova aba)' }),
    ).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=Rua%20A%20%26%20B%2C%2010%20%232',
    );
    await expect(site.getByRole('contentinfo')).toContainText(
      'Dúvidas? Fale com o casal pelo WhatsApp (19) 98765-4521',
    );

    // Voltar pelo endereço sem token: o cookie do grupo continua.
    await site.goto(`${SITE_ORIGIN}/${slug}`);
    await expect(site.getByText('Convite para Família Moreira')).toBeVisible();

    // O link de outro grupo do mesmo casamento troca a identificação.
    await site.goto(rocha.link.url);
    await expect(site.getByText('Convite para Família Rocha')).toBeVisible();

    // O grupo vai para a lixeira: a próxima leitura volta a visitante.
    expect(
      (
        await page.request.post(api('/parties/trash'), {
          headers: app,
          data: { partyIds: [rocha.id] },
        })
      ).status(),
    ).toBeLessThan(300);
    await site.goto(`${SITE_ORIGIN}/${slug}`);
    await expect(
      site.getByText('Entre pelo link do seu convite para ver o local e o horário.'),
    ).toBeVisible();
    await expect(site.getByText(/Convite para/)).toHaveCount(0);

    // O link do grupo na lixeira não funciona mais; um slug errado vai ao endereço certo.
    await site.goto(rocha.link.url);
    await expect(
      site.getByRole('heading', { level: 1, name: 'Este link não funciona mais.' }),
    ).toBeVisible();
    await expect(site).toHaveURL(`${SITE_ORIGIN}/${slug}`);
    await site.goto(`${SITE_ORIGIN}/endereco-errado/grupo/${link.pathname.split('/').pop()}`);
    await expect(site.getByText('Convite para Família Moreira')).toBeVisible();
    await expect(site).toHaveURL(`${SITE_ORIGIN}/${slug}`);
    await guest.close();
  });
});
