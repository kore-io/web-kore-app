import { expect, test } from '@playwright/test';
import { SITE_ORIGIN } from '../playwright.config';
import { connectBackoffice, unique, type Db } from './support/backoffice';

let db: Db;

test.beforeAll(async () => {
  db = await connectBackoffice();
});

test.afterAll(async () => {
  await db.end();
});

test.describe('Simule (B5a; Simule RN01 a RN11; decisão 226)', () => {
  test('do Passo 1 ao Pronto, com a prévia, o Retomar ao voltar, e o rascunho no fragmento do app', async ({
    page,
  }) => {
    const since = new Date();
    await page.goto(`${SITE_ORIGIN}/simule?origem=site&utm_source=instagram`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Como vocês se chamam?' }),
    ).toBeVisible();
    await page.getByRole('textbox', { name: 'Seu nome' }).fill('Ana');
    await page.getByRole('textbox', { name: 'Nome do seu amor' }).fill('Marcos');
    await expect(page.locator('.kore-simule-preview__names')).toHaveText('Ana & Marcos');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByLabel('Data do casamento').fill('2027-05-15');
    await page.getByRole('textbox', { name: 'Cidade' }).fill('Campinas (SP)');
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Fecha e volta: o Retomar abre no passo em que parou (RN06).
    await expect(page.getByRole('heading', { name: 'Qual é o estilo de vocês?' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Continuar de onde pararam?' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar de onde pararam' }).click();
    await expect(page.getByRole('heading', { name: 'Qual é o estilo de vocês?' })).toBeVisible();

    await page.getByRole('radio', { name: 'Marinho' }).locator('..').click();
    await page.getByRole('radio', { name: 'Moderno' }).locator('..').click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Pular este passo' }).click();
    await expect(
      page.getByRole('heading', { name: 'O site de vocês já tem cara de casamento' }),
    ).toBeVisible();

    // Criar com e-mail leva ao Cadastro do app com o rascunho no fragmento (RN08).
    await page.getByRole('button', { name: /^Criar com e\W*mail$/ }).click();
    await expect(page).toHaveURL(/^http:\/\/localhost:5173\/cadastro/);

    // As métricas anônimas chegaram, cada uma uma vez e sem nada além do nome (RN11).
    await expect
      .poll(async () => {
        const { rows } = await db.query<{
          name: string;
          wedding_ref: string | null;
          props: unknown;
        }>(
          'select name, wedding_ref, props from product_events where created_at >= $1 and name::text like $2 order by created_at',
          [since, 'simule_%'],
        );
        return rows;
      })
      .toEqual([
        { name: 'simule_iniciado', wedding_ref: null, props: null },
        { name: 'simule_nomes', wedding_ref: null, props: null },
        { name: 'simule_pronto', wedding_ref: null, props: null },
      ]);
  });
  test('do Simule ao casamento criado com a aparência, pelo Continuar com Google (B5b; Cadastro RN12; Simule RN08 a RN10)', async ({
    page,
  }) => {
    await page.goto(`${SITE_ORIGIN}/simule?origem=site&utm_source=instagram`);
    const run = unique();
    await page.getByRole('textbox', { name: 'Seu nome' }).fill(`Ana${run}`);
    await page.getByRole('textbox', { name: 'Nome do seu amor' }).fill('Marcos');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('checkbox', { name: 'Ainda não sabemos a data' }).locator('..').click();
    await page.getByRole('textbox', { name: 'Cidade' }).fill('Campinas');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('radio', { name: 'Marinho' }).locator('..').click();
    await page.getByRole('radio', { name: 'Moderno' }).locator('..').click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Pular este passo' }).click();

    // Continuar com Google: o login começa sozinho e volta aos Dados do casamento.
    await page.getByRole('button', { name: 'Continuar com Google' }).click();
    await page.getByLabel('E-mail').fill(`e2e-simule-${run}@exemplo.kore.local`);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: 'Conte sobre o casamento' })).toBeVisible();
    await expect(page).toHaveURL(/\/cadastro$/);
    await expect(page.getByRole('textbox', { name: 'Seu nome' })).toHaveValue(`Ana${run}`);
    await expect(page.getByRole('textbox', { name: 'Seu nome' })).toHaveAccessibleDescription(
      'Veio do simulador. Confira se é o seu.',
    );
    await expect(page.getByLabel('Data do casamento')).toHaveValue('');
    await expect(page.getByRole('group', { name: 'Aparência do simulador' })).toContainText(
      'Marinho · Moderno',
    );
    await page.getByRole('radio', { name: 'Noiva' }).locator('..').click();
    await page.getByRole('combobox', { name: 'UF' }).selectOption('SP');
    await expect(page.getByRole('button', { name: 'Criar nosso site' })).toBeEnabled();
    await page.getByRole('button', { name: 'Criar nosso site' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Convide Marcos' })).toBeVisible();

    // O casamento nasceu com a aparência do simulador e a origem do rodapé (RN10).
    const {
      rows: [wedding],
    } = await db.query<Record<string, unknown>>(
      `select w.signup_source, w.utm_source, w.font_pair_key, w.starter_palette_key, w.primary_color,
              w.background_mode, w.appearance_set_at is not null as appearance_set
         from weddings w join partners p on p.wedding_id = w.id
        where p.display_name = $1`,
      [`Ana${run}`],
    );
    expect(wedding).toMatchObject({
      signup_source: 'made_with_kore',
      utm_source: 'instagram',
      font_pair_key: 'moderno',
      starter_palette_key: 'marinho',
      background_mode: 'light',
      appearance_set: true,
    });
    // E o rascunho saiu do app.
    expect(
      await page.evaluate(() => window.localStorage.getItem('kore.simulatorDraft')),
    ).toBeNull();
  });
});
