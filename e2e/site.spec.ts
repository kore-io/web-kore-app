import { expect, test } from '@playwright/test';
import {
  connectBackoffice,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';
import { signIn, toast } from './support/app';

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
});
