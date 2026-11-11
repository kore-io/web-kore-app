import type {
  CreatePartyBody,
  PartyResponse,
  UpdatePartyBody,
} from '../../shared/api/generated/model';

/** Nome do grupo e do convidado: até 80; observação: até 500 (Grupos RN04). */
export const NAME_MAX = 80;
export const NOTE_MAX = 500;
/** Vagas de acompanhante: de 0 a 5 (RN07). */
export const PLUS_ONES_MAX = 5;

export type AgeGroupChoice = 'adult' | 'child' | 'baby' | '';

export interface GuestDraft {
  /** Chave da linha no formulário (o id do convidado, ou uma nova). */
  key: string;
  /** Id do convidado que já existe (Editar grupo); sem id, é novo. */
  id?: string;
  name: string;
  ageGroup: AgeGroupChoice;
  phone: string;
  email: string;
  /** Já respondeu (RN09): mudar pede confirmação. */
  answered: boolean;
}

export interface PartyDraft {
  name: string;
  guests: GuestDraft[];
  /** A linha marcada em "Convidado de contato"; nulo deixa o padrão da RN06. */
  contactKey: string | null;
  plusOneSlots: number;
  tagIds: string[];
  internalNote: string;
}

export type FieldErrorCode =
  | 'NAME_MISSING'
  | 'TOO_LONG'
  | 'NOTE_TOO_LONG'
  | 'PHONE_TOO_SHORT'
  | 'PHONE_TOO_LONG'
  | 'PHONE_INVALID'
  | 'EMAIL_INVALID';

export interface FieldError {
  code: FieldErrorCode;
  params: Record<string, unknown>;
}

/** Erros por campo: "name", "internalNote" e "guests.<key>.<campo>". */
export type FieldErrors = Record<string, FieldError>;

let newKey = 0;
function nextKey() {
  newKey += 1;
  return `new-${newKey}`;
}

export function emptyGuest(): GuestDraft {
  // O Penpot começa em Adulto (213(1)).
  return { key: nextKey(), name: '', ageGroup: 'adult', phone: '', email: '', answered: false };
}

export function emptyDraft(): PartyDraft {
  return {
    name: '',
    guests: [emptyGuest()],
    contactKey: null,
    plusOneSlots: 0,
    tagIds: [],
    internalNote: '',
  };
}

/** "+5519998761402" → "(19) 99876-1402"; o internacional fica em E.164 (RN04). */
export function formatPhone(e164: string | null): string {
  if (!e164) return '';
  const br = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  return br ? `(${br[1]}) ${br[2]}-${br[3]}` : e164;
}

/** O grupo da API vira o rascunho do Editar grupo; as vagas vazias ficam nas vagas. */
export function draftFromParty(party: PartyResponse): PartyDraft {
  const named = party.guests.filter((guest) => guest.name !== null);
  return {
    name: party.name,
    guests: named.map((guest) => ({
      key: guest.id,
      id: guest.id,
      name: guest.name ?? '',
      ageGroup: guest.ageGroup ?? '',
      phone: formatPhone(guest.phone),
      email: guest.email ?? '',
      answered: guest.rsvpStatus !== 'pending',
    })),
    contactKey: party.contactGuestId,
    plusOneSlots: party.plusOneSlots,
    tagIds: party.tags.map((tag) => tag.id),
    internalNote: party.internalNote ?? '',
  };
}

const isBlank = (guest: GuestDraft) =>
  !guest.name.trim() && !guest.phone.trim() && !guest.email.trim();

/**
 * As linhas que vão para a API: a 1ª sempre (RN03) e os convidados que já existem;
 * uma linha nova toda vazia é ignorada (213(4)).
 */
export function guestsToSend(draft: PartyDraft): GuestDraft[] {
  return draft.guests.filter((guest, index) => index === 0 || guest.id || !isBlank(guest));
}

const hasContact = (guest: GuestDraft) => Boolean(guest.phone.trim() || guest.email.trim());

/** Quem pode ser o contato: quem tem telefone ou e-mail (RN06). */
export function canBeContact(guest: GuestDraft): boolean {
  return hasContact(guest);
}

/** O que o app confere antes de mandar: nomes e tamanhos (RN03, RN04; 213(3)). */
export function validateDraft(draft: PartyDraft): FieldErrors {
  const errors: FieldErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = { code: 'NAME_MISSING', params: {} };
  else if (name.length > NAME_MAX) errors.name = { code: 'TOO_LONG', params: { max: NAME_MAX } };
  for (const guest of guestsToSend(draft)) {
    const guestName = guest.name.trim();
    if (!guestName) errors[`guests.${guest.key}.name`] = { code: 'NAME_MISSING', params: {} };
    else if (guestName.length > NAME_MAX)
      errors[`guests.${guest.key}.name`] = { code: 'TOO_LONG', params: { max: NAME_MAX } };
  }
  if (draft.internalNote.trim().length > NOTE_MAX)
    errors.internalNote = { code: 'NOTE_TOO_LONG', params: { max: NOTE_MAX } };
  return errors;
}

