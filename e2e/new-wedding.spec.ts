import { expect, test, type Page } from '@playwright/test';
import { codeFrom, latestEmail, newEmail } from './mailpit';
import {
  connectBackoffice,
  createPlanner,
  createUser,
  unique,
  type Db,
} from './support/backoffice';

/*
 * Novo casamento (D6a e D6b da F6; Novo casamento RN01 a RN07; Penpot 05; decisões 280 e
 * 281): a cerimonialista preenche os dados, vê o endereço sugerido e livre, escolhe a
 * aparência e cria o casamento; no passo 3 gera o link ou convida depois, e o Pronto mostra o
 * caso. O Convidar o casal do detalhe volta ao passo 3 (RN07).
 */

let db: Db;
test.beforeAll(async () => {
  db = await connectBackoffice();
});
test.afterAll(async () => {
  await db.end();
});

const letters = () => unique().replace(/\d/g, (digit) => 'abcdefghij'[Number(digit)] ?? '');

async function signIn({ page, email }: { page: Page; email: string }) {
  await page.goto('/entrar');
  await page.getByRole('textbox', { name: 'E-⁠mail' }).fill(email);
  const since = new Date(Date.now() - 1000);
  await page.getByRole('button', { name: 'Receber código' }).click();
  await expect(page.getByRole('heading', { name: 'Confira seu e-⁠mail' })).toBeVisible();
  const code = codeFrom({ email: await latestEmail({ request: page.request, to: email, since }) });
  await page.keyboard.type(code);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
  await page.waitForLoadState('networkidle');
}

