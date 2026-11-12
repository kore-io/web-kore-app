import { describe, expect, it } from 'vitest';
import {
  draftFromSite,
  formatWhatsapp,
  isDirty,
  serverBasicsErrors,
  toPatchBody,
  validateBasics,
  type BasicsDraft,
} from './basics-draft';

const original: BasicsDraft = {
  names: ['Ana Beatriz Moreira', 'Marcos Vinícius Rocha'],
  eventDate: '2026-11-14',
  city: 'Campinas',
  state: 'SP',
  slug: 'ana-e-marcos',
  whatsapp: '(19) 99876-4521',
  email: 'ana.moreira@gmail.com',
};

describe('rascunho dos Dados básicos (RN02 a RN08)', () => {
  it('o PATCH leva só o que mudou, com os nulos que apagam (RN04)', () => {
    const draft = {
      ...original,
      names: ['Ana Moreira', 'Marcos Vinícius Rocha'],
      whatsapp: '',
      city: ' Valinhos ',
    };
    expect(toPatchBody({ draft, original, partnerIds: ['pa', 'pm'] })).toEqual({
      partners: [
        { id: 'pa', name: 'Ana Moreira' },
        { id: 'pm', name: 'Marcos Vinícius Rocha' },
      ],
      city: 'Valinhos',
      contactWhatsapp: null,
    });
    expect(
      toPatchBody({ draft: { ...original, eventDate: '' }, original, partnerIds: [] }),
    ).toEqual({ eventDate: null });
  });

  it('espaços nas pontas não contam como mudança', () => {
    expect(isDirty({ draft: { ...original, city: 'Campinas ' }, original })).toBe(false);
    expect(isDirty({ draft: { ...original, slug: 'ana-marcos' }, original })).toBe(true);
  });

  it('nome, cidade e UF vazios; o endereço vazio ou fora do formato (RN03, RN06)', () => {
    const draft = { ...original, names: ['', 'Marcos'], city: ' ', state: '', slug: 'Ana_Marcos' };
    expect(validateBasics(draft, { slugEditable: true })).toEqual({
      name0: { code: 'NAME_MISSING', params: {} },
      city: { code: 'CITY_MISSING', params: {} },
      state: { code: 'STATE_MISSING', params: {} },
      slug: { code: 'SLUG_FORMAT', params: {} },
    });
    expect(validateBasics({ ...original, slug: '' }, { slugEditable: true }).slug?.code).toBe(
      'SLUG_MISSING',
    );
    expect(validateBasics({ ...original, slug: '' }, { slugEditable: false }).slug).toBeUndefined();
  });

  it('o 400 volta ao campo pelo caminho (189(1))', () => {
    expect(
      serverBasicsErrors([
        { path: 'contactWhatsapp', code: 'PHONE_TOO_SHORT', params: { n: 8 } },
        { path: 'contactEmail', code: 'IS_EMAIL', params: {} },
        { path: 'partners.1.name', code: 'IS_NOT_EMPTY', params: {} },
        { path: 'city', code: 'IS_NOT_EMPTY', params: {} },
        { path: 'outro', code: 'X', params: {} },
      ]),
    ).toEqual({
      whatsapp: { code: 'PHONE_TOO_SHORT', params: { n: 8 } },
      email: { code: 'EMAIL_INVALID', params: {} },
      name1: { code: 'NAME_MISSING', params: {} },
      city: { code: 'CITY_MISSING', params: {} },
    });
  });

  it('o WhatsApp vem em E.164 e aparece formatado; os nulos viram vazio', () => {
    expect(formatWhatsapp('+5519998764521')).toBe('(19) 99876-4521');
    expect(formatWhatsapp('+351912345678')).toBe('+351912345678');
    expect(
      draftFromSite({
        partners: [{ id: 'p', title: null, name: 'Ana' }],
        eventDate: null,
        city: null,
        state: null,
        slug: null,
        contactWhatsapp: null,
        contactEmail: null,
      } as never),
    ).toEqual({
      names: ['Ana'],
      eventDate: '',
      city: '',
      state: '',
      slug: '',
      whatsapp: '',
      email: '',
    });
  });
});
