import { Button, Checkbox, DateField, Input, PageHeader, Select, useToast } from '@kore-io/design';
import { Check } from 'lucide-react';
import { Fragment, useEffect, useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import { BRAZIL_STATES } from '../../../shared/brazil-states';
import { FormField } from '../../../shared/components/form-field';
import { SitePreviewCard } from '../../access/components/site-preview-card';
import { formatLongDate } from '../../access/profile-texts';
import { checkAppearance } from '../../site/appearance';
import { AppearanceFields, useAppearanceDraft } from '../../site/components/appearance-fields';
import { loadEditorFonts } from '../../site/site-fonts';
import { SITE_BACKGROUND_NAMES } from '../../../site/theme';
import { DEFAULT_APPEARANCE, useNewWedding, type NewWeddingField } from './use-new-wedding';

const STEPS = ['data', 'appearance', 'invite', 'done'] as const;
type Step = (typeof STEPS)[number];

/**
 * Novo casamento da cerimonialista (D6a da F6; Novo casamento RN01 a RN04; Penpot 05;
 * decisões 280 e a divisão do D6), em /cerimonialista/casamentos/novo:
 * - o passo 1 (Dados) e o passo 2 (Aparência, com a prévia);
 * - o casamento nasce no Continuar do passo 2 (POST /v1/me/weddings).
 * Os passos 3 e 4 chegam no D6b; até lá, o Continuar leva ao detalhe em Meus casamentos.
 */
export function NewWeddingPage() {
  const { t } = useTranslation('planner');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const wedding = useNewWedding();
  const appearance = useAppearanceDraft({ initial: DEFAULT_APPEARANCE });
  const [step, setStep] = useState<Extract<Step, 'data' | 'appearance'>>('data');

  useEffect(() => {
    if (step === 'appearance') void loadEditorFonts();
  }, [step]);

  async function create() {
    if (!appearance.canSave) return;
    const result = await wedding.submit({ appearance: appearance.body });
    if (result.ok) {
      showToast({ tone: 'success', message: t('newWedding.created') });
      void navigate(`${paths.plannerArea}?casamento=${encodeURIComponent(result.weddingId)}`);
      return;
    }
    if (result.reason === 'slug') {
      // O endereço foi ocupado no meio do caminho: volta ao passo 1 com a sugestão.
      setStep('data');
      return;
    }
    if (result.reason === 'contrast') {
      appearance.setServerBlock(result.block ?? 'primary_foreground');
      return;
    }
    showToast({
      tone: 'danger',
      message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
    });
  }

  return (
    <div className="kore-new-wedding">
      <PageHeader title={t('newWedding.title')} description={t(`newWedding.subtitle.${step}`)} />
      <Stepper current={step} />
      {step === 'data' ? (
        <DataStep wedding={wedding} onContinue={() => setStep('appearance')} />
      ) : (
        <div className="kore-new-wedding__appearance">
          <form
            className="kore-new-wedding__card"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <AppearanceFields
              state={appearance}
              sampleNames={[wedding.values.partner1Name, wedding.values.partner2Name]
                .map((name) => name.trim().split(/\s+/)[0] ?? '')
                .join(' & ')}
              audience="planner"
            />
            <div className="kore-new-wedding__footer">
              <Button type="button" variant="ghost" onClick={() => setStep('data')}>
                {t('newWedding.back')}
              </Button>
              <Button
                type="submit"
                disabled={wedding.submitting || !appearance.canSave}
                aria-busy={wedding.submitting || undefined}
              >
                {t('newWedding.continue')}
              </Button>
            </div>
          </form>
          <Preview wedding={wedding} appearance={appearance} />
        </div>
      )}
    </div>
  );
}

/** "1 Dados do casamento — 2 Aparência — 3 Convidar o casal — 4 Pronto" (Penpot 05). */
function Stepper({ current }: { current: Step }) {
  const { t } = useTranslation('planner');
  const index = STEPS.indexOf(current);
  return (
    <ol className="kore-new-wedding__steps" aria-label={t('newWedding.title')}>
      {STEPS.map((step, position) => {
        const label = t(`newWedding.steps.${step}`);
        const done = position < index;
        const isCurrent = position === index;
        return (
          <li
            key={step}
            className="kore-new-wedding__step"
            data-state={done ? 'done' : isCurrent ? 'current' : 'next'}
            {...(isCurrent && { 'aria-current': 'step' as const })}
          >
            <span className="kore-new-wedding__step-mark" aria-hidden="true">
              {done ? <Check strokeWidth={2.4} /> : position + 1}
            </span>
            <span className="kore-new-wedding__step-label">
              {done ? (
                <>
                  <span aria-hidden="true">{label}</span>
                  <span className="kore-new-wedding__sr">
                    {t('newWedding.stepDone', { step: label })}
                  </span>
                </>
              ) : (
                label
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function DataStep({
  wedding,
  onContinue,
}: {
  wedding: ReturnType<typeof useNewWedding>;
  onContinue: () => void;
}) {
  const { t } = useTranslation('planner');
  const { t: tAccess } = useTranslation('access');
  const navigate = useNavigate();
  const namesId = useId();
  const { values, change, errors, slugStatus } = wedding;
  const error = (field: NewWeddingField) =>
    errors[field] !== undefined ? { hint: errors[field], hintTone: 'danger' as const } : {};
  const slugHint =
    errors.slug !== undefined
      ? { hint: errors.slug, hintTone: 'danger' as const }
      : slugStatus?.kind === 'taken'
        ? {
            hint: t('newWedding.slugTaken', { suggestion: slugStatus.suggestion }),
            hintTone: 'danger' as const,
          }
        : slugStatus?.kind === 'available'
          ? { hint: t('newWedding.slugAvailable'), hintTone: 'success' as const }
          : {};

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Só com um endereço livre, como no cadastro do casal (RN02; RN05 do Cadastro).
    if (wedding.validateData() && !wedding.slugChecking && slugStatus?.kind !== 'taken') {
      onContinue();
    }
  }

  return (
    <form className="kore-new-wedding__card" noValidate onSubmit={submit}>
      <fieldset className="kore-new-wedding__names">
        <legend id={namesId} className="kore-new-wedding__legend">
          {t('newWedding.names')}
        </legend>
        <div className="kore-new-wedding__names-row">
          {(['partner1Name', 'partner2Name'] as const).map((field, position) => (
            <Fragment key={field}>
              {position === 1 && (
                <span className="kore-new-wedding__ampersand" aria-hidden="true">
                  &amp;
                </span>
              )}
              <FormField label={t('newWedding.nameOf', { n: position + 1 })} {...error(field)}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    maxLength={120}
                    value={values[field]}
                    invalid={invalid}
                    onChange={(event) => change({ [field]: event.target.value })}
                    {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
                  />
                )}
              </FormField>
            </Fragment>
          ))}
        </div>
      </fieldset>

      <FormField label={t('newWedding.eventDate')} optionalText={t('newWedding.optional')}>
        {({ id, describedBy }) => (
          <DateField
            id={id}
            value={values.noDate ? '' : values.eventDate}
            disabled={values.noDate}
            onChange={(event) => change({ eventDate: event.target.value })}
            {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
          />
        )}
      </FormField>
      <Checkbox
        checked={values.noDate}
        onChange={(event) => change({ noDate: event.target.checked })}
      >
        {t('newWedding.noDate')}
      </Checkbox>

      <div className="kore-new-wedding__place">
        <FormField label={tAccess('weddingDetails.city')} {...error('city')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              maxLength={120}
              autoComplete="address-level2"
              value={values.city}
              invalid={invalid}
              onChange={(event) => change({ city: event.target.value })}
              {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
            />
          )}
        </FormField>
        <FormField label={tAccess('weddingDetails.state')} {...error('state')}>
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              className="kore-new-wedding__state"
              placeholder={tAccess('weddingDetails.statePlaceholder')}
              value={values.state}
              invalid={invalid}
              onChange={(event) => change({ state: event.target.value })}
              {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
            >
              {BRAZIL_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>

      <FormField label={tAccess('weddingDetails.slug')} {...slugHint}>
        {({ id, describedBy, invalid }) => (
          <div className="kore-new-wedding__slug">
            <span className="kore-new-wedding__slug-prefix" aria-hidden="true">
              {t('newWedding.slugPrefix')}
            </span>
            <Input
              id={id}
              autoCapitalize="none"
              spellCheck={false}
              value={wedding.slug}
              invalid={invalid}
              onChange={(event) => wedding.changeSlug(event.target.value.trim())}
              {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
            />
          </div>
        )}
      </FormField>

      <div className="kore-new-wedding__footer">
        <Button type="button" variant="ghost" onClick={() => void navigate(paths.plannerArea)}>
          {t('newWedding.cancel')}
        </Button>
        <Button type="submit">{t('newWedding.continue')}</Button>
      </div>
    </form>
  );
}

/** A prévia ao lado do passo 2 (RN03): os nomes, a data e a cidade na aparência escolhida. */
function Preview({
  wedding,
  appearance,
}: {
  wedding: ReturnType<typeof useNewWedding>;
  appearance: ReturnType<typeof useAppearanceDraft>;
}) {
  const { t } = useTranslation('planner');
  const { values } = wedding;
  const { lastValid } = appearance;
  const date =
    !values.noDate && values.eventDate ? formatLongDate({ isoDate: values.eventDate }) : '';
  const place = values.city.trim() ? `${values.city.trim()} (${values.state})` : '';
  const { primaryForeground } = checkAppearance({
    primaryColor: lastValid.primaryColor,
    accentColor: lastValid.accentColor,
    backgroundMode: lastValid.backgroundMode as 'light' | 'cream' | 'dark',
  });
  return (
    <aside className="kore-new-wedding__preview" aria-label={t('newWedding.previewTitle')}>
      <SitePreviewCard
        couple={`${values.partner1Name.trim()} & ${values.partner2Name.trim()}`}
        details={[date, place].filter(Boolean).join(' · ')}
        theme={{
          fonts: appearance.draft.fontPairKey,
          background:
            SITE_BACKGROUND_NAMES[lastValid.backgroundMode as 'light' | 'cream' | 'dark'] ??
            'creme',
          ...(lastValid.starterPaletteKey && {
            colors: lastValid.starterPaletteKey as never,
          }),
        }}
        {...(!lastValid.starterPaletteKey && {
          customColors: {
            primary: lastValid.primaryColor,
            primaryForeground,
            accent: lastValid.accentColor,
          },
        })}
      />
    </aside>
  );
}
