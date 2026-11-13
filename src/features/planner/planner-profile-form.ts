import type { TFunction } from 'i18next';
import { ApiError } from '../../shared/api/http-client';

type AccessT = TFunction<'access'>;

/** Os limites da RN04 (Cadastro e perfil do cerimonialista), os mesmos do servidor. */
export const CREDIT_NAME_MAX = 80;
export const CREDIT_NAME_MIN = 2;
export const NAME_MAX = 80;
export const CITY_MAX = 80;

/** Os campos dos Dados profissionais que mostram erro (RN04). */
export type PlannerField = 'creditName' | 'name' | 'phone' | 'whatsapp' | 'cities' | 'terms';
export type PlannerFieldErrors = Partial<Record<PlannerField, string>>;

export interface PlannerProfileValues {
  creditName: string;
  name: string;
  phone: string;
  whatsapp: string;
  /** O WhatsApp é o mesmo do telefone (a caixa "O mesmo do telefone"). */
  sameAsPhone: boolean;
  /** Cada uma como "Cidade (UF)" (RN04; decisão 249). */
  cities: string[];
  termsAccepted: boolean;
}

/** Só os dígitos do telefone, como o servidor guarda. */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** DDD e número: 10 ou 11 dígitos (RN04). Vazio vale: o campo é opcional. */
function phoneIsValid(value: string): boolean {
  const digits = phoneDigits(value);
  return digits.length === 0 || digits.length === 10 || digits.length === 11;
}

/** "(19) 98812-7730" a partir dos dígitos que o servidor devolve; o resto, como veio. */
export function formatPhoneDigits(digits: string | null | undefined): string {
  if (!digits) return '';
  const match = /^(\d{2})(\d{4,5})(\d{4})$/.exec(digits);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : digits;
}

/** "Campinas (SP)": a cidade como a RN04 pede. */
export function cityLabel({ city, state }: { city: string; state: string }): string {
  return `${city.trim().replace(/\s+/g, ' ')} (${state})`;
}

/**
 * O erro de Adicionar uma cidade (decisão 249): sem cidade, sem UF, acima de 80 caracteres
 * no "Cidade (UF)" ou repetida (sem diferenciar maiúsculas).
 */
export function addCityError({
  t,
  cities,
  city,
  state,
}: {
  t: AccessT;
  cities: readonly string[];
  city: string;
  state: string;
}): string | undefined {
  if (!city.trim()) return t('weddingDetails.errors.city');
  if (!state) return t('weddingDetails.errors.state');
  const label = cityLabel({ city, state });
  if (label.length > CITY_MAX) return t('plannerProfile.errors.cityTooLong');
  const key = label.toLocaleLowerCase('pt-BR');
  if (cities.some((item) => item.toLocaleLowerCase('pt-BR') === key)) {
    return t('plannerProfile.errors.cityDuplicate');
  }
  return undefined;
}

/**
 * A conferência no aparelho antes do envio (RN04): os mesmos limites do servidor, menos o
 * predicado do nome sem contato, que só o servidor aplica (decisão 224(13)).
 */
export function validatePlannerProfile({
  t,
  values,
  needsName,
  needsTerms,
}: {
  t: AccessT;
  values: PlannerProfileValues;
  /** Seu nome só quando a conta não tem nome (RN04). */
  needsName: boolean;
  /** No Cadastro, sempre; no Meu perfil, só no perfil mínimo (RN10). */
  needsTerms: boolean;
}): PlannerFieldErrors {
  const errors: PlannerFieldErrors = {};
  const creditName = values.creditName.trim();
  if (!creditName) errors.creditName = t('plannerProfile.errors.creditNameRequired');
  else if (creditName.length > CREDIT_NAME_MAX) {
    errors.creditName = t('plannerProfile.errors.nameTooLong');
  } else if (creditName.length < CREDIT_NAME_MIN) {
    errors.creditName = t('plannerProfile.errors.creditNameTooShort');
  }
  if (needsName) {
    const name = values.name.trim();
    if (!name) errors.name = t('plannerProfile.errors.nameRequired');
    else if (name.length > NAME_MAX) errors.name = t('plannerProfile.errors.nameTooLong');
  }
  if (!phoneIsValid(values.phone)) errors.phone = t('plannerProfile.errors.phone');
  if (!values.sameAsPhone && !phoneIsValid(values.whatsapp)) {
    errors.whatsapp = t('plannerProfile.errors.phone');
  }
  if (values.cities.length === 0) errors.cities = t('plannerProfile.errors.citiesRequired');
  if (needsTerms && !values.termsAccepted) errors.terms = t('plannerProfile.errors.terms');
  return errors;
}