async function createWedding({ page }: { page: Page }): Promise<string> {
  await page.goto('/cerimonialista/casamentos/novo');
  await expect(page.getByRole('heading', { name: 'Novo casamento', level: 1 })).toBeVisible({
    timeout: 15_000,
  });
  // Os nomes com letras únicas, para o endereço sugerido não colidir com rodadas anteriores.
  const first = `Isabela${letters()}`;
  await page.getByRole('textbox', { name: 'Nome 1 de 2' }).fill(first);
  await page.getByRole('textbox', { name: 'Nome 2 de 2' }).fill('André');
  await page.getByRole('textbox', { name: 'Cidade' }).fill('Americana');
  await page.getByRole('combobox', { name: 'UF' }).selectOption('SP');
  await page
    .getByRole('checkbox', { name: 'O casal ainda não sabe a data' })
    .check({ force: true });
  await expect(page.getByRole('textbox', { name: 'Endereço do site' })).toHaveValue(
    `${first.toLowerCase()}-e-andre`,
  );
  await expect(page.getByText('Endereço disponível. Dá para mudar até publicar.')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(
    page.getByText(
      'Passo 2 de 4 · Escolha um ponto de partida. Dá para mudar tudo depois, no Editor do site.',
    ),
  ).toBeVisible();
  // As fontes do Editor (loadEditorFonts) mudam o layout ao chegar: espera por elas e clica
  // no rótulo do cartão, já que o rádio é sr-only.
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const salvia = page.getByRole('radio', { name: /Sálvia/ });
  await page.locator('label.kore-site-appearance__palette').filter({ has: salvia }).click();
  await expect(salvia).toBeChecked();
  await page.getByRole('button', { name: 'Criar casamento' }).click();

  // O casamento nasce aqui, e a rota passa a ter o ?casamento={id}, sem o Toast (decisão 281).
  await expect(
    page.getByText(
      'Passo 3 de 4 · O casamento já está criado como rascunho. Convide o casal agora ou deixe para depois.',
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/cerimonialista\/casamentos\/novo\?casamento=/);
  return first;
}

async function signInPlanner({ page }: { page: Page }) {
  const email = newEmail({ label: `novo-${unique()}` });
  const userId = await createUser({ db, email, name: 'Juliana Prado' });
  await createPlanner({ db, userId, creditName: `Prado ${letters()}` });
  await signIn({ page, email });
}

test('a cerimonialista cria um casamento e gera o link do casal (RN02 a RN06)', async ({
  page,
}) => {
  await signInPlanner({ page });
  const first = await createWedding({ page });
  await expect(page.getByRole('button', { name: 'Voltar' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Gerar link' }).click();

  await expect(page.getByRole('heading', { name: 'Casamento criado.' })).toBeVisible();
  await expect(page.getByText('Aguardando o casal')).toBeVisible();
  await expect(page.getByText(`${first} e André · Data a definir · Americana (SP)`)).toBeVisible();
  await expect(page.getByText('Passo 4 de 4 · Pronto')).toBeVisible();
  await expect(
    page.getByText('Acompanhar em Meus casamentos quando o casal aceitar'),
  ).toBeVisible();
  const block = page.getByRole('region', { name: 'Link para o casal' });
  await expect(block.getByRole('textbox', { name: 'Link para o casal' })).toHaveValue(
    /\/convite\//,
  );
  await page.getByRole('button', { name: 'Ir para Meus casamentos' }).click();
  await expect(page).toHaveURL(/\/cerimonialista$/);
  await expect(
    page.getByRole('link', { name: new RegExp(`^${first} e André`) }).first(),
  ).toBeVisible();
});

test('a cerimonialista abre o link do casal que ela gerou: Convite inválido (RN05, 409 SELF_REFERRAL)', async ({
  page,
}) => {
  await signInPlanner({ page });
  await createWedding({ page });
  await page.getByRole('button', { name: 'Gerar link' }).click();
  const link = await page
    .getByRole('region', { name: 'Link para o casal' })
    .getByRole('textbox', { name: 'Link para o casal' })
    .inputValue();
  const token = /\/convite\/([^/?#]+)/.exec(link)?.[1] ?? '';
  expect(token).not.toBe('');

  await page.goto(`/convite/${token}`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Este convite não vale mais' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);
});

test('Convidar depois, e o Convidar o casal do detalhe volta ao passo 3 com o envio por e-mail (RN06, RN07)', async ({
  page,
}) => {
  await signInPlanner({ page });
  const first = await createWedding({ page });
  await page.getByRole('button', { name: 'Convidar depois' }).click();
  await expect(page.getByRole('heading', { name: 'Casamento criado.' })).toBeVisible();
  await expect(
    page.getByText(
      'O convite para o casal fica para depois. Envie quando quiser, no detalhe do casamento.',
    ),
  ).toBeVisible();
  await expect(page.getByText('Rascunho', { exact: true })).toBeVisible();

  // O detalhe do rascunho sem convite: Convidar o casal abre o passo 3 (RN07).
  const weddingId = new URL(page.url()).searchParams.get('casamento') ?? '';
  await page.goto(`/cerimonialista?casamento=${weddingId}`);
  const dialog = page.getByRole('dialog', { name: `${first} e André` });
  await dialog.getByRole('button', { name: 'Convidar o casal' }).click();
  await expect(
    page.getByText(
      'Passo 3 de 4 · O casamento já está criado como rascunho. Convide o casal agora ou deixe para depois.',
    ),
  ).toBeVisible();
  const couple = `isabela-${unique()}@exemplo.com`;
  await page
    .getByRole('textbox', { name: 'E-⁠mail do casal (opcional)', exact: true })
    .fill(couple);
  await page.getByRole('button', { name: 'Enviar convite' }).click();
  await expect(page.getByRole('heading', { name: 'Casamento criado.' })).toBeVisible();
  await expect(
    page.getByText(
      `Enviamos o convite para ${couple}. Enquanto o casal não aceita, você já pode montar o site e a lista de convidados.`,
    ),
  ).toBeVisible();
  await expect(page.getByText('Aguardando o casal')).toBeVisible();

  // Com o convite pendente, a rota do passo 3 leva ao detalhe (decisão 281(3)).
  await page.goto(`/cerimonialista/casamentos/novo?casamento=${weddingId}`);
  await expect(page).toHaveURL(new RegExp(`/cerimonialista\\?casamento=${weddingId}$`));
});
