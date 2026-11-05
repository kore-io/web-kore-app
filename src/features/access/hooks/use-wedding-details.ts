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
export function useWeddingDetails({ referralCode }: { referralCode?: string | undefined }) {
  const { t } = useTranslation('access');
  const queryClient = useQueryClient();
  const [values, setValues] = useState(EMPTY);
  const [typedSlug, setTypedSlug] = useState<string>();
  const [errors, setErrors] = useState<Partial<Record<WeddingDetailsField, string>>>({});
  const [notice, setNotice] = useState<SignInNotice>();
  const [conflict, setConflict] = useState<{ slug: string; suggestion: string }>();
  const [stage, setStage] = useState<'form' | 'invite-partner' | 'already-owner'>('form');
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
          signupSource: 'direct',
        },
      },
      {
        onSuccess: () => {
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
