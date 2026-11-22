import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../shared/api/http-client';
import {
  addCityError,
  cityLabel,
  fieldErrorsFromApi,
  formatPhoneDigits,
  plannerProfileBody,
  validatePlannerProfile,
  type PlannerProfileValues,
} from './planner-profile-form';

const t = i18next.getFixedT('pt-BR', 'access');

const values = (overrides: Partial<PlannerProfileValues> = {}): PlannerProfileValues => ({
  creditName: 'Prado Assessoria',
  name: '',
  phone: '',
  whatsapp: '',
  sameAsPhone: false,
  cities: ['Campinas (SP)'],
  termsAccepted: true,
  ...overrides,
});

describe('os Dados profissionais no aparelho (Cadastro e perfil RN04)', () => {
  it('completos, sem erro', () => {
    expect(
      validatePlannerProfile({ t, values: values(), needsName: false, needsTerms: true }),
    ).toEqual({});
  });

  it('os erros de cada campo, com os textos da Pena (decisão 250(a))', () => {
    expect(
      validatePlannerProfile({
        t,
        values: values({
          creditName: ' ',
          phone: '(19) 9881',
          whatsapp: '123',
          cities: [],
          termsAccepted: false,
        }),
        needsName: true,
        needsTerms: true,
      }),
    ).toEqual({
      creditName: 'Informe o nome da assessoria.',
      name: 'Informe seu nome.',
      phone: 'Confira o telefone: use DDD e número, como (19) 98812-7730.',
      whatsapp: 'Confira o telefone: use DDD e número, como (19) 98812-7730.',
      cities: 'Adicione pelo menos uma cidade.',
      terms: 'Aceite os termos para continuar.',
    });
    const long = 'a'.repeat(81);
    expect(
      validatePlannerProfile({
        t,
        values: values({ creditName: long, name: long }),
        needsName: true,
        needsTerms: false,
      }),
    ).toEqual({
      creditName: 'O nome passa de 80 caracteres.',
      name: 'O nome passa de 80 caracteres.',
    });
    expect(
      validatePlannerProfile({
        t,
        values: values({ creditName: 'P' }),
        needsName: false,
        needsTerms: true,
      }).creditName,
    ).toBe('O nome precisa de pelo menos 2 caracteres.');
  });

  it('o WhatsApp igual ao telefone não é conferido de novo; sem os Termos no Meu perfil completo', () => {
    expect(
      validatePlannerProfile({
        t,
        values: values({
          phone: '19988127730',
          whatsapp: 'x',
          sameAsPhone: true,
          termsAccepted: false,
        }),
        needsName: false,
        needsTerms: false,
      }),
    ).toEqual({});
  });

  it('o corpo: só os dígitos, o WhatsApp igual ao telefone e o nome só sem nome na conta', () => {
    expect(
      plannerProfileBody({
        values: values({ creditName: ' Prado ', phone: '(19) 98812-7730', sameAsPhone: true }),
        needsName: false,
      }),
    ).toEqual({
      creditName: 'Prado',
      phone: '19988127730',
      whatsapp: '19988127730',
      cities: ['Campinas (SP)'],
    });
    expect(
      plannerProfileBody({ values: values({ name: ' Juliana Prado ' }), needsName: true }),
    ).toEqual({
      creditName: 'Prado Assessoria',
      name: 'Juliana Prado',
      phone: null,
      whatsapp: null,
      cities: ['Campinas (SP)'],
    });
  });

  it('o telefone de volta, com a máscara', () => {
    expect(formatPhoneDigits('19988127730')).toBe('(19) 98812-7730');
    expect(formatPhoneDigits('1932541234')).toBe('(19) 3254-1234');
    expect(formatPhoneDigits(null)).toBe('');
  });
});

describe('as Cidades de atuação (decisão 249)', () => {
  it('"Cidade (UF)", sem espaços sobrando', () => {
    expect(cityLabel({ city: '  São  José dos Campos ', state: 'SP' })).toBe(
      'São José dos Campos (SP)',
    );
  });

  it('sem cidade, sem UF, repetida (sem diferenciar maiúsculas) e acima de 80', () => {
    const cities = ['Campinas (SP)'];
    expect(addCityError({ t, cities, city: ' ', state: 'SP' })).toBe('Informe a cidade.');
    expect(addCityError({ t, cities, city: 'Valinhos', state: '' })).toBe('Escolha a UF.');
    expect(addCityError({ t, cities, city: 'campinas', state: 'SP' })).toBe(
      'Essa cidade já está na lista.',
    );
    expect(addCityError({ t, cities, city: 'a'.repeat(76), state: 'SP' })).toBe(
      'A cidade passa de 80 caracteres.',
    );
    expect(addCityError({ t, cities, city: 'Campinas', state: 'MG' })).toBeUndefined();
  });
});

describe('os erros do servidor nos campos (decisão 190)', () => {
  const error = (errors: object[]) => new ApiError({ status: 400, body: { errors } });

  it('cada código no texto do campo; cities.N vira o erro das Cidades', () => {
    expect(
      fieldErrorsFromApi({
        t,
        error: error([
          { path: 'creditName', code: 'CREDIT_NAME_INVALID', params: {} },
          { path: 'phone', code: 'PHONE_INVALID', params: {} },
          { path: 'cities.1', code: 'DUPLICATE', params: {} },
        ]),
      }),
    ).toEqual({
      creditName: 'Use só o nome da assessoria, sem link, telefone ou e-\u2060mail.',
      phone: 'Confira o telefone: use DDD e número, como (19) 98812-7730.',
      cities: 'Essa cidade já está na lista.',
    });
    expect(
      fieldErrorsFromApi({ t, error: error([{ path: 'creditName', code: 'TOO_SHORT' }]) }),
    ).toEqual({ creditName: 'O nome precisa de pelo menos 2 caracteres.' });
  });

  it('sem texto para o código (o TOO_MANY) ou sem ser 400: nada, e quem chama mostra o aviso', () => {
    expect(fieldErrorsFromApi({ t, error: error([{ path: 'cities', code: 'TOO_MANY' }]) })).toBe(
      undefined,
    );
    expect(
      fieldErrorsFromApi({ t, error: new ApiError({ status: 409, body: { error: 'X' } }) }),
    ).toBeUndefined();
  });
});
