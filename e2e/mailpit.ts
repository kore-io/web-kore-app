import { expect, type APIRequestContext } from '@playwright/test';

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

interface MailpitSearch {
  messages: { ID: string; Created: string }[];
}

interface MailpitMessage {
  Text: string;
  HTML: string;
}

/**
 * Último e-mail recebido por `to` no Mailpit, esperando ele chegar (o worker envia). Com
 * `since`, espera um que tenha chegado depois (ex.: o do código, depois do convite).
 */
export async function latestEmail({
  request,
  to,
  since,
}: {
  request: APIRequestContext;
  to: string;
  since?: Date;
}) {
  let message: MailpitMessage | undefined;
  await expect
    .poll(
      async () => {
        const response = await request.get(`${MAILPIT_URL}/api/v1/search`, {
          params: { query: `to:"${to}"`, limit: 1 },
        });
        const latest = ((await response.json()) as MailpitSearch).messages[0];
        if (!latest || (since && new Date(latest.Created) < since)) return undefined;
        message = (await (
          await request.get(`${MAILPIT_URL}/api/v1/message/${latest.ID}`)
        ).json()) as MailpitMessage;
        return message;
      },
      { message: `e-mail para ${to}`, timeout: 15_000 },
    )
    .toBeTruthy();
  return message as MailpitMessage;
}

/** O código de 6 números do e-mail de login (o e-mail mostra em dois grupos: "980 127"). */
export function codeFrom({ email }: { email: MailpitMessage }) {
  const match = /\b(\d{3}) ?(\d{3})\b/.exec(email.Text);
  if (!match) throw new Error('código não encontrado no e-mail');
  return `${match[1]}${match[2]}`;
}

/** O link do botão "Entrar" do e-mail de login (/entrar/confirmar?token=…). */
export function confirmLinkFrom({ email }: { email: MailpitMessage }) {
  const link = /https?:\/\/[^\s"<>]+\/entrar\/confirmar\?token=[^\s"<>]+/.exec(email.HTML)?.[0];
  if (!link) throw new Error('link de confirmação não encontrado no e-mail');
  return link.replaceAll('&amp;', '&');
}

/** Um e-mail novo a cada teste, para não esbarrar nos limites da RN04. */
export function newEmail({ label }: { label: string }) {
  return `e2e-${label}-${Date.now()}@kore.local`;
}
