import { expect, test } from '@playwright/test';
import {
  connectBackoffice,
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

test.describe('Site › Editor (decisão 214)', () => {
  test('a base: o caminho, o cabeçalho, as seções com o estado inicial e a prévia-resumo', async ({
    page,
  }) => {
    const email = `e2e-site-${unique()}@exemplo.kore.local`;
    const userId = await createUser({ db, email, name: 'Ana Beatriz Moreira' });
    await createWedding({
      db,
      partners: ['Ana Beatriz Moreira', 'Marcos Vinícius Rocha'],
      eventDate: '2027-05-15',
      city: 'Campinas',
      status: 'draft',
      createdByUserId: userId,
      owners: [userId, null],
    });
    await signIn({ page, email });

    await page.goto('/app/site');
    await expect(page).toHaveURL(/\/app\/site\/dados-basicos$/);
    await expect(page.getByRole('heading', { name: 'Site', level: 1 })).toBeVisible();
    await expect(page.getByText(/^kore\.com\.br\/e2e-[a-z0-9]+ · Rascunho$/)).toBeVisible();

    // As seções nascem pelo cadastro: Contagem e Cerimônia ligadas, as outras desligadas.
    // No celular, a lista fica na aba Seções.
    await page
      .getByRole('navigation', { name: 'Editor do site' })
      .getByRole('button', { name: 'Seções' })
      .click();
    const list = page.getByRole('navigation', { name: 'Seções' });
    await expect(list.getByRole('link')).toHaveText([
      'Dados básicosligada',
      'Aparêncialigada',
      'Nossa históriadesligada',
      'Contagem regressivaligada',
      'Cerimônia & Recepçãovazia',
      'Hospedagem e transportedesligada',
      'Dress codedesligada',
      'FAQdesligada',
    ]);

    await page
      .getByRole('navigation', { name: 'Editor do site' })
      .getByRole('button', { name: 'Prévia' })
      .click();
    const preview = page.locator('figure', { hasText: 'Prévia do site' });
    await expect(preview.getByText('Ana & Marcos')).toBeVisible();
    await expect(preview.getByText('sábado, 15 de maio de 2027 · Campinas')).toBeVisible();
    await expect(preview.getByText(/^Faltam \d+ dias$/)).toBeVisible();
    await expect(preview.getByText('Visão de visitante')).toBeVisible();

    await page
      .getByRole('navigation', { name: 'Editor do site' })
      .getByRole('button', { name: 'Seções' })
      .click();
    await list.getByRole('link', { name: /FAQ/ }).click();
    await expect(page).toHaveURL(/\/app\/site\/faq$/);
    await expect(page.getByRole('heading', { name: 'FAQ', level: 2 })).toBeVisible();
  });
  test('Dados básicos: o endereço em uso com a sugestão, salvar e reabrir (RN03 a RN06, RN10)', async ({
    page,
  }) => {
    const email = `e2e-site-${unique()}@exemplo.kore.local`;
    const userId = await createUser({ db, email, name: 'Ana Beatriz Moreira' });
    await createWedding({
      db,
      partners: ['Ana Beatriz Moreira', 'Marcos Vinícius Rocha'],
      eventDate: '2027-05-15',
      city: 'Campinas',
      status: 'draft',
      createdByUserId: userId,
      owners: [userId, null],
    });
    // Outro casamento, para o endereço em uso.
    const otherOwner = await createUser({
      db,
      email: `e2e-site-${unique()}@exemplo.kore.local`,
      name: 'Clara',
    });
    const otherId = await createWedding({
      db,
      partners: ['Clara', 'Heitor'],
      eventDate: '2027-06-01',
      city: 'Campinas',
      status: 'draft',
      createdByUserId: otherOwner,
      owners: [otherOwner, null],
    });
    const { rows } = await db.query<{ slug: string }>('select slug from weddings where id = $1', [
      otherId,
    ]);
    const taken = rows[0]?.slug ?? '';
    await signIn({ page, email });
    await page.goto('/app/site/dados-basicos');

    const slug = page.getByRole('textbox', { name: 'Endereço do site' });
    await slug.fill(taken.toUpperCase());
    await expect(slug).toHaveValue(taken);
    await expect(page.getByText(/^Este endereço já está em uso\. Que tal /)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    await page.getByRole('button', { name: /^Usar / }).click();
    const suggestion = await slug.inputValue();
    expect(suggestion).not.toBe(taken);
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeEnabled();

    await page.getByRole('textbox', { name: 'Cidade' }).fill('Valinhos');
    await page
      .getByRole('textbox', { name: 'WhatsApp do casal (opcional)' })
      .fill('(19) 99876-4521');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(toast({ page, text: 'Alterações salvas.' })).toBeVisible();
    await expect(
      page.getByText(
        new RegExp(`^kore\\.com\\.br/${suggestion} · Rascunho · salvo às \\d+h(\\d{2})?$`),
      ),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Cidade' })).toHaveValue('Valinhos');
    await expect(page.getByRole('textbox', { name: 'Endereço do site' })).toHaveValue(suggestion);
    await expect(page.getByRole('textbox', { name: 'WhatsApp do casal (opcional)' })).toHaveValue(
      '(19) 99876-4521',
    );

    // WhatsApp curto: o servidor recusa e aponta o campo.
    await page.getByRole('textbox', { name: 'WhatsApp do casal (opcional)' }).fill('9876-4521');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(
      page.getByText('O telefone tem 8 números. Usem DDD + número, ex.: (19) 99999-9999.'),
    ).toBeVisible();
  });
  test('foto de capa: o envio direto ao armazenamento, a miniatura do CDN, salvar e reabrir (Imagens RN02 a RN05; Dados básicos RN09)', async ({
    page,
  }) => {
    const email = `e2e-site-${unique()}@exemplo.kore.local`;
    const userId = await createUser({ db, email, name: 'Ana Beatriz Moreira' });
    await createWedding({
      db,
      partners: ['Ana Beatriz Moreira', 'Marcos Vinícius Rocha'],
      eventDate: '2027-05-15',
      city: 'Campinas',
      status: 'draft',
      createdByUserId: userId,
      owners: [userId, null],
    });
    await signIn({ page, email });
    await page.goto('/app/site/dados-basicos');
    await expect(page.getByRole('textbox', { name: 'Cidade' })).toBeVisible();

    // Uma foto de verdade, desenhada num canvas do próprio navegador (1600 x 1000).
    const dataUrl = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1000;
      const context = canvas.getContext('2d');
      if (!context) return '';
      const gradient = context.createLinearGradient(0, 0, 1600, 1000);
      gradient.addColorStop(0, '#A94F37');
      gradient.addColorStop(1, '#F6E6EB');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 1600, 1000);
      return canvas.toDataURL('image/jpeg', 0.9);
    });
    const buffer = Buffer.from(dataUrl.split(',')[1] ?? '', 'base64');

    // Um GIF é recusado no aparelho.
    await page
      .getByLabel(/Arrastem uma foto/)
      .setInputFiles({ name: 'a.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
    await expect(
      toast({ page, text: 'Não foi possível usar esta foto. Escolham uma foto JPG ou PNG.' }),
    ).toBeVisible();

    await page
      .getByLabel(/Arrastem uma foto/)
      .setInputFiles({ name: 'capa.jpg', mimeType: 'image/jpeg', buffer });
    const thumb = page.getByRole('img', { name: 'Ana & Marcos' });
    await expect(thumb).toBeVisible({ timeout: 15_000 });
    // A miniatura vem do bucket público, já processada (640 px).
    await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(640);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(toast({ page, text: 'Alterações salvas.' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('img', { name: 'Ana & Marcos' })).toBeVisible();
    await page.getByRole('button', { name: 'Remover foto' }).click();
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(toast({ page, text: 'Alterações salvas.' })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(/Arrastem uma foto/)).toBeAttached();
  });
  test('Aparência: paleta, fontes e fundo salvos; a cor bloqueada no app e no servidor (S2 RN03 a RN07)', async ({
    page,
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
    await page.goto('/app/site/aparencia');

    // O padrão do cadastro: Romântico, Terracota e Creme (RN02).
    await expect(page.getByRole('radio', { name: 'Terracota' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Creme' })).toBeChecked();

    await page.getByRole('radio', { name: 'Noite' }).locator('..').click();
    await expect(page.getByRole('radio', { name: 'Escuro' })).toBeChecked();
    await page
      .getByRole('radio', { name: /Moderno/ })
      .locator('..')
      .click();
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(toast({ page, text: 'Alterações salvas.' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('radio', { name: 'Noite' })).toBeChecked();
    await expect(page.getByRole('radio', { name: /Moderno/ })).toBeChecked();
    await expect(
      page.getByRole('textbox', { name: 'Cor principal (botões)', exact: true }),
    ).toHaveValue('#E7D3B0');

    // A cor que some no fundo escuro trava o Salvar no app.
    const primary = page.getByRole('textbox', { name: 'Cor principal (botões)', exact: true });
    await primary.fill('#15171C');
    await expect(page.getByRole('alert')).toContainText('Essa cor fica pouco visível neste fundo.');
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeDisabled();

    // E o servidor recusa a mesma combinação pela mesma conta (RN05).
    const refused = await page.request.put(`${API_URL}/v1/weddings/${weddingId}/site/appearance`, {
      headers: { origin: APP_ORIGIN },
      data: {
        fontPairKey: 'moderno',
        starterPaletteKey: null,
        primaryColor: '#15171C',
        accentColor: '#9A8C7A',
        backgroundMode: 'dark',
      },
    });
    expect(refused.status()).toBe(422);
    expect((await refused.json()) as { error: string; check: string }).toMatchObject({
      error: 'CONTRAST_TOO_LOW',
      check: 'primary_background',
    });
  });
  test('Seções: FAQ, Hospedagem, desligar só esconde e o servidor confere os limites (S3 RN08, RN10 a RN12)', async ({
    page,
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

    // FAQ: liga, duas perguntas, a segunda sobe, salva e reabre.
    await page.goto('/app/site/faq');
    await page.getByRole('switch', { name: 'Mostrar a seção no site' }).locator('..').click();
    await expect(page.getByText(/ainda não tem conteúdo/)).toBeVisible();
    await page.getByRole('button', { name: 'Adicionar pergunta' }).click();
    await page.getByRole('textbox', { name: 'Pergunta', exact: true }).fill('E se chover?');
    await page.getByRole('textbox', { name: 'Resposta' }).fill('Há área coberta.');
    await page.getByRole('button', { name: 'Adicionar pergunta' }).click();
    await page
      .getByRole('textbox', { name: 'Pergunta', exact: true })
      .nth(1)
      .fill('Qual é o traje?');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(
      page.getByRole('textbox', { name: 'Resposta' }).nth(1),
    ).toHaveAccessibleDescription('Preencham este campo.');
    await page.getByRole('textbox', { name: 'Resposta' }).nth(1).fill('Passeio completo.');
    await page.getByRole('button', { name: 'Subir pergunta 2' }).click();
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(toast({ page, text: 'Alterações salvas.' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Pergunta', exact: true }).first()).toHaveValue(
      'Qual é o traje?',
    );
    await expect(page.getByRole('textbox', { name: 'Pergunta', exact: true }).nth(1)).toHaveValue(
      'E se chover?',
    );

    // Desligar só esconde: as perguntas continuam ao religar (RN11).
    await page.getByRole('switch', { name: 'Mostrar a seção no site' }).locator('..').click();
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(toast({ page, text: 'Alterações salvas.' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Mostrar a seção no site' })).not.toBeChecked();
    await expect(page.getByRole('textbox', { name: 'Pergunta', exact: true })).toHaveCount(2);

    // Hospedagem: o texto volta como foi escrito (RN04).
    await page.goto('/app/site/hospedagem-e-transporte');
    await page.getByRole('switch', { name: 'Mostrar a seção no site' }).locator('..').click();
    await page.getByRole('textbox', { name: 'Texto' }).fill('<b>oi</b> veja www.exemplo.com');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(toast({ page, text: 'Alterações salvas.' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Texto' })).toHaveValue(
      '<b>oi</b> veja www.exemplo.com',
    );

    // O servidor confere o limite (RN12).
    const refused = await page.request.put(
      `${API_URL}/v1/weddings/${weddingId}/site/sections/lodging`,
      {
        headers: { origin: APP_ORIGIN },
        data: {
          title: 'Hospedagem e transporte',
          enabled: true,
          content: { text: 'a'.repeat(5001) },
        },
      },
    );
    expect(refused.status()).toBe(400);
    expect(
      ((await refused.json()) as { errors: { path: string }[] }).errors.map((error) => error.path),
    ).toEqual(['content.text']);
  });
});
