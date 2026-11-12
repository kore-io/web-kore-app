import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMeControllerMeV1QueryKey } from '../../../shared/api/generated/me/me';
import type { CreateWeddingBodyState } from '../../../shared/api/generated/model';
import {
  useWeddingsControllerCreateV1,
  useWeddingsControllerSlugAvailabilityV1,
} from '../../../shared/api/generated/weddings/weddings';
import { ApiError, apiErrorCode } from '../../../shared/api/http-client';
import { reloadPage } from '../../../shared/browser/redirect';
import { useDebouncedValue } from '../../../shared/hooks/use-debounced-value';
import type { SignInNotice } from '../components/sign-in-alert';
import type {
  SlugStatus,
  WeddingDetailsField,
  WeddingDetailsValues,
} from '../components/wedding-details-form';
import { storedSignupOrigin } from '../signup-origin-storage';
import { clearSimulatorDraft, storedSimulatorDraft } from '../simulator-draft';
import type { SimulatorDraft } from '../../../shared/simulator/draft';
import { TERMS_VERSION } from '../terms';
import { isValidSlug, suggestSlug } from '../wedding-slug';

/** Espera depois da última tecla antes de checar o endereço (decisão 169). */
const SLUG_CHECK_DELAY_MS = 400;

const EMPTY: WeddingDetailsValues = {
  myName: '',
  myTitle: '',
  partnerName: '',
  eventDate: '',
  city: '',
  state: '',
  slug: '',
};

const REQUIRED: WeddingDetailsField[] = [
  'myName',
  'myTitle',
  'partnerName',
  'city',
  'state',
  'slug',
];

/**
 * O que o rascunho do Simule preenche (Cadastro RN12): os dois nomes na ordem digitada, a
 * data (vazia com "Ainda não sabemos a data") e a cidade; noivo ou noiva e a UF ficam
 * vazios, porque o simulador não sabe.
 */
export function valuesFromDraft(draft: SimulatorDraft): WeddingDetailsValues {
  return {
    ...EMPTY,
    myName: draft.names[0].trim(),
    partnerName: draft.names[1].trim(),
    eventDate: draft.noDate ? '' : (draft.eventDate ?? ''),
    city: draft.city.trim(),
  };
}

/** A origem e as UTM: as do rascunho valem sobre as guardadas (Simule RN10). */
function originFor(draft: SimulatorDraft | null) {
  if (!draft) return { signupSource: 'direct' as const, ...storedSignupOrigin() };
  return {
    ...storedSignupOrigin(),
    signupSource: draft.origin,
    ...(draft.utm.source && { utmSource: draft.utm.source }),
    ...(draft.utm.medium && { utmMedium: draft.utm.medium }),
    ...(draft.utm.campaign && { utmCampaign: draft.utm.campaign }),
  };
}

function body(error: unknown): Record<string, unknown> {
  return error instanceof ApiError && typeof error.body === 'object' && error.body !== null
    ? (error.body as Record<string, unknown>)
    : {};
}

/**
 * Dados do casamento (Cadastro, decisões 155, 166 e 169): o endereço sugerido dos nomes
 * até a pessoa editar (RN04), checado enquanto ela digita (RN05), e o POST /v1/weddings com
 * os 409 do contrato.
 */
