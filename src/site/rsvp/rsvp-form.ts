import type { PutRsvpBody, RsvpResponse } from '../../shared/api/generated/model';

/** Os limites dos campos (Confirmar presença RN03 a RN05; Música RN04). */
export const DIET_MAX = 200;
export const SONG_MAX = 120;
export const PLUS_ONE_NAME_MAX = 80;

export type RsvpAnswer = 'pending' | 'confirmed' | 'declined';

/** O que o grupo marca para cada pessoa; a vaga de acompanhante tem o nome (RN05). */
export interface RsvpGuestForm {
  id: string;
  /** O nome do convidado; na vaga, o do acompanhante que foi levado (ou nulo). */
  name: string | null;
  isPlusOne: boolean;
  status: RsvpAnswer;
  dietaryRestriction: string;
  songSuggestion: string;
  /** Só na vaga: o nome digitado com Vou levar. */
  plusOneName: string;
}

export type RsvpFieldError =
  'answerMissing' | 'plusOneNameMissing' | 'dietTooLong' | 'songTooLong' | 'nameTooLong';

export interface RsvpErrors {
  guests: Partial<Record<string, RsvpFieldError>>;
  signer?: 'signerMissing';
}

/** O formulário com as respostas atuais (RN03: ao abrir de novo, vem preenchido). */
export function formFromRsvp(rsvp: RsvpResponse): RsvpGuestForm[] {
  return rsvp.guests.map((guest) => ({
    id: guest.id,
    name: guest.name,
    isPlusOne: guest.isPlusOne,
    status: guest.rsvpStatus,
    dietaryRestriction: guest.dietaryRestriction ?? '',
    songSuggestion: guest.songSuggestion ?? '',
    plusOneName: guest.isPlusOne ? (guest.name ?? '') : '',
  }));
}

/** Quem pode assinar: só os convidados com nome, fora as vagas (RN04). */
export function signers(guests: readonly RsvpGuestForm[]): RsvpGuestForm[] {
  return guests.filter((guest) => !guest.isPlusOne && guest.name);
}

/**
 * O que falta antes de enviar (RN04 a RN06): todo convidado com nome precisa de Vou ou
 * Não vou; Vou levar pede o nome do acompanhante; a vaga pode ficar sem resposta; e alguém
 * do grupo assina.
 */
export function validateRsvp({
  guests,
  signer,
}: {
  guests: readonly RsvpGuestForm[];
  signer: string | null;
}): RsvpErrors {
  const errors: RsvpErrors = { guests: {} };
  for (const guest of guests) {
    if (!guest.isPlusOne && guest.status === 'pending') errors.guests[guest.id] = 'answerMissing';
    if (guest.isPlusOne && guest.status === 'confirmed' && !guest.plusOneName.trim())
      errors.guests[guest.id] = 'plusOneNameMissing';
  }
  if (!signer || !signers(guests).some((guest) => guest.id === signer))
    errors.signer = 'signerMissing';
  return errors;
}

export function hasErrors(errors: RsvpErrors): boolean {
  return Object.keys(errors.guests).length > 0 || errors.signer !== undefined;
}

const textOrNull = (value: string) => value.trim() || null;

/**
 * O corpo do PUT (RN05 a RN07): com Não vou, a restrição e a música não vão (o servidor
 * as apaga); a música só com a pergunta ligada; a vaga sem resposta fica de fora, e Não vou
 * levar vai sem nome.
 */
export function rsvpBody({
  guests,
  signer,
  version,
  songEnabled,
}: {
  guests: readonly RsvpGuestForm[];
  signer: string;
  version: number;
  songEnabled: boolean;
}): PutRsvpBody {
  const answers: PutRsvpBody['guests'] = [];
  for (const guest of guests) {
    if (guest.isPlusOne && guest.status === 'pending') continue;
    const confirmed = guest.status === 'confirmed';
    answers.push({
      id: guest.id,
      status: guest.status,
      dietaryRestriction: confirmed ? textOrNull(guest.dietaryRestriction) : null,
      songSuggestion: confirmed && songEnabled ? textOrNull(guest.songSuggestion) : null,
      ...(guest.isPlusOne && { name: confirmed ? textOrNull(guest.plusOneName) : null }),
    });
  }
  return { version, signedByGuestId: signer, guests: answers };
}

const FIELD_ERROR: Record<string, RsvpFieldError> = {
  dietaryRestriction: 'dietTooLong',
  songSuggestion: 'songTooLong',
  name: 'nameTooLong',
};

/** O 400 do servidor por caminho (`guests.1.dietaryRestriction`, RN14), de volta ao bloco. */
export function serverRsvpErrors({
  guests,
  answered,
  errors,
}: {
  guests: readonly RsvpGuestForm[];
  /** Os ids na ordem em que foram no corpo (a vaga sem resposta fica de fora). */
  answered: readonly string[];
  errors: readonly { path: string; code: string }[];
}): RsvpErrors {
  const result: RsvpErrors = { guests: {} };
  for (const error of errors) {
    if (error.path === 'signedByGuestId') {
      result.signer = 'signerMissing';
      continue;
    }
    const match = /^guests\.(\d+)\.(\w+)$/.exec(error.path);
    const id = match ? answered[Number(match[1])] : undefined;
    const field = match ? FIELD_ERROR[match[2] ?? ''] : undefined;
    if (id && field && guests.some((guest) => guest.id === id)) result.guests[id] = field;
  }
  return result;
}

/** Quantas pessoas vêm, com os acompanhantes levados (RN09). */
export function confirmedCount(guests: readonly RsvpGuestForm[]): number {
  return guests.filter((guest) => guest.status === 'confirmed').length;
}

/** O nome que o resumo e os rótulos mostram: o do convidado, ou o do acompanhante. */
export function displayName(guest: RsvpGuestForm): string {
  return (guest.isPlusOne ? guest.plusOneName.trim() || guest.name : guest.name) ?? '';
}

const SIGNER_KEY = 'kore.rsvpSigner.';

/** A última escolha de "Quem está respondendo?" neste aparelho, só para pré-selecionar. */
export function rememberedSigner(partyId: string): string | null {
  try {
    return window.localStorage.getItem(SIGNER_KEY + partyId);
  } catch {
    return null;
  }
}

export function rememberSigner({ partyId, guestId }: { partyId: string; guestId: string }) {
  try {
    window.localStorage.setItem(SIGNER_KEY + partyId, guestId);
  } catch {
    // Sem armazenamento, só não pré-seleciona da próxima vez.
  }
}

/**
 * Marcar a resposta de uma pessoa. Na vaga, Não vou levar (ou desmarcar) apaga o nome, a
 * restrição e a música (RN05); o convidado com nome guarda o que digitou, que só não vai
 * com Não vou (RN06).
 */
export function withAnswer(guest: RsvpGuestForm, status: RsvpAnswer): RsvpGuestForm {
  if (guest.isPlusOne && status !== 'confirmed') {
    return { ...guest, status, plusOneName: '', dietaryRestriction: '', songSuggestion: '' };
  }
  return { ...guest, status };
}
