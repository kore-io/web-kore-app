import { DateField, Input, Select, useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMeControllerMeV1QueryKey } from '../../../shared/api/generated/me/me';
import type { SiteEditorResponse } from '../../../shared/api/generated/model';
import {
  getSiteControllerGetV1QueryKey,
  useSiteControllerPatchV1,
} from '../../../shared/api/generated/site/site';
import { useWeddingsControllerSlugAvailabilityV1 } from '../../../shared/api/generated/weddings/weddings';
import { ApiError, apiErrorCode } from '../../../shared/api/http-client';
import { BRAZIL_STATES } from '../../../shared/brazil-states';
import { FormField } from '../../../shared/components/form-field';
import { useDebouncedValue } from '../../../shared/hooks/use-debounced-value';
import type { Audience } from '../../guests/hooks/use-active-wedding';
import {
  draftFromSite,
  isDirty,
  serverBasicsErrors,
  slugFormatError,
  toPatchBody,
  validateBasics,
  type BasicsDraft,
  type BasicsErrors,
  type BasicsField,
} from '../basics-draft';
import { useSectionForm } from '../section-form';
import { CoverField } from './cover-field';
import { timezoneLabelKey } from '../timezones';

/** A mesma pausa do Cadastro antes de conferir o endereço (RN06). */
const SLUG_CHECK_DELAY_MS = 400;
const NAME_MAX = 80;

type SlugConflict = { reason: 'taken' | 'reserved'; slug: string; suggestion: string | null };

