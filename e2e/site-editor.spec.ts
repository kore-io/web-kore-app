import { expect, test, type Page } from '@playwright/test';
import {
  connectBackoffice,
  createPlanner,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';
import { signIn, toast } from './support/app';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
const APP_ORIGIN = 'http://localhost:5173';

let db: Db;

test.beforeAll(async () => {
  db = await connectBackoffice();
});

test.afterAll(async () => {
  await db.end();
});

/** As 8 seções do Editor, na ordem da lista, com o caminho de cada uma (214). */
const SECTIONS = [
  ['Dados básicos', 'dados-basicos'],
  ['Aparência', 'aparencia'],
  ['Nossa história', 'nossa-historia'],
  ['Contagem regressiva', 'contagem-regressiva'],
  ['Cerimônia & Recepção', 'cerimonia-e-recepcao'],
  ['Hospedagem e transporte', 'hospedagem-e-transporte'],
  ['Dress code', 'dress-code'],
  ['FAQ', 'faq'],
] as const;

async function newCouple() {
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
  return { email, userId, weddingId };
}

/** No celular (o padrão dos E2E), a lista de seções fica na aba Seções. */
async function openFromList({ page, name }: { page: Page; name: string }) {
  await page
    .getByRole('navigation', { name: 'Editor do site' })
    .getByRole('button', { name: 'Seções' })
    .click();
  await page
    .getByRole('navigation', { name: 'Seções' })
    .getByRole('link', { name: new RegExp(`^${name.replace(/[&]/g, '\\$&')}`) })
    .click();
}

/**
 * O login da cerimonialista: na F1 ela não tem a área no app, que a leva ao Institucional
 * depois de entrar. O teste usa só a sessão, então espera o /v1/me responder.
 */
async function signInForApi({ page, email }: { page: Page; email: string }) {
  await page.goto('/entrar');
  await page.getByRole('button', { name: 'Continuar com Google' }).click();
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect
    .poll(async () =>
      (await page.request.get(`${API_URL}/v1/me`, { headers: { origin: APP_ORIGIN } })).status(),
    )
    .toBe(200);
}

const sectionList = (page: Page) => page.getByRole('navigation', { name: 'Seções' });

test.describe('Site › o Editor inteiro (A9; decisão 214)', () => {
  test('as 8 seções abrem pela lista e pelo caminho; descartar com o Dialog, também no voltar do navegador (S1 RN10, RN11)', async ({
    page,
  }) => {
    const { email } = await newCouple();
    await signIn({ page, email });
    await page.goto('/app/site');

    // Cada seção abre pela lista, com o caminho próprio e o título no painel.
    for (const [name, slug] of SECTIONS) {
      await openFromList({ page, name });
      await expect(page).toHaveURL(new RegExp(`/app/site/${slug}$`));
      await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible();
    }

    // Uma mudança sem salvar: trocar de seção pede para descartar.
    await page.goto('/app/site/hospedagem-e-transporte');
    const text = page.getByRole('textbox', { name: 'Texto' });
    await text.fill('Hotel Vitória, a 2 km da festa.');
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeEnabled();
    await openFromList({ page, name: 'FAQ' });
    const dialog = page.getByRole('alertdialog', { name: 'Descartar as alterações?' });
    await expect(dialog).toContainText(
      'O que mudou em Hospedagem e transporte ainda não foi salvo.',
    );
    await dialog.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(page).toHaveURL(/\/hospedagem-e-transporte$/);
    await page
      .getByRole('navigation', { name: 'Editor do site' })
      .getByRole('button', { name: 'Editar' })
      .click();
    await expect(text).toHaveValue('Hotel Vitória, a 2 km da festa.');

    await openFromList({ page, name: 'FAQ' });
    await dialog.getByRole('button', { name: 'Descartar alterações' }).click();
    await expect(page).toHaveURL(/\/faq$/);
    await expect(page.getByRole('heading', { name: 'FAQ', level: 2 })).toBeVisible();

    // O voltar do navegador também passa pelo Dialog.
    await page.getByRole('button', { name: 'Adicionar pergunta' }).click();
    // O Salvar habilitado mostra que a mudança já chegou ao Editor.
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeEnabled();
    await page.goBack();
    await expect(dialog).toContainText('O que mudou em Perguntas frequentes ainda não foi salvo.');
    await dialog.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(page).toHaveURL(/\/faq$/);
    await page.goBack();
    await dialog.getByRole('button', { name: 'Descartar alterações' }).click();
    await expect(page).toHaveURL(/\/hospedagem-e-transporte$/);
    // O texto descartado não foi gravado.
    await expect(page.getByRole('textbox', { name: 'Texto' })).toHaveValue('');

    // Salvar muda o estado na lista: ligada e com texto deixa de ser "desligada".
    await page.getByRole('switch', { name: 'Mostrar a seção no site' }).locator('..').click();
    await page.getByRole('textbox', { name: 'Texto' }).fill('Hotel Vitória, a 2 km da festa.');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(toast({ page, text: 'Alterações salvas.' })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Editor do site' })
      .getByRole('button', { name: 'Seções' })
      .click();
    await expect(
      sectionList(page).getByRole('link', { name: /^Hospedagem e transporte/ }),
    ).toHaveText('Hospedagem e transporteligada');
    // Depois de salvar, trocar de seção não pede nada.
    await sectionList(page)
      .getByRole('link', { name: /^Dress code/ })
      .click();
    await expect(page).toHaveURL(/\/dress-code$/);
    await expect(dialog).toHaveCount(0);
  });

  test('a cerimonialista edita pela API o que pode, a data e o endereço são do casal, e o casal vê o que ela gravou (S1 RN04; S3 RN13)', async ({
    browser,
    page,
  }) => {
    const email = `e2e-site-${unique()}@exemplo.kore.local`;
    const coupleId = await createUser({ db, email, name: 'Ana Beatriz Moreira' });
    const plannerEmail = `e2e-cerimonial-${unique()}@exemplo.kore.local`;
    const plannerId = await createUser({ db, email: plannerEmail, name: 'Juliana Prado' });
    const referrerId = await createPlanner({
      db,
      userId: plannerId,
      creditName: `Prado Assessoria ${unique()}`,
    });
    // O casamento que a cerimonialista criou e o casal já aceitou: Ana é dona, Juliana colabora.
    const weddingId = await createWedding({
      db,
      partners: ['Ana Beatriz Moreira', 'Marcos Vinícius Rocha'],
      eventDate: '2027-05-15',
      city: 'Campinas',
      status: 'draft',
      createdByUserId: plannerId,
      owners: [coupleId, null],
      collaboratorIds: [plannerId],
      referrerId,
    });

    const plannerContext = await browser.newContext();
    const planner = await plannerContext.newPage();
    await signInForApi({ page: planner, email: plannerEmail });
    const api = (path: string) => `${API_URL}/v1/weddings/${weddingId}${path}`;
    const headers = { origin: APP_ORIGIN };

    // Ela lê o Editor: a data, a UF e o endereço não são dela.
    const site = await planner.request.get(api('/site'), { headers });
    expect(site.status()).toBe(200);
    expect(((await site.json()) as { editable: Record<string, boolean> }).editable).toMatchObject({
      eventDate: false,
      state: false,
      slug: false,
    });

    // A data igual passa; a data diferente é recusada com o campo.
    const same = await planner.request.patch(api('/site'), {
      headers,
      data: { eventDate: '2027-05-15' },
    });
    expect(same.status()).toBe(200);
    const other = await planner.request.patch(api('/site'), {
      headers,
      data: { eventDate: '2027-06-01' },
    });
    expect(other.status()).toBe(403);
    expect(await other.json()).toMatchObject({ error: 'FIELD_NOT_ALLOWED' });

    // As seções são dela também (manage_site).
    const faq = await planner.request.put(api('/site/sections/faq'), {
      headers,
      data: {
        title: 'Perguntas frequentes',
        enabled: true,
        content: { items: [{ question: 'Tem estacionamento?', answer: 'Sim, com manobrista.' }] },
      },
    });
    expect(faq.status()).toBe(200);
    await plannerContext.close();

    // O casal abre a FAQ e vê o que a cerimonialista gravou; a data continua a dele.
    await signIn({ page, email });
    await page.goto('/app/site/faq');
    await expect(page.getByRole('textbox', { name: 'Pergunta', exact: true })).toHaveValue(
      'Tem estacionamento?',
    );
    await expect(page.getByRole('switch', { name: 'Mostrar a seção no site' })).toBeChecked();
    await page.goto('/app/site/dados-basicos');
    await expect(page.getByLabel('Data do casamento')).toHaveValue('2027-05-15');
  });
});
