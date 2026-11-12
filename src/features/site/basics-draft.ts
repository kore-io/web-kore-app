import type {
  SiteEditorResponse,
  SiteImageRefResponse,
  UpdateSiteBody,
} from '../../shared/api/generated/model';
import { isValidSlug } from '../access/wedding-slug';

/** O que o casal edita em Dados básicos (RN02), com a foto de capa (RN09). */
export interface BasicsDraft {
  names: string[];
  eventDate: string;
  city: string;
  state: string;
  slug: string;
  whatsapp: string;
  email: string;
  /** A capa: a imagem pronta ou nenhuma (Remover foto). */
  cover: Pick<SiteImageRefResponse, 'id' | 'url' | 'thumbUrl'> | null;
}

export type BasicsField =
  'name0' | 'name1' | 'eventDate' | 'city' | 'state' | 'slug' | 'whatsapp' | 'email';

export type BasicsErrorCode =
  | 'NAME_MISSING'
  | 'CITY_MISSING'
  | 'STATE_MISSING'
  | 'EMAIL_INVALID'
  | 'SLUG_MISSING'
  | 'SLUG_FORMAT'
  | 'PHONE_TOO_SHORT'
  | 'PHONE_TOO_LONG'
  | 'PHONE_INVALID'
  /** Publicado, a data não fica em branco (decisão 219). */
  | 'EVENT_DATE_REQUIRED_WHEN_PUBLISHED'
  /** Publicado, a data nova deixa a saída do ar fora da faixa (Publicação RN11; 228(1)). */
  | 'EVENT_DATE_AFTER_END_DATE';

export type BasicsErrors = Partial<
  Record<BasicsField, { code: BasicsErrorCode; params: Record<string, unknown> }>
>;

export function draftFromSite(site: SiteEditorResponse): BasicsDraft {
  return {
    names: site.partners.map((partner) => partner.name),
    eventDate: site.eventDate ?? '',
    city: site.city ?? '',
    state: site.state ?? '',
    slug: site.slug ?? '',
    whatsapp: formatWhatsapp(site.contactWhatsapp),
    email: site.contactEmail ?? '',
    cover: site.cover
      ? { id: site.cover.id, url: site.cover.url, thumbUrl: site.cover.thumbUrl }
      : null,
  };
}

/** "+5519998764521" → "(19) 99876-4521"; o internacional fica em E.164 (Grupos RN04). */
export function formatWhatsapp(e164: string | null): string {
  if (!e164) return '';
  const br = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  return br ? `(${br[1]}) ${br[2]}-${br[3]}` : e164;
}

export function isDirty({ draft, original }: { draft: BasicsDraft; original: BasicsDraft }) {
  return JSON.stringify(normalize(draft)) !== JSON.stringify(normalize(original));
}

function normalize(draft: BasicsDraft) {
  return {
    ...draft,
    names: draft.names.map((name) => name.trim()),
    city: draft.city.trim(),
    whatsapp: draft.whatsapp.trim(),
    email: draft.email.trim(),
    cover: draft.cover?.id ?? null,
  };
}

/**
 * O PATCH só com o que mudou: a data, a UF e o endereço sem mudança não vão, e a
 * cerimonialista nunca esbarra no FIELD_NOT_ALLOWED (RN04).
 */
export function toPatchBody({
  draft,
  original,
  partnerIds,
}: {
  draft: BasicsDraft;
  original: BasicsDraft;
  partnerIds: string[];
}): UpdateSiteBody {
  const now = normalize(draft);
  const before = normalize(original);
  const body: UpdateSiteBody = {};
  if (now.names.some((name, index) => name !== before.names[index])) {
    body.partners = now.names.map((name, index) => ({ id: partnerIds[index] ?? '', name }));
  }
  if (now.eventDate !== before.eventDate) body.eventDate = now.eventDate || null;
  if (now.city !== before.city) body.city = now.city;
  if (now.state !== before.state) body.state = now.state as NonNullable<UpdateSiteBody['state']>;
  if (now.slug !== before.slug) body.slug = now.slug;
  if (now.whatsapp !== before.whatsapp) body.contactWhatsapp = now.whatsapp || null;
  if (now.email !== before.email) body.contactEmail = now.email || null;
  if (now.cover !== before.cover) body.coverImageId = now.cover;
  return body;
}

/**
 * O que o app confere antes de mandar (RN03 e RN06); o 80 trava a digitação, sem texto.
 * Publicado, a data do casamento não fica em branco (decisão 219).
 */
export function validateBasics(
  draft: BasicsDraft,
  { slugEditable, published = false }: { slugEditable: boolean; published?: boolean },
) {
  const errors: BasicsErrors = {};
  if (published && !draft.eventDate)
    errors.eventDate = { code: 'EVENT_DATE_REQUIRED_WHEN_PUBLISHED', params: {} };
  draft.names.forEach((name, index) => {
    if (!name.trim())
      errors[index === 0 ? 'name0' : 'name1'] = { code: 'NAME_MISSING', params: {} };
  });
  if (!draft.city.trim()) errors.city = { code: 'CITY_MISSING', params: {} };
  if (!draft.state) errors.state = { code: 'STATE_MISSING', params: {} };
  if (slugEditable) {
    const slugError = slugFormatError(draft.slug);
    if (slugError) errors.slug = { code: slugError, params: {} };
  }
  return errors;
}

export function slugFormatError(slug: string): 'SLUG_MISSING' | 'SLUG_FORMAT' | null {
  if (!slug) return 'SLUG_MISSING';
  return isValidSlug({ slug }) ? null : 'SLUG_FORMAT';
}

const FIELD_BY_PATH: Record<string, BasicsField> = {
  'partners.0.name': 'name0',
  'partners.1.name': 'name1',
  eventDate: 'eventDate',
  city: 'city',
  state: 'state',
  slug: 'slug',
  contactWhatsapp: 'whatsapp',
  contactEmail: 'email',
};

/** O 400 da API, pelo caminho do campo (decisão 189(1)), no código que o app sabe dizer. */
export function serverBasicsErrors(
  errors: readonly { path: string; code: string; params: Record<string, unknown> }[],
): BasicsErrors {
  const result: BasicsErrors = {};
  for (const error of errors) {
    const field = FIELD_BY_PATH[error.path];
    if (!field) continue;
    const code: BasicsErrorCode | null =
      error.code === 'EVENT_DATE_REQUIRED_WHEN_PUBLISHED'
        ? error.code
        : error.code === 'PHONE_TOO_SHORT' ||
            error.code === 'PHONE_TOO_LONG' ||
            error.code === 'PHONE_INVALID'
          ? error.code
          : error.code === 'IS_EMAIL' || error.code === 'EMAIL_INVALID'
            ? 'EMAIL_INVALID'
            : error.code === 'IS_NOT_EMPTY' || error.code === 'NAME_MISSING'
              ? field === 'city'
                ? 'CITY_MISSING'
                : field === 'state'
                  ? 'STATE_MISSING'
                  : field === 'slug'
                    ? 'SLUG_MISSING'
                    : 'NAME_MISSING'
              : field === 'slug'
                ? 'SLUG_FORMAT'
                : null;
    if (code) result[field] = { code, params: error.params };
  }
  return result;
}
