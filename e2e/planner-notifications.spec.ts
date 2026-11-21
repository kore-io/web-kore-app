import { expect, test, type Page } from '@playwright/test';
import { codeFrom, latestEmail, newEmail } from './mailpit';
import { toast } from './support/app';
import {
  connectBackoffice,
  createPlanner,
  createUser,
  createWedding,
  unique,
  type Db,
} from './support/backoffice';

/*
 * Notificações da cerimonialista (D9 da F6; RN05, RN06 e RN08; decisão 300; Penpot 13 e 15):
 * a central junta os casamentos dela pelo scope=planner, o sino conta as não lidas, abrir
 * leva ao destino e marca como lida, Marcar todas, as preferências gerais e o sino de dentro
 * do casamento. As notificações entram pelo banco, como as funções notify_* gravam.
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

async function notify({
  userId,
  weddingId,
  type,
  groupKey,
  count = 1,
  payload,
}: {
  userId: string;
  weddingId: string;
  type: 'rsvp' | 'wedding_published' | 'membership_removed';
  groupKey: string;
  count?: number;
  payload: object[];
}) {
  await db.query(
    `insert into notifications (id, user_id, wedding_id, type, group_key, count, payload)
     values (gen_random_uuid(), $1, $2, $3, $4, $5, $6::jsonb)`,
    [userId, weddingId, type, groupKey, count, JSON.stringify(payload)],
  );
}

test('a central de todos os casamentos, o sino, os destinos, Marcar todas e as preferências gerais', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = newEmail({ label: `notificacoes-${unique()}` });
  const userId = await createUser({ db, email, name: 'Juliana Prado' });
  const referrerId = await createPlanner({ db, userId, creditName: `Prado ${letters()}` });
  const ownerId = await createUser({
    db,
    email: newEmail({ label: `dona-${unique()}` }),
    name: 'Ana Beatriz Moreira',
  });
  // Ela colabora em Ana e Marcos; Bianca e Henrique vieram pelo link dela, sem convidá-la.
  const collaborating = await createWedding({
    db,
    partners: ['Ana Beatriz Moreira', 'Marcos Vinícius Rocha'],
    eventDate: '2027-05-15',
    city: 'Campinas',
    status: 'draft',
    createdByUserId: ownerId,
    owners: [ownerId, null],
    collaboratorIds: [userId],
  });
  const referred = await createWedding({
    db,
    partners: ['Bianca Lopes', 'Henrique Dias'],
    eventDate: '2027-06-20',
    city: 'Vinhedo',
    status: 'draft',
    createdByUserId: ownerId,
    owners: [ownerId, null],
    referrerId,
    referralSource: 'referral_link',
  });
  await notify({
    userId,
    weddingId: collaborating,
    type: 'rsvp',
    groupKey: `rsvp:${collaborating}`,
    count: 2,
    payload: [
      {
        partyId: crypto.randomUUID(),
        name: 'Família Moreira',
        confirmed: 2,
        declined: 0,
        at: new Date().toISOString(),
      },
      {
        partyId: crypto.randomUUID(),
        name: 'Tios do Marcos',
        confirmed: 1,
        declined: 1,
        at: new Date().toISOString(),
      },
    ],
  });
  await notify({
    userId,
    weddingId: referred,
    type: 'wedding_published',
    groupKey: `wedding_published:${referred}`,
    payload: [{ partnerNames: ['Bianca', 'Henrique'] }],
  });

  await signIn({ page, email });
  await page.goto('/cerimonialista/modelos');
  const bell = page.getByRole('button', { name: 'Notificações, 2 não lidas' });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page).toHaveURL(/\/cerimonialista\/notificacoes$/);
  await expect(page.getByText('O que aconteceu nos seus casamentos.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^2 grupos responderam em Ana e Marcos ?, não lida/ }),
  ).toBeVisible();

  // Só indicadora: o publicado leva ao Link de indicação e marca como lida.
  await page.getByRole('button', { name: /^Site de Bianca e Henrique foi publicado/ }).click();
  await expect(page).toHaveURL(/\/cerimonialista\/link-de-indicacao$/);
  await expect(page.getByRole('button', { name: 'Notificações, 1 não lida' })).toBeVisible();

  // Dentro do casamento, o sino é o dela e as Notificações levam à central (RN08).
  await page.goto(`/cerimonialista/casamentos/${collaborating}/notificacoes`);
  await expect(page).toHaveURL(/\/cerimonialista\/notificacoes$/);
  await expect(
    page.getByRole('button', { name: /^Site de Bianca e Henrique foi publicado/ }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Marcar todas como lidas' }).click();
  await expect(
    toast({ page, text: 'Todas as notificações foram marcadas como lidas.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notificações', exact: true })).toBeVisible();

  // As preferências gerais (sem weddingId): o e-mail de Novas respostas grava e fica.
  await page.goto('/cerimonialista/configuracoes/notificacoes');
  const rsvp = page.getByRole('group', { name: 'Novas respostas' });
  await rsvp.getByRole('combobox', { name: 'Novas respostas, E-⁠mail' }).selectOption('immediate');
  await expect(toast({ page, text: 'Preferências salvas.' })).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole('group', { name: 'Novas respostas' })
      .getByRole('combobox', { name: 'Novas respostas, E-⁠mail' }),
  ).toHaveValue('immediate');
  await expect(
    page
      .getByRole('group', { name: 'Colaboração encerrada' })
      .getByRole('combobox', { name: 'Colaboração encerrada, E-⁠mail' }),
  ).toBeDisabled();
});
