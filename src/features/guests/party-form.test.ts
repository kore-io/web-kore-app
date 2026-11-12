import { describe, expect, it } from 'vitest';
import type { PartyResponse } from '../../shared/api/generated/model';
import {
  changedAnswered,
  draftFromParty,
  emptyDraft,
  emptyGuest,
  formatPhone,
  serverFieldErrors,
  toCreateBody,
  toUpdateBody,
  validateDraft,
  type PartyDraft,
} from './party-form';

function draft(overrides: Partial<PartyDraft>): PartyDraft {
  return { ...emptyDraft(), ...overrides };
}

const party: PartyResponse = {
  id: 'p1',
  name: 'Família Moreira',
  contactGuestId: 'g2',
  internalNote: 'chegam no sábado',
  plusOneSlots: 1,
  deliveryStatus: 'not_sent',
  tags: [{ id: 't1', name: 'Família da Ana', color: 'wine' }],
  history: [],
  version: 1,
  link: { url: 'https://kore.com.br/c/x', regeneratedAt: null },
  guests: [
    {
      id: 'g1',
      name: 'Luiz Moreira',
      ageGroup: 'adult',
      dietaryRestriction: null,
      phone: null,
      email: null,
      phoneMasked: null,
      emailMasked: null,
      rsvpStatus: 'pending',
      tags: [],
      isPlusOne: false,
    },
    {
      id: 'g2',
      name: 'Célia Moreira',
      ageGroup: null,
      dietaryRestriction: 'sem glúten',
      phone: '+5519998763310',
      email: 'celia@exemplo.com',
      phoneMasked: '(19) 9****-3310',
      emailMasked: 'ce***@exemplo.com',
      rsvpStatus: 'confirmed',
      tags: [],
      isPlusOne: false,
    },
    {
      id: 'g3',
      name: null,
      ageGroup: null,
      dietaryRestriction: null,
      phone: null,
      email: null,
      phoneMasked: null,
      emailMasked: null,
      rsvpStatus: 'pending',
      tags: [],
      isPlusOne: true,
    },
  ],
} as PartyResponse;