/** O corpo do POST e do PATCH /v1/me/planner (RN04). */
export function plannerProfileBody({
  values,
  needsName,
}: {
  values: PlannerProfileValues;
  needsName: boolean;
}) {
  const phone = phoneDigits(values.phone);
  const whatsapp = values.sameAsPhone ? phone : phoneDigits(values.whatsapp);
  return {
    creditName: values.creditName.trim(),
    ...(needsName && { name: values.name.trim() }),
    phone: phone || null,
    whatsapp: whatsapp || null,
    cities: values.cities,
  };
}

interface ApiFieldError {
  path?: unknown;
  code?: unknown;
}

const FIELDS: readonly PlannerField[] = ['creditName', 'name', 'phone', 'whatsapp', 'cities'];

function fieldTextFor({ t, field, code }: { t: AccessT; field: PlannerField; code: string }) {
  if (field === 'creditName') {
    if (code === 'REQUIRED') return t('plannerProfile.errors.creditNameRequired');
    if (code === 'TOO_LONG') return t('plannerProfile.errors.nameTooLong');
    if (code === 'TOO_SHORT') return t('plannerProfile.errors.creditNameTooShort');
    if (code === 'CREDIT_NAME_INVALID') return t('plannerProfile.errors.creditNameInvalid');
  }
  if (field === 'name') {
    if (code === 'REQUIRED') return t('plannerProfile.errors.nameRequired');
    if (code === 'TOO_LONG') return t('plannerProfile.errors.nameTooLong');
  }
  if ((field === 'phone' || field === 'whatsapp') && code === 'PHONE_INVALID') {
    return t('plannerProfile.errors.phone');
  }
  if (field === 'cities') {
    if (code === 'REQUIRED') return t('plannerProfile.errors.citiesRequired');
    if (code === 'DUPLICATE') return t('plannerProfile.errors.cityDuplicate');
    if (code === 'TOO_LONG') return t('plannerProfile.errors.cityTooLong');
  }
  return undefined;
}

/**
 * Os erros de campo do 400 (o `errors[{ path, code }]` da decisão 190) nos textos da RN04.
 * `cities.3` vira o erro do campo Cidades. Um código sem texto (ex.: o TOO_MANY, teto
 * técnico que a tela não alcança) não vira erro de campo: quem chama mostra o aviso geral.
 */
export function fieldErrorsFromApi({
  t,
  error,
}: {
  t: AccessT;
  error: unknown;
}): PlannerFieldErrors | undefined {
  if (!(error instanceof ApiError) || error.status !== 400) return undefined;
  const body: unknown = error.body;
  const list =
    typeof body === 'object' && body !== null && 'errors' in body && Array.isArray(body.errors)
      ? (body.errors as ApiFieldError[])
      : [];
  const errors: PlannerFieldErrors = {};
  for (const item of list) {
    if (typeof item.path !== 'string' || typeof item.code !== 'string') continue;
    const field = FIELDS.find(
      (name) => item.path === name || String(item.path).startsWith(`${name}.`),
    );
    if (!field || errors[field]) continue;
    const text = fieldTextFor({ t, field, code: item.code });
    if (text) errors[field] = text;
  }
  return Object.keys(errors).length > 0 ? errors : undefined;
}