/** Dados básicos (RN02 a RN09). */
export function BasicsSection({
  weddingId,
  site,
  audience,
}: {
  weddingId: string;
  site: SiteEditorResponse;
  audience: Audience;
}) {
  const { t } = useTranslation('site');
  const { t: tGuests } = useTranslation('guests');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const patch = useSiteControllerPatchV1();
  const [original, setOriginal] = useState(() => draftFromSite(site));
  const [draft, setDraft] = useState(original);
  const [errors, setErrors] = useState<BasicsErrors>({});
  const [conflict, setConflict] = useState<SlugConflict | null>(null);

  const published = site.publishedAt !== null;
  const slugEditable = site.editable.slug && !published;
  const slugChanged = draft.slug !== original.slug;
  const slugShapeError = slugEditable ? slugFormatError(draft.slug) : null;
  const checkedSlug = useDebouncedValue({ value: draft.slug, delayMs: SLUG_CHECK_DELAY_MS });
  const availability = useWeddingsControllerSlugAvailabilityV1(
    { slug: checkedSlug, weddingId },
    {
      query: {
        enabled: slugEditable && slugChanged && slugFormatError(checkedSlug) === null,
        retry: false,
      },
    },
  );
  const checked = availability.data?.slug === draft.slug ? availability.data : undefined;
  const slugConflict: SlugConflict | null =
    conflict?.slug === draft.slug
      ? conflict
      : checked && !checked.available && checked.reason !== 'invalid_format'
        ? { reason: checked.reason ?? 'taken', slug: checked.slug, suggestion: checked.suggestion }
        : null;
  const slugOk =
    !slugEditable || !slugChanged || (slugShapeError === null && checked?.available === true);

  const dirty = isDirty({ draft, original });
  useSectionForm({
    dirty,
    canSave: slugOk,
    save: async () => {
      const local = validateBasics(draft, { slugEditable });
      setErrors(local);
      if (Object.keys(local).length > 0) return false;
      try {
        const saved = await patch.mutateAsync({
          weddingId,
          data: toPatchBody({ draft, original, partnerIds: site.partners.map((p) => p.id) }),
        });
        queryClient.setQueryData(getSiteControllerGetV1QueryKey(weddingId), saved);
        // Os nomes do casal aparecem na Topbar, que lê o /me.
        void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
        const next = draftFromSite(saved);
        setOriginal(next);
        setDraft(next);
        showToast({ tone: 'success', message: t('saved') });
        return true;
      } catch (error) {
        handleError(error);
        return false;
      }
    },
  });

  function handleError(error: unknown) {
    const code = apiErrorCode({ error });
    if (error instanceof ApiError && error.status === 400) {
      const body = error.body as {
        errors?: { path: string; code: string; params: Record<string, unknown> }[];
      };
      const fields = serverBasicsErrors(body.errors ?? []);
      if (Object.keys(fields).length > 0) {
        setErrors(fields);
        return;
      }
    }
    if (code === 'SLUG_UNAVAILABLE' && error instanceof ApiError) {
      const body = error.body as { reason?: 'taken' | 'reserved'; suggestion?: string | null };
      setConflict({
        reason: body.reason ?? 'taken',
        slug: draft.slug,
        suggestion: body.suggestion ?? null,
      });
      return;
    }
    // Corrida: o papel mudou ou o site foi publicado enquanto se editava (RN04, RN05). O
    // Editor recarrega, e a seção volta com os campos no estado novo (sugestão do Crivo).
    if (code === 'FIELD_NOT_ALLOWED' || code === 'SLUG_LOCKED') {
      void queryClient.invalidateQueries({ queryKey: getSiteControllerGetV1QueryKey(weddingId) });
    }
    showToast({
      tone: 'danger',
      message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
    });
  }

  function set<K extends keyof BasicsDraft>(key: K, value: BasicsDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const errorText = (field: BasicsField) =>
    basicsErrorText({ t, tGuests, error: errors[field], audience });
  const tz = timezoneLabelKey(draft.state || null);
  const identityHint = { hint: t('basics.identityLocked'), hintTone: 'neutral' as const };

  return (
    <div className="kore-site-basics">
      <div className="kore-site-basics__row">
        {site.partners.map((partner, index) => {
          const field: BasicsField = index === 0 ? 'name0' : 'name1';
          const label =
            partner.title === 'bride'
              ? t('basics.bride')
              : partner.title === 'groom'
                ? t('basics.groom')
                : t('basics.name');
          return (
            <FormField key={partner.id} label={label} hint={errorText(field)} hintTone="danger">
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  maxLength={NAME_MAX}
                  disabled={!site.editable.names}
                  value={draft.names[index] ?? ''}
                  onChange={(event) =>
                    set(
                      'names',
                      draft.names.map((name, i) => (i === index ? event.target.value : name)),
                    )
                  }
                />
              )}
            </FormField>
          );
        })}
      </div>

      <FormField
        label={t('basics.eventDate')}
        {...(site.editable.eventDate
          ? { hint: t(`basics.eventDateHelp.${audience}`), hintTone: 'neutral' as const }
          : identityHint)}
      >
        {({ id, describedBy }) => (
          <DateField
            id={id}
            aria-describedby={describedBy}
            disabled={!site.editable.eventDate}
            value={draft.eventDate}
            onChange={(event) => set('eventDate', event.target.value)}
          />
        )}
      </FormField>

      <div className="kore-site-basics__row kore-site-basics__row--city">
        <FormField label={t('basics.city')} hint={errorText('city')} hintTone="danger">
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              maxLength={NAME_MAX}
              value={draft.city}
              onChange={(event) => set('city', event.target.value)}
            />
          )}
        </FormField>
        <FormField
          label={t('basics.state')}
          {...(errors.state
            ? { hint: errorText('state'), hintTone: 'danger' as const }
            : !site.editable.state
              ? identityHint
              : {})}
        >
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              disabled={!site.editable.state}
              value={draft.state}
              onChange={(event) => set('state', event.target.value)}
            >
              {draft.state === '' && <option value="" />}
              {BRAZIL_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>

      <FormField label={t('basics.timezone')} hint={t('basics.timezoneHelp')}>
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            disabled
            value={tz ? t(`basics.timezones.${tz}`) : ''}
            readOnly
          />
        )}
      </FormField>

      <FormField label={t('basics.slug')} {...slugHint()}>
        {({ id, describedBy, invalid }) =>
          slugEditable ? (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              autoCapitalize="none"
              spellCheck={false}
              value={draft.slug}
              onChange={(event) => {
                setErrors((current) => {
                  const next = { ...current };
                  delete next.slug;
                  return next;
                });
                set('slug', event.target.value.trim().toLowerCase());
              }}
            />
          ) : (
            <Input
              id={id}
              aria-describedby={describedBy}
              disabled
              readOnly
              value={t('address', { slug: draft.slug })}
            />
          )
        }
      </FormField>

      <FormField label={t('basics.whatsapp')} hint={errorText('whatsapp')} hintTone="danger">
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="tel"
            aria-describedby={describedBy}
            invalid={invalid}
            value={draft.whatsapp}
            onChange={(event) => set('whatsapp', event.target.value)}
          />
        )}
      </FormField>
      <FormField
        label={t('basics.email')}
        hint={errorText('email') ?? t('basics.contactHelp')}
        hintTone={errors.email ? 'danger' : 'neutral'}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="email"
            aria-describedby={describedBy}
            invalid={invalid}
            maxLength={254}
            value={draft.email}
            onChange={(event) => set('email', event.target.value)}
          />
        )}
      </FormField>

      <CoverField
        weddingId={weddingId}
        audience={audience}
        cover={draft.cover}
        coupleNames={site.partners.map((partner) => partner.name.split(' ')[0]).join(' & ')}
        onChange={(cover) => set('cover', cover)}
      />
    </div>
  );

  function slugHint() {
    if (published) return { hint: t('basics.slugPublishedHelp'), hintTone: 'neutral' as const };
    if (!slugEditable) return identityHint;
    if (errors.slug) return { hint: errorText('slug'), hintTone: 'danger' as const };
    if (slugChanged && slugShapeError) {
      return {
        hint: basicsErrorText({
          t,
          tGuests,
          error: { code: slugShapeError, params: {} },
          audience,
        }),
        hintTone: 'danger' as const,
      };
    }
    if (slugConflict) {
      const suggestion = slugConflict.suggestion;
      return {
        hint: (
          <>
            {suggestion
              ? t(slugConflict.reason === 'reserved' ? 'basics.slugReserved' : 'basics.slugTaken', {
                  suggestion,
                })
              : basicsErrorText({
                  t,
                  tGuests,
                  error: { code: 'SLUG_FORMAT', params: {} },
                  audience,
                })}
            {suggestion && (
              <>
                {' '}
                <button
                  type="button"
                  className="kore-site-basics__suggestion"
                  onClick={() => set('slug', suggestion)}
                >
                  {t('basics.useSuggestion', { suggestion })}
                </button>
              </>
            )}
          </>
        ),
        hintTone: 'danger' as const,
      };
    }
    return { hint: t('basics.slugDraftHelp'), hintTone: 'neutral' as const };
  }
}

