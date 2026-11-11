import { describe, expect, it } from 'vitest';
import type { PastePreviewResponse } from '../../shared/api/generated/model';
import {
  draftCounts,
  draftFromPreview,
  draftIsValid,
  draftToBody,
  guestNameError,
  groupNameError,
  removeGuest,
  type PasteDraft,
} from './paste-draft';

const example: PastePreviewResponse = {
  groups: [
    {
      line: 1,
      source: 'Família Moreira: Jorge, Célia, Pedro',
      name: 'Família Moreira',
      guests: [{ name: 'Jorge' }, { name: 'Célia' }, { name: 'Pedro' }],
      warnings: [],
      duplicatesRemoved: 0,
    },
    {
      line: 2,
      source: 'Carla Nunes + 2 filhos',
      name: 'Carla Nunes',
      guests: [{ name: 'Carla Nunes' }, { name: null }, { name: null }],
      warnings: [],
      duplicatesRemoved: 0,
    },
    {
      line: 3,
      source: 'Rafael e Bianca',
      name: 'Rafael e Bianca',
      guests: [{ name: 'Rafael' }, { name: 'Bianca' }],
      warnings: [],
      duplicatesRemoved: 0,
    },
    {
      line: 4,
      source: 'Márcia Rocha',
      name: 'Márcia Rocha',
      guests: [{ name: 'Márcia Rocha' }],
      warnings: [],
      duplicatesRemoved: 0,
    },
  ],
  droppedLines: [],
  parties: 4,
  guests: 9,
  missingNames: 2,
};

/** O item da lista, ou o teste falha (sem o "!"). */
function at<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`sem o item ${index}`);
  return item;
}

function fill(draft: PasteDraft, groupIndex: number, names: string[]): PasteDraft {
  return {
    ...draft,
    groups: draft.groups.map((group, index) =>
      index === groupIndex
        ? {
            ...group,
            guests: group.guests.map((guest, i) => ({ ...guest, name: names[i] ?? guest.name })),
          }
        : group,
    ),
  };
}

describe('rascunho da lista colada (Importação RN10 a RN12, RN14)', () => {
  it('o exemplo: 4 grupos, 9 convidados, 2 nomes faltando num grupo; Importar só com os nomes', () => {
    const draft = draftFromPreview(example);
    expect(draftCounts(draft)).toEqual({
      parties: 4,
      guests: 9,
      missingNames: 2,
      groupsMissingNames: 1,
    });
    expect(draft.groups.map((group) => group.askNames)).toEqual([false, true, false, false]);
    expect(draftIsValid(draft)).toBe(false);
    const filled = fill(draft, 1, ['Carla Nunes', 'Lucas Nunes', 'Ana Nunes']);
    expect(draftIsValid(filled)).toBe(true);
    expect(draftToBody(filled)).toEqual({
      removedInPreview: 0,
      groups: [
        { name: 'Família Moreira', guests: ['Jorge', 'Célia', 'Pedro'] },
        { name: 'Carla Nunes', guests: ['Carla Nunes', 'Lucas Nunes', 'Ana Nunes'] },
        { name: 'Rafael e Bianca', guests: ['Rafael', 'Bianca'] },
        { name: 'Márcia Rocha', guests: ['Márcia Rocha'] },
      ],
    });
  });

  it('Remover pessoa: o botão vira 8 convidados e conta 1 no removedInPreview', () => {
    const draft = draftFromPreview(example);
    const group = draft.groups[1];
    const removed = removeGuest({
      draft,
      groupKey: group?.key ?? '',
      guestKey: group?.guests[2]?.key ?? '',
    });
    const filled = fill(removed, 1, ['Carla Nunes', 'Lucas Nunes']);
    expect(draftCounts(filled).guests).toBe(8);
    expect(draftIsValid(filled)).toBe(true);
    expect(draftToBody(filled).removedInPreview).toBe(1);
  });

  it('"+ 2" sem nome: as duas removidas tiram o grupo, e o removedInPreview é 3', () => {
    const draft = draftFromPreview({
      ...example,
      groups: [
        {
          line: 1,
          source: '+ 2',
          name: null,
          guests: [{ name: null }, { name: null }],
          warnings: [],
          duplicatesRemoved: 0,
        },
      ],
    });
    const [group] = draft.groups;
    const once = removeGuest({
      draft,
      groupKey: group?.key ?? '',
      guestKey: group?.guests[0]?.key ?? '',
    });
    const twice = removeGuest({
      draft: once,
      groupKey: group?.key ?? '',
      guestKey: group?.guests[1]?.key ?? '',
    });
    expect(twice.groups).toHaveLength(0);
    expect(twice.removedInPreview).toBe(3);
    expect(draftIsValid(twice)).toBe(false);
  });

  it('"+ 2" com os nomes: o grupo leva o nome da 1ª pessoa', () => {
    const draft = draftFromPreview({
      ...example,
      groups: [
        {
          line: 1,
          source: '+ 2',
          name: null,
          guests: [{ name: null }, { name: null }],
          warnings: [],
          duplicatesRemoved: 0,
        },
      ],
    });
    expect(draftToBody(fill(draft, 0, [' Lucas Nunes ', 'Ana Nunes'])).groups).toEqual([
      { name: 'Lucas Nunes', guests: ['Lucas Nunes', 'Ana Nunes'] },
    ]);
  });

  it('as linhas que saíram e cada nome repetido tirado (duplicatesRemoved) entram no removedInPreview', () => {
    const draft = draftFromPreview({
      ...example,
      groups: [
        { ...at(example.groups, 0), warnings: ['DUPLICATE_REMOVED'], duplicatesRemoved: 2 },
        { ...at(example.groups, 1), warnings: ['DUPLICATE_REMOVED'], duplicatesRemoved: 1 },
      ],
      droppedLines: [2, 5],
    });
    // 2 linhas que saíram + 3 nomes repetidos ("Jorge, jorge, JORGE" conta 2).
    expect(draft.removedInPreview).toBe(5);
  });

  it('nome acima de 80, repetido no grupo (sem acento e maiúscula) ou vazio é erro', () => {
    const draft = fill(draftFromPreview(example), 0, ['a'.repeat(81), 'Celia', 'célia ']);
    expect([0, 1, 2].map((index) => guestNameError({ group: at(draft.groups, 0), index }))).toEqual(
      ['tooLong', null, 'duplicate'],
    );
    expect(guestNameError({ group: at(draftFromPreview(example).groups, 1), index: 1 })).toBe(
      'missing',
    );
  });

  it('nome de grupo acima de 80 vira campo e trava o Importar até caber', () => {
    const long = 'G'.repeat(81);
    const draft = draftFromPreview({
      ...example,
      groups: [
        {
          line: 1,
          source: `${long}: Ana`,
          name: long,
          guests: [{ name: 'Ana' }],
          warnings: ['TOO_LONG'],
          duplicatesRemoved: 0,
        },
      ],
    });
    const [group] = draft.groups;
    expect(group?.nameEditable).toBe(true);
    expect(groupNameError(at(draft.groups, 0))).toBe('tooLong');
    expect(draftIsValid(draft)).toBe(false);
    const fixed = { ...draft, groups: [{ ...at(draft.groups, 0), name: 'Amigos' }] };
    expect(draftIsValid(fixed)).toBe(true);
    expect(draftToBody(fixed).groups[0]?.name).toBe('Amigos');
  });
});
