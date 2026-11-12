import { expect, test } from '@playwright/test';
import { SITE_ORIGIN } from '../playwright.config';
import { connectBackoffice, type Db } from './support/backoffice';

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
});
