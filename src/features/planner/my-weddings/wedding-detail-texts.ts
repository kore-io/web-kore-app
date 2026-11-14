import type {
  CoupleInvitationResponse,
  MyWeddingDetailResponse,
} from '../../../shared/api/generated/model';
import { DEFAULT_TIMEZONE } from '../../../shared/date-texts';

const LONG = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "sáb., 30 de janeiro de 2027", o dia do casamento (Penpot 03, Detalhe). */
export function longWeddingDate({ date }: { date: string }): string {
  return LONG.format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}

/** "20/09": o dia do envio do convite, no fuso de São Paulo (o detalhe não traz o fuso). */
export function sentDay({ at }: { at: string }): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: DEFAULT_TIMEZONE,
  }).format(new Date(at));
}

/** O convite por e-mail e o link do casal entre os convites que ela criou (RN08). */
export function coupleInvitations({ detail }: { detail: MyWeddingDetailResponse }): {
  email: CoupleInvitationResponse | undefined;
  link: CoupleInvitationResponse | undefined;
} {
  return {
    email: detail.coupleInvitations.find((invitation) => invitation.type === 'email'),
    link: detail.coupleInvitations.find((invitation) => invitation.type === 'link'),
  };
}

/**
 * Excluir este casamento só para quem o criou, em rascunho ou aguardando o casal, sem dono
 * (RN11). O texto da confirmação segue o caso: o convite por e-mail, o link ou nenhum.
 */
export function deleteCase({
  detail,
}: {
  detail: MyWeddingDetailResponse;
}): 'draft' | 'link' | 'email' | null {
  const allowed =
    detail.createdByMe &&
    !detail.hasOwner &&
    (detail.status === 'draft' || detail.status === 'awaiting_couple');
  if (!allowed) return null;
  const { email, link } = coupleInvitations({ detail });
  if (email) return 'email';
  if (link) return 'link';
  return 'draft';
}