/** O texto de um erro dos Dados básicos, pelo código e pelo perfil (RN03 e RN06). */
export function basicsErrorText({
  t,
  tGuests,
  error,
  audience,
}: {
  t: TFunction<'site'>;
  tGuests: TFunction<'guests'>;
  error: { code: string; params: Record<string, unknown> } | undefined;
  audience: Audience;
}): string | undefined {
  if (!error) return undefined;
  const n = (error.params as { n?: number }).n ?? 0;
  switch (error.code) {
    case 'NAME_MISSING':
      return t(`basics.errors.nameMissing.${audience}`);
    case 'CITY_MISSING':
      return t(`basics.errors.cityMissing.${audience}`);
    case 'STATE_MISSING':
      return t(`basics.errors.stateMissing.${audience}`);
    case 'EMAIL_INVALID':
      return t(`basics.errors.emailInvalid.${audience}`);
    case 'SLUG_MISSING':
      return t(`basics.errors.slugMissing.${audience}`);
    case 'SLUG_FORMAT':
      return t(`basics.errors.slugFormat.${audience}`);
    // O WhatsApp usa os textos do telefone de Grupos e convidados (RN03; 189(4)).
    case 'PHONE_TOO_SHORT':
    case 'PHONE_TOO_LONG':
      return tGuests(`importSheet.rowErrors.${error.code}.${audience}`, { n });
    case 'PHONE_INVALID':
      return tGuests('importSheet.rowErrors.PHONE_INVALID', { n });
    default:
      return undefined;
  }
}