describe('formulário do grupo (Grupos e convidados RN03 a RN09; decisão 213)', () => {
  it('Novo grupo: o corpo com o contato marcado, as vagas, as tags e a observação', () => {
    const first = {
      ...emptyGuest(),
      name: ' Beatriz Lima ',
      phone: '(19) 99876-1402',
      email: 'bia.lima@gmail.com',
    };
    const second = { ...emptyGuest(), name: 'Leonardo Castro', ageGroup: '' as const };
    const body = toCreateBody(
      draft({
        name: 'Beatriz e Leonardo',
        guests: [first, second],
        contactKey: first.key,
        plusOneSlots: 2,
        tagIds: ['t1'],
        internalNote: ' chegam no sábado ',
      }),
    );
    expect(body).toEqual({
      name: 'Beatriz e Leonardo',
      guests: [
        {
          name: 'Beatriz Lima',
          ageGroup: 'adult',
          phone: '(19) 99876-1402',
          email: 'bia.lima@gmail.com',
        },
        { name: 'Leonardo Castro' },
      ],
      plusOneSlots: 2,
      tagIds: ['t1'],
      contactIndex: 0,
      internalNote: 'chegam no sábado',
    });
  });

  it('a linha nova toda vazia é ignorada; a 1ª nunca (RN03; 213(4))', () => {
    const first = { ...emptyGuest(), name: 'Ana' };
    const blank = emptyGuest();
    expect(toCreateBody(draft({ name: 'A', guests: [first, blank] })).guests).toHaveLength(1);
    const errors = validateDraft(draft({ name: '', guests: [emptyGuest()] }));
    expect(Object.values(errors).map((error) => error.code)).toEqual([
      'NAME_MISSING',
      'NAME_MISSING',
    ]);
  });

  it('nome acima de 80 e observação acima de 500 (RN04)', () => {
    const guest = { ...emptyGuest(), name: 'b'.repeat(81) };
    const errors = validateDraft(
      draft({ name: 'a'.repeat(81), guests: [guest], internalNote: 'c'.repeat(501) }),
    );
    expect(errors).toEqual({
      name: { code: 'TOO_LONG', params: { max: 80 } },
      [`guests.${guest.key}.name`]: { code: 'TOO_LONG', params: { max: 80 } },
      internalNote: { code: 'NOTE_TOO_LONG', params: { max: 500 } },
    });
  });

  it('contato marcado sem telefone nem e-mail não vai: vale o padrão (RN06)', () => {
    const first = { ...emptyGuest(), name: 'Luiz' };
    expect(
      toCreateBody(draft({ name: 'A', guests: [first], contactKey: first.key })),
    ).not.toHaveProperty('contactIndex');
  });

  it('Editar grupo: o rascunho do grupo, sem a vaga vazia, com o telefone formatado', () => {
    const edit = draftFromParty(party);
    expect(
      edit.guests.map((guest) => [guest.name, guest.ageGroup, guest.phone, guest.answered]),
    ).toEqual([
      ['Luiz Moreira', 'adult', '', false],
      ['Célia Moreira', '', '(19) 99876-3310', true],
    ]);
    expect(edit).toMatchObject({
      contactKey: 'g2',
      plusOneSlots: 1,
      tagIds: ['t1'],
      internalNote: 'chegam no sábado',
    });
  });

  it('Editar grupo: o PATCH com os ids, os nulos que apagam e o convidado novo', () => {
    const edit = draftFromParty(party);
    const added = { ...emptyGuest(), name: 'Pedro Moreira' };
    const changed: PartyDraft = {
      ...edit,
      guests: [
        ...edit.guests.map((guest) => (guest.id === 'g2' ? { ...guest, email: '' } : guest)),
        added,
      ],
      internalNote: '',
    };
    expect(toUpdateBody(changed)).toEqual({
      name: 'Família Moreira',
      guests: [
        { id: 'g1', name: 'Luiz Moreira', ageGroup: 'adult', phone: null, email: null },
        { id: 'g2', name: 'Célia Moreira', ageGroup: null, phone: '(19) 99876-3310', email: null },
        { name: 'Pedro Moreira', ageGroup: 'adult', phone: null, email: null },
      ],
      plusOneSlots: 1,
      tagIds: ['t1'],
      internalNote: null,
      contactGuestId: 'g2',
    });
  });

  it('mudar quem já respondeu pede confirmação; mudar quem não respondeu, não (RN09)', () => {
    const original = draftFromParty(party);
    const luiz = {
      ...original,
      guests: original.guests.map((g) => (g.id === 'g1' ? { ...g, name: 'Luiz M.' } : g)),
    };
    const celia = {
      ...original,
      guests: original.guests.map((g) => (g.id === 'g2' ? { ...g, email: 'c@x.com' } : g)),
    };
    expect(changedAnswered({ draft: luiz, original })).toBe(false);
    expect(changedAnswered({ draft: celia, original })).toBe(true);
  });

  it('o 400 da API volta à linha certa, mesmo com uma linha vazia no meio (RN04)', () => {
    const first = { ...emptyGuest(), name: 'Beatriz' };
    const blank = emptyGuest();
    const third = { ...emptyGuest(), name: 'Leonardo', phone: '9876-1402' };
    const form = draft({ name: 'A', guests: [first, blank, third] });
    expect(
      serverFieldErrors({
        draft: form,
        errors: [
          { path: 'guests.1.phone', code: 'PHONE_TOO_SHORT', params: { n: 8 } },
          { path: 'guests.0.email', code: 'IS_EMAIL', params: {} },
          { path: 'internalNote', code: 'MAX_LENGTH', params: {} },
          { path: 'contactIndex', code: 'CONTACT_WITHOUT_PHONE_OR_EMAIL', params: {} },
        ],
      }),
    ).toEqual({
      [`guests.${third.key}.phone`]: { code: 'PHONE_TOO_SHORT', params: { n: 8 } },
      [`guests.${first.key}.email`]: { code: 'EMAIL_INVALID', params: {} },
      internalNote: { code: 'NOTE_TOO_LONG', params: {} },
    });
  });

  it.each([
    ['+5519998761402', '(19) 99876-1402'],
    ['+551933331402', '(19) 3333-1402'],
    ['+351912345678', '+351912345678'],
    [null, ''],
  ])('telefone %s → %s', (e164, shown) => {
    expect(formatPhone(e164)).toBe(shown);
  });
});
