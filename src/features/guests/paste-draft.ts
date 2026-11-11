import type { PastePreviewResponse, PasteImportBody } from '../../shared/api/generated/model';

/** Nome de pessoa e de grupo: até 80 caracteres (Importação RN11 e RN12). */
export const NAME_MAX = 80;

export interface DraftGuest {
  key: string;
  name: string;
}

export interface DraftGroup {
  key: string;
  line: number;
  source: string;
  /** O nome que a prévia leu; nulo na linha só com "+ N" (o app usa a 1ª pessoa). */
  readName: string | null;
  /** O nome do grupo vira campo só quando passa de 80 (TOO_LONG; 189(7)). */
  nameEditable: boolean;
  name: string;
  /** O cartão pergunta "Qual é o nome de cada pessoa deste grupo?" (veio pessoa sem nome). */
  askNames: boolean;
  warnings: PastePreviewResponse['groups'][number]['warnings'];
  guests: DraftGuest[];
}

export interface PasteDraft {
  groups: DraftGroup[];
  /** RN14: linhas que saíram na prévia, nomes repetidos tirados, pessoas e grupos removidos. */
  removedInPreview: number;
}

export type NameError = 'missing' | 'tooLong' | 'duplicate';

/** Nome comparável: sem diferenciar maiúsculas, acentos e espaços (como a API, RN06). */
export function comparableName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** A prévia da API vira o rascunho que o casal edita. */
export function draftFromPreview(preview: PastePreviewResponse): PasteDraft {
  const groups = preview.groups.map((group, index) => ({
    key: `${group.line}-${index}`,
    line: group.line,
    source: group.source,
    readName: group.name,
    nameEditable: group.name !== null && group.name.length > NAME_MAX,
    name: group.name ?? '',
    askNames: group.guests.some((guest) => guest.name === null),
    warnings: group.warnings,
    guests: group.guests.map((guest, guestIndex) => ({
      key: `${group.line}-${guestIndex}`,
      name: guest.name ?? '',
    })),
  }));
  // Os nomes repetidos que a prévia tirou, contados pela API em cada grupo (210(4)).
  const duplicates = preview.groups.reduce((total, group) => total + group.duplicatesRemoved, 0);
  return { groups, removedInPreview: preview.droppedLines.length + duplicates };
}

/** O erro do nome de uma pessoa: vazio, acima de 80 ou repetido no grupo (210(5)). */
export function guestNameError({
  group,
  index,
}: {
  group: DraftGroup;
  index: number;
}): NameError | null {
  const name = group.guests[index]?.name.trim() ?? '';
  if (!name) return 'missing';
  if (name.length > NAME_MAX) return 'tooLong';
  const key = comparableName(name);
  const repeated = group.guests
    .slice(0, index)
    .some((guest) => guest.name.trim() && comparableName(guest.name) === key);
  return repeated ? 'duplicate' : null;
}

/** O erro do nome do grupo, quando ele é campo (TOO_LONG). */
export function groupNameError(group: DraftGroup): NameError | null {
  if (!group.nameEditable) return null;
  const name = group.name.trim();
  if (!name) return 'missing';
  return name.length > NAME_MAX ? 'tooLong' : null;
}

export function draftCounts(draft: PasteDraft) {
  const missing = draft.groups.map(
    (group) => group.guests.filter((guest) => !guest.name.trim()).length,
  );
  return {
    parties: draft.groups.length,
    guests: draft.groups.reduce((total, group) => total + group.guests.length, 0),
    missingNames: missing.reduce((total, n) => total + n, 0),
    groupsMissingNames: missing.filter((n) => n > 0).length,
  };
}

/** RN12: Importar só com todos os nomes preenchidos, até 80 e sem repetido no grupo. */
export function draftIsValid(draft: PasteDraft): boolean {
  return (
    draft.groups.length > 0 &&
    draft.groups.every(
      (group) =>
        groupNameError(group) === null &&
        group.guests.every((_, index) => guestNameError({ group, index }) === null),
    )
  );
}

/** Tira a pessoa; o grupo que fica sem ninguém sai também e conta 1 a mais (RN10, RN14). */
export function removeGuest({
  draft,
  groupKey,
  guestKey,
}: {
  draft: PasteDraft;
  groupKey: string;
  guestKey: string;
}): PasteDraft {
  let removed = 0;
  const groups = draft.groups.flatMap((group) => {
    if (group.key !== groupKey) return [group];
    const guests = group.guests.filter((guest) => guest.key !== guestKey);
    removed += group.guests.length - guests.length;
    if (guests.length === 0) {
      removed += 1;
      return [];
    }
    return [{ ...group, guests }];
  });
  return { groups, removedInPreview: draft.removedInPreview + removed };
}

/** O corpo da confirmação; a linha só com "+ N" leva o nome da 1ª pessoa (189(7)). */
export function draftToBody(draft: PasteDraft): PasteImportBody {
  return {
    removedInPreview: draft.removedInPreview,
    groups: draft.groups.map((group) => {
      const guests = group.guests.map((guest) => guest.name.trim());
      const name = group.nameEditable ? group.name.trim() : (group.readName ?? guests[0] ?? '');
      return { name, guests };
    }),
  };
}
