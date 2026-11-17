import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getMeControllerMeV1QueryKey,
  usePlannerControllerCreatePlannerWeddingV1,
} from '../../../shared/api/generated/me/me';
import type {
  CreatePlannerWeddingBodyState,
  SiteEditorAppearanceResponse,
  UpdateSiteAppearanceBody,
} from '../../../shared/api/generated/model';
import { getMyWeddingsControllerListV1QueryKey } from '../../../shared/api/generated/planner/planner';
import { useWeddingsControllerSlugAvailabilityV1 } from '../../../shared/api/generated/weddings/weddings';
import { apiErrorCode } from '../../../shared/api/http-client';
import { useDebouncedValue } from '../../../shared/hooks/use-debounced-value';
import { isValidSlug, suggestSlug } from '../../access/wedding-slug';
import { STARTER_PALETTES, type ContrastBlock } from '../../site/appearance';

/** Os campos do passo 1 (Novo casamento RN02). */
export interface NewWeddingData {
  partner1Name: string;
  partner2Name: string;
  eventDate: string;
  noDate: boolean;
  city: string;
  state: string;
}

export type NewWeddingField = 'partner1Name' | 'partner2Name' | 'city' | 'state' | 'slug';

const TEXT_MAX = 80;
const SLUG_CHECK_DELAY_MS = 400;

const EMPTY: NewWeddingData = {
  partner1Name: '',
  partner2Name: '',
  eventDate: '',
  noDate: false,
  city: '',
  state: '',
};

/** O padrão do Kore sem modelo (RN03; nota do Penpot 06): Romântico, Terracota, Creme. */
export const DEFAULT_APPEARANCE: SiteEditorAppearanceResponse = {
  fontPairKey: 'romantico',
  starterPaletteKey: 'terracota',
  primaryColor: STARTER_PALETTES.terracota.primary,
  accentColor: STARTER_PALETTES.terracota.accent,
  backgroundMode: STARTER_PALETTES.terracota.background,
};

function errorBody(error: unknown): Record<string, unknown> {
  const body = (error as { body?: unknown }).body;
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
}

/**
 * O Novo casamento da cerimonialista (D6a da F6; Novo casamento RN01 a RN04):
 * - o passo 1 com os nomes, a data opcional, a cidade, a UF e o endereço, com a
 *   disponibilidade e a sugestão do GET …/slug-availability, como no cadastro do casal;
 * - o casamento nasce no fim do passo 2, pelo POST /v1/me/weddings, com a aparência.
 */
export function useNewWedding() {
  const { t } = useTranslation('planner');
  const { t: tAccess } = useTranslation('access');
  const queryClient = useQueryClient();
  const create = usePlannerControllerCreatePlannerWeddingV1();
  const [values, setValues] = useState<NewWeddingData>(EMPTY);
  const [typedSlug, setTypedSlug] = useState<string>();
  const [errors, setErrors] = useState<Partial<Record<NewWeddingField, string>>>({});
  const [conflict, setConflict] = useState<{ slug: string; suggestion: string }>();

  const slug =
    typedSlug ?? suggestSlug({ myName: values.partner1Name, partnerName: values.partner2Name });
  const checkedSlug = useDebouncedValue({ value: slug, delayMs: SLUG_CHECK_DELAY_MS });
  const eventDate = values.noDate ? '' : values.eventDate;
  const availability = useWeddingsControllerSlugAvailabilityV1(
    { slug: checkedSlug, ...(eventDate && { eventDate }) },
    { query: { enabled: isValidSlug({ slug: checkedSlug }), retry: false } },
  );

  function slugStatus(): { kind: 'available' } | { kind: 'taken'; suggestion: string } | undefined {
    if (conflict?.slug === slug) return { kind: 'taken', suggestion: conflict.suggestion };
    if (checkedSlug !== slug || availability.data?.slug !== slug) return undefined;
    if (availability.data.available) return { kind: 'available' };
    return availability.data.suggestion
      ? { kind: 'taken', suggestion: availability.data.suggestion }
      : undefined;
  }

  function change(patch: Partial<NewWeddingData>) {
    setValues((current) => ({ ...current, ...patch }));
    // O erro some do campo que mudou.
    setErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !(key in patch))),
    );
  }

  function changeSlug(next: string) {
    setTypedSlug(next);
    setErrors((current) => {
      const next = { ...current };
      delete next.slug;
      return next;
    });
  }

  /** Confere o passo 1 (RN02); com erro, mostra abaixo de cada campo. */
  function validateData(): boolean {
    const found: Partial<Record<NewWeddingField, string>> = {};
    for (const field of ['partner1Name', 'partner2Name'] as const) {
      const name = values[field].trim();
      if (!name) found[field] = t('newWedding.errors.name');
      else if (name.length > TEXT_MAX) found[field] = t('newWedding.errors.nameTooLong');
    }
    const city = values.city.trim();
    if (!city) found.city = tAccess('weddingDetails.errors.city');
    else if (city.length > TEXT_MAX) found.city = t('newWedding.errors.cityTooLong');
    if (!values.state) found.state = tAccess('weddingDetails.errors.state');
    if (!slug) found.slug = tAccess('weddingDetails.errors.slug');
    else if (!isValidSlug({ slug })) found.slug = tAccess('weddingDetails.errors.slugFormat');
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  /**
   * Cria o casamento (RN04). Devolve o id; no SLUG_UNAVAILABLE, a volta ao passo 1 com a
   * sugestão; no CONTRAST_TOO_LOW, o bloqueio do contraste; no resto, o aviso genérico.
   */
  async function submit({
    appearance,
  }: {
    appearance: UpdateSiteAppearanceBody;
  }): Promise<
    | { ok: true; weddingId: string }
    | { ok: false; reason: 'slug' | 'contrast' | 'generic'; block?: ContrastBlock }
  > {
    try {
      const created = await create.mutateAsync({
        data: {
          partner1Name: values.partner1Name.trim(),
          partner2Name: values.partner2Name.trim(),
          ...(eventDate && { eventDate }),
          city: values.city.trim(),
          state: values.state as CreatePlannerWeddingBodyState,
          slug,
          appearance,
        },
      });
      void queryClient.invalidateQueries({ queryKey: getMyWeddingsControllerListV1QueryKey() });
      void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
      return { ok: true, weddingId: created.weddingId };
    } catch (error) {
      const code = apiErrorCode({ error });
      if (code === 'SLUG_UNAVAILABLE') {
        const suggestion = errorBody(error).suggestion;
        if (typeof suggestion === 'string') setConflict({ slug, suggestion });
        else setErrors({ slug: tAccess('weddingDetails.errors.slugFormat') });
        return { ok: false, reason: 'slug' };
      }
      if (code === 'CONTRAST_TOO_LOW') {
        const check = errorBody(error).check;
        return {
          ok: false,
          reason: 'contrast',
          block: (typeof check === 'string' ? check : 'primary_foreground') as ContrastBlock,
        };
      }
      // O teto de 50 sem dono (OWNERLESS_WEDDINGS_LIMIT) não aparece na tela (RN04).
      return { ok: false, reason: 'generic' };
    }
  }

  return {
    values,
    change,
    slug,
    changeSlug,
    slugStatus: slugStatus(),
    // A checagem do endereço digitado ainda sem resposta; se falhar, o POST confere.
    slugChecking:
      isValidSlug({ slug }) &&
      conflict?.slug !== slug &&
      (checkedSlug !== slug || availability.isFetching),
    errors,
    validateData,
    submit,
    submitting: create.isPending,
  };
}
