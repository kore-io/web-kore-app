import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RsvpResponse } from '../../shared/api/generated/model';
import {
  confirmedCount,
  formFromRsvp,
  rememberedSigner,
  rememberSigner,
  rsvpBody,
  serverRsvpErrors,
  signers,
  validateRsvp,
  withAnswer,
  type RsvpGuestForm,
} from './rsvp-form';

const rsvp = {
  party: { id: 'p1', name: 'Família Nunes', version: 3 },
  guests: [
    {
      id: 'g1',
      name: 'Carla Nunes',
      rsvpStatus: 'confirmed',
      dietaryRestriction: 'sem glúten',
      songSuggestion: 'Evidências',
      isPlusOne: false,
    },
    {
      id: 'g2',
      name: 'Rafael Nunes',
      rsvpStatus: 'pending',
      dietaryRestriction: null,
      songSuggestion: null,
      isPlusOne: false,
    },
    {
      id: 'v1',
      name: null,
      rsvpStatus: 'pending',
      dietaryRestriction: null,
      songSuggestion: null,
      isPlusOne: true,
    },
  ],
  rsvpDeadline: '2026-10-15',
  state: 'open',
  songQuestion: { enabled: true, text: 'Que música não pode faltar na festa?' },
  contact: { whatsapp: null, email: null },
  plusOneSlots: 1,
} as RsvpResponse;

const set = (guests: RsvpGuestForm[], id: string, change: Partial<RsvpGuestForm>) =>
  guests.map((guest) => (guest.id === id ? { ...guest, ...change } : guest));

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('o formulário do RSVP (Confirmar presença RN03 a RN07, RN14)', () => {
  it('vem com as respostas atuais; só os convidados com nome assinam', () => {
    const guests = formFromRsvp(rsvp);
    expect(guests.map((guest) => [guest.id, guest.status, guest.dietaryRestriction])).toEqual([
      ['g1', 'confirmed', 'sem glúten'],
      ['g2', 'pending', ''],
      ['v1', 'pending', ''],
    ]);
    expect(signers(guests).map((guest) => guest.id)).toEqual(['g1', 'g2']);
  });

  it('falta a resposta de quem tem nome e quem assina; a vaga pode ficar sem resposta (RN04 a RN06)', () => {
    const guests = formFromRsvp(rsvp);
    expect(validateRsvp({ guests, signer: null })).toEqual({
      guests: { g2: 'answerMissing' },
      signer: 'signerMissing',
    });
    const answered = set(guests, 'g2', { status: 'declined' });
    expect(validateRsvp({ guests: answered, signer: 'g1' })).toEqual({ guests: {} });
    // A vaga não assina.
    expect(validateRsvp({ guests: answered, signer: 'v1' }).signer).toBe('signerMissing');
  });

  it('Vou levar pede o nome do acompanhante (RN05)', () => {
    const guests = set(formFromRsvp(rsvp), 'g2', { status: 'declined' });
    const taking = set(guests, 'v1', { status: 'confirmed', plusOneName: '  ' });
    expect(validateRsvp({ guests: taking, signer: 'g1' }).guests).toEqual({
      v1: 'plusOneNameMissing',
    });
  });

  it('o corpo: Não vou sem restrição nem música, a vaga sem resposta fora, Vou levar com o nome (RN05 a RN07)', () => {
    let guests = formFromRsvp(rsvp);
    guests = set(guests, 'g2', {
      status: 'declined',
      dietaryRestriction: 'vegano',
      songSuggestion: 'x',
    });
    expect(rsvpBody({ guests, signer: 'g1', version: 3, songEnabled: true })).toEqual({
      version: 3,
      signedByGuestId: 'g1',
      guests: [
        {
          id: 'g1',
          status: 'confirmed',
          dietaryRestriction: 'sem glúten',
          songSuggestion: 'Evidências',
        },
        { id: 'g2', status: 'declined', dietaryRestriction: null, songSuggestion: null },
      ],
    });
    guests = set(guests, 'v1', {
      status: 'confirmed',
      plusOneName: ' Rita Lopes ',
      dietaryRestriction: ' ',
    });
    expect(rsvpBody({ guests, signer: 'g1', version: 3, songEnabled: false }).guests).toEqual([
      { id: 'g1', status: 'confirmed', dietaryRestriction: 'sem glúten', songSuggestion: null },
      { id: 'g2', status: 'declined', dietaryRestriction: null, songSuggestion: null },
      {
        id: 'v1',
        status: 'confirmed',
        dietaryRestriction: null,
        songSuggestion: null,
        name: 'Rita Lopes',
      },
    ]);
    guests = set(guests, 'v1', { status: 'declined' });
    expect(rsvpBody({ guests, signer: 'g1', version: 3, songEnabled: true }).guests.at(-1)).toEqual(
      {
        id: 'v1',
        status: 'declined',
        dietaryRestriction: null,
        songSuggestion: null,
        name: null,
      },
    );
    expect(confirmedCount(guests)).toBe(1);
  });

  it('Não vou levar apaga o nome, a restrição e a música da vaga; o convidado guarda o que digitou (RN05)', () => {
    const [carla, , slot] = formFromRsvp(rsvp) as [RsvpGuestForm, RsvpGuestForm, RsvpGuestForm];
    const taken = {
      ...slot,
      status: 'confirmed' as const,
      plusOneName: 'Rita',
      dietaryRestriction: 'vegana',
      songSuggestion: 'x',
    };
    expect(withAnswer(taken, 'declined')).toMatchObject({
      plusOneName: '',
      dietaryRestriction: '',
      songSuggestion: '',
    });
    expect(withAnswer(carla, 'declined')).toMatchObject({
      status: 'declined',
      dietaryRestriction: 'sem glúten',
    });
  });

  it('o 400 do servidor volta ao bloco pelo caminho (RN14)', () => {
    const guests = formFromRsvp(rsvp);
    expect(
      serverRsvpErrors({
        guests,
        answered: ['g1', 'g2', 'v1'],
        errors: [
          { path: 'guests.0.dietaryRestriction', code: 'MAX_LENGTH' },
          { path: 'guests.1.songSuggestion', code: 'MAX_LENGTH' },
          { path: 'guests.2.name', code: 'MAX_LENGTH' },
          { path: 'signedByGuestId', code: 'SIGNER_INVALID' },
        ],
      }),
    ).toEqual({
      guests: { g1: 'dietTooLong', g2: 'songTooLong', v1: 'nameTooLong' },
      signer: 'signerMissing',
    });
  });

  it('lembra quem assinou neste aparelho; sem armazenamento, não quebra (RN04)', () => {
    expect(rememberedSigner('p1')).toBeNull();
    rememberSigner({ partyId: 'p1', guestId: 'g2' });
    expect(rememberedSigner('p1')).toBe('g2');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(rememberedSigner('p1')).toBeNull();
  });
});
