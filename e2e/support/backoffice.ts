import { createHash, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';

/*
 * Dados próprios de cada teste pela conexão do backoffice da API (ignora a RLS), como os
 * e2e do api-kore-api fazem em test/support: casamento, indicador e convite com token
 * gerado aqui, únicos por rodada. Não depende do seed (Dados de exemplo), que fica para
 * uso humano e demonstração. A URL vem de E2E_DATABASE_BACKOFFICE_URL (a mesma
 * DATABASE_BACKOFFICE_URL do .env da API local); nada de credencial em arquivo.
 */

const BACKOFFICE_DB_ROLE = 'kore_backoffice';

/** Só o banco local: a conexão grava com BYPASSRLS (até o E2E ir à homologação, 159). */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export type Db = pg.Client;

export async function connectBackoffice(): Promise<Db> {
  const connectionString = process.env.E2E_DATABASE_BACKOFFICE_URL;
  if (!connectionString) {
    throw new Error(
      'Faltou E2E_DATABASE_BACKOFFICE_URL (a DATABASE_BACKOFFICE_URL do .env da API local).',
    );
  }
  const { hostname } = new URL(connectionString);
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `E2E_DATABASE_BACKOFFICE_URL aponta para "${hostname}": o E2E só grava no banco local.`,
    );
  }
  // Como a BackofficePrismaService: o BYPASSRLS não é herdado pela participação no papel.
  const db = new pg.Client({ connectionString, options: `-c role=${BACKOFFICE_DB_ROLE}` });
  await db.connect();
  return db;
}

/** Um sufixo único por chamada, para e-mails, códigos e endereços. */
export const unique = () => randomUUID().slice(0, 8);

async function insertId({ db, sql, params }: { db: Db; sql: string; params: unknown[] }) {
  const result = await db.query<{ id: string }>(sql, params);
  const id = result.rows[0]?.id;
  if (!id) throw new Error('o insert não devolveu o id');
  return id;
}

export async function createUser({
  db,
  email,
  name,
}: {
  db: Db;
  email: string;
  name: string | null;
}) {
  return insertId({
    db,
    sql: `insert into users (id, email, name, updated_at)
          values (gen_random_uuid(), $1, $2, now()) returning id`,
    params: [email, name],
  });
}

/** Cerimonialista ativo (Referrer planner + Planner com o Nome para a assinatura). */
export async function createPlanner({
  db,
  userId,
  creditName,
}: {
  db: Db;
  userId: string;
  creditName: string;
}) {
  const referrerId = await insertId({
    db,
    sql: `insert into referrers (id, user_id, kind, referral_code, rate_percent, status, updated_at)
          values (gen_random_uuid(), $1, 'planner', $2, 20, 'active', now()) returning id`,
    params: [userId, `e2e-${unique()}`],
  });
  await db.query(
    `insert into planners (id, referrer_id, credit_name, updated_at)
     values (gen_random_uuid(), $1, $2, now())`,
    [referrerId, creditName],
  );
  return referrerId;
}

interface WeddingInput {
  db: Db;
  partners: [string, string];
  eventDate: string;
  city: string;
  status: 'draft' | 'awaiting_couple';
  createdByUserId: string;
  /** Dono (casal que já entrou) com o noivo de cada posição; nulo se ainda sem login. */
  owners?: [string | null, string | null];
  collaboratorIds?: string[];
  referrerId?: string;
}

/** Casamento com os dois noivos e os vínculos, num endereço único. */
export async function createWedding({
  db,
  partners,
  eventDate,
  city,
  status,
  createdByUserId,
  owners = [null, null],
  collaboratorIds = [],
  referrerId,
}: WeddingInput) {
  const weddingId = await insertId({
    db,
    sql: `insert into weddings (id, slug, status, event_date, timezone, city, state,
            created_by_user_id, referrer_id, referral_source, signup_source, updated_at)
          values (gen_random_uuid(), $1, $2, $3, 'America/Sao_Paulo', $4, 'SP', $5, $6, $7, $8, now())
          returning id`,
    params: [
      `e2e-${unique()}`,
      status,
      eventDate,
      city,
      createdByUserId,
      referrerId ?? null,
      referrerId ? 'created_by_planner' : null,
      referrerId ? 'planner' : 'direct',
    ],
  });
  for (const [index, displayName] of partners.entries()) {
    await db.query(
      `insert into partners (id, wedding_id, slot, display_name, user_id, updated_at)
       values (gen_random_uuid(), $1, $2, $3, $4, now())`,
      [weddingId, index + 1, displayName, owners[index] ?? null],
    );
  }
  const members = [
    ...owners.filter((id): id is string => id !== null).map((userId) => [userId, 'owner']),
    ...collaboratorIds.map((userId) => [userId, 'collaborator']),
  ];
  for (const [userId, role] of members) {
    await db.query(
      `insert into memberships (id, wedding_id, user_id, role) values (gen_random_uuid(), $1, $2, $3)`,
      [weddingId, userId, role],
    );
  }
  return weddingId;
}

/** Convite pendente com o token do link (o banco guarda só o hash, como na API). */
export async function createInvitation({
  db,
  weddingId,
  kind,
  email,
  invitedByUserId,
}: {
  db: Db;
  weddingId: string;
  kind: 'couple' | 'planner';
  email: string | null;
  invitedByUserId: string;
}) {
  const token = randomBytes(32).toString('base64url');
  await db.query(
    `insert into access_invitations (id, wedding_id, kind, email, role, token_hash,
       invited_by_user_id, expires_at)
     values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now() + interval '30 days')`,
    [
      weddingId,
      kind,
      email,
      kind === 'planner' ? 'collaborator' : 'owner',
      createHash('sha256').update(token).digest('base64url'),
      invitedByUserId,
    ],
  );
  return token;
}