/** O contato marcado, se ele ainda pode ser contato; senão, o padrão da RN06. */
function contactOf(draft: PartyDraft, sent: GuestDraft[]): GuestDraft | undefined {
  const marked = sent.find((guest) => guest.key === draft.contactKey);
  return marked && canBeContact(marked) ? marked : undefined;
}

export function toCreateBody(draft: PartyDraft): CreatePartyBody {
  const sent = guestsToSend(draft);
  const contact = contactOf(draft, sent);
  const note = draft.internalNote.trim();
  return {
    name: draft.name.trim(),
    guests: sent.map((guest) => ({
      name: guest.name.trim(),
      ...(guest.ageGroup && { ageGroup: guest.ageGroup }),
      ...(guest.phone.trim() && { phone: guest.phone.trim() }),
      ...(guest.email.trim() && { email: guest.email.trim() }),
    })),
    plusOneSlots: draft.plusOneSlots,
    tagIds: draft.tagIds,
    ...(contact && { contactIndex: sent.indexOf(contact) }),
    ...(note && { internalNote: note }),
  };
}

/**
 * O PATCH do Editar grupo (RN09). O contato só pode ser um convidado que já existe
 * (o contrato pede o id); o novo com telefone vira contato pelo padrão da RN06.
 */
export function toUpdateBody(draft: PartyDraft): UpdatePartyBody {
  const sent = guestsToSend(draft);
  const contact = contactOf(draft, sent);
  const note = draft.internalNote.trim();
  return {
    name: draft.name.trim(),
    guests: sent.map((guest) => ({
      ...(guest.id && { id: guest.id }),
      name: guest.name.trim(),
      ageGroup: guest.ageGroup || null,
      phone: guest.phone.trim() || null,
      email: guest.email.trim() || null,
    })),
    plusOneSlots: draft.plusOneSlots,
    tagIds: draft.tagIds,
    internalNote: note || null,
    ...(contact?.id && { contactGuestId: contact.id }),
  };
}

/** Quem já respondeu e teve algo mudado (RN09): o app pede confirmação antes de salvar. */
export function changedAnswered({
  draft,
  original,
}: {
  draft: PartyDraft;
  original: PartyDraft;
}): boolean {
  return draft.guests.some((guest) => {
    if (!guest.answered) return false;
    const before = original.guests.find((item) => item.key === guest.key);
    return (
      before !== undefined &&
      (before.name.trim() !== guest.name.trim() ||
        before.ageGroup !== guest.ageGroup ||
        before.phone.trim() !== guest.phone.trim() ||
        before.email.trim() !== guest.email.trim())
    );
  });
}

/** O código do 400 (o do telefone vem do objeto de valor; os outros, do DTO) no do app. */
function fieldCode({ field, code }: { field: string; code: string }): FieldErrorCode | null {
  if (code === 'PHONE_TOO_SHORT' || code === 'PHONE_TOO_LONG' || code === 'PHONE_INVALID')
    return code;
  if (code === 'IS_EMAIL' || code === 'EMAIL_INVALID') return 'EMAIL_INVALID';
  if (code === 'IS_NOT_EMPTY' || code === 'NAME_MISSING') return 'NAME_MISSING';
  if (code === 'MAX_LENGTH' || code === 'TOO_LONG')
    return field === 'internalNote' ? 'NOTE_TOO_LONG' : 'TOO_LONG';
  return null;
}

/**
 * O 400 da API aponta o campo pelo caminho ("guests.1.phone"; RN04, decisões 186(8) e
 * 189(1)): o índice é o da lista enviada, e volta à linha do formulário. O que não é
 * de um campo do formulário fica de fora (o app mostra o aviso genérico).
 */
export function serverFieldErrors({
  draft,
  errors,
}: {
  draft: PartyDraft;
  errors: readonly { path: string; code: string; params: Record<string, unknown> }[];
}): FieldErrors {
  const sent = guestsToSend(draft);
  const result: FieldErrors = {};
  for (const error of errors) {
    const guestPath = /^guests\.(\d+)\.(name|phone|email)$/.exec(error.path);
    if (guestPath) {
      const guest = sent[Number(guestPath[1])];
      const field = guestPath[2] ?? '';
      const code = fieldCode({ field, code: error.code });
      if (guest && code) result[`guests.${guest.key}.${field}`] = { code, params: error.params };
    } else if (error.path === 'name' || error.path === 'internalNote') {
      const code = fieldCode({ field: error.path, code: error.code });
      if (code) result[error.path] = { code, params: error.params };
    }
  }
  return result;
}