export function useWeddingDetails({
  referralCode,
  ownerAtEntry = false,
}: {
  referralCode?: string | undefined;
  /** Já é dono ao abrir: o "Você já tem um casamento no Kore." direto (RN06). */
  ownerAtEntry?: boolean;
}) {
  const { t } = useTranslation('access');
  const queryClient = useQueryClient();
  // O rascunho do Simule, lido uma vez (Cadastro RN12); sem ele, o cadastro de sempre.
  const [draft] = useState(() => storedSimulatorDraft());
  const [values, setValues] = useState(() => (draft ? valuesFromDraft(draft) : EMPTY));
  const [typedSlug, setTypedSlug] = useState<string>();
  const [errors, setErrors] = useState<Partial<Record<WeddingDetailsField, string>>>({});
  const [notice, setNotice] = useState<SignInNotice>();
  const [conflict, setConflict] = useState<{ slug: string; suggestion: string }>();
  const [stage, setStage] = useState<'form' | 'invite-partner' | 'already-owner'>(
    ownerAtEntry ? 'already-owner' : 'form',
  );
  const [weddingId, setWeddingId] = useState<string>();
  const create = useWeddingsControllerCreateV1();

  const slug = typedSlug ?? suggestSlug(values);
  const checkedSlug = useDebouncedValue({ value: slug, delayMs: SLUG_CHECK_DELAY_MS });
  const availability = useWeddingsControllerSlugAvailabilityV1(
    { slug: checkedSlug, ...(values.eventDate && { eventDate: values.eventDate }) },
    { query: { enabled: isValidSlug({ slug: checkedSlug }), retry: false } },
  );

  const formatError =
    typedSlug !== undefined && slug !== '' && !isValidSlug({ slug })
      ? t('weddingDetails.errors.slugFormat')
      : undefined;

  function currentSlugStatus(): SlugStatus | undefined {
    if (conflict?.slug === slug) return { kind: 'taken', ...conflict };
    if (checkedSlug !== slug || !availability.data || availability.data.slug !== slug)
      return undefined;
    const { available, suggestion } = availability.data;
    if (available) return { kind: 'available', slug };
    return suggestion ? { kind: 'taken', slug, suggestion } : undefined;
  }

  function submit(submitted: WeddingDetailsValues) {
    const missing = REQUIRED.filter((field) => submitted[field] === '');
    if (missing.length > 0 || formatError) {
      setErrors(
        Object.fromEntries(
          missing.map((field) => [field, t(`weddingDetails.errors.${field}`)]),
        ) as Partial<Record<WeddingDetailsField, string>>,
      );
      return;
    }
    setErrors({});
    setNotice(undefined);
    create.mutate(
      {
        data: {
          myName: submitted.myName,
          myTitle: submitted.myTitle === 'groom' ? 'groom' : 'bride',
          partnerName: submitted.partnerName,
          ...(submitted.eventDate && { eventDate: submitted.eventDate }),
          city: submitted.city,
          state: submitted.state as CreateWeddingBodyState,
          slug: submitted.slug,
          ...(referralCode !== undefined && { referralCode }),
          termsVersion: TERMS_VERSION,
          // A origem da chegada (decisão 169(2)); sem ela, direct. Do Simule, a dele.
          ...originFor(draft),
          // A aparência do simulador, sem a foto (Simule RN10), validada de novo no servidor.
          ...(draft && {
            appearance: {
              fontPairKey: draft.fontPairKey,
              starterPaletteKey: draft.starterPaletteKey,
              primaryColor: draft.primaryColor,
              accentColor: draft.accentColor,
              backgroundMode: draft.backgroundMode,
            },
          }),
        },
      },
      {
        onSuccess: (created) => {
          // O rascunho virou o casamento e sai do aparelho (Simule RN10).
          clearSimulatorDraft();
          setWeddingId(created.weddingId);
          // O casamento nasceu e o perfil do casal também: a sessão é lida de novo, sem
          // descartar a atual (zerar faria a tela voltar ao carregando e perder este passo).
          void queryClient.invalidateQueries({ queryKey: getMeControllerMeV1QueryKey() });
          setStage('invite-partner');
        },
        onError: (error) => {
          switch (apiErrorCode({ error })) {
            case 'SLUG_UNAVAILABLE': {
              const suggestion = body(error).suggestion;
              if (typeof suggestion === 'string') setConflict({ slug: submitted.slug, suggestion });
              else setErrors({ slug: t('weddingDetails.errors.slugFormat') });
              return;
            }
            case 'ALREADY_OWNER':
              setStage('already-owner');
              return;
            case 'TERMS_VERSION_OUTDATED':
              // O app está com os termos antigos: recarregar traz a versão nova (decisão 169(1)).
              reloadPage();
              return;
            case 'RATE_LIMITED':
              setNotice({ kind: 'rate-limited' });
              return;
            default:
              setNotice({ kind: 'generic' });
          }
        },
      },
    );
  }

  const slugStatus = currentSlugStatus();
  return {
    /** Abre a área do casal com a sessão já relida (o perfil do casal ativo). */
    openWedding: async () => {
      await queryClient.refetchQueries({ queryKey: getMeControllerMeV1QueryKey() });
    },
    stage,
    weddingId,
    /** O rascunho do Simule aplicado ao formulário (Cadastro RN12), se houver. */
    draft,
    draftValues: draft ? valuesFromDraft(draft) : undefined,
    partnerName: values.partnerName,
    slugValue: slug,
    slugStatus,
    errors: formatError ? { ...errors, slug: formatError } : errors,
    notice,
    submitting: create.isPending,
    onValuesChange: setValues,
    onSlugChange: ({ slug: next }: { slug: string }) => setTypedSlug(next),
    submit,
  };
}
