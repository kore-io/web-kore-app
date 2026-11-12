import {
  Button,
  Checkbox,
  DateField,
  FileUpload,
  GoogleButton,
  Input,
  Label,
  Progress,
  siteColors,
  siteFonts,
} from '@kore-io/design';
import { Check, ChevronLeft } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FONT_PAIR_KEYS,
  PALETTE_KEYS,
  STARTER_PALETTES,
  checkAppearance,
  isHexColor,
} from '../../features/site/appearance';
import { compressImage, MAX_SOURCE_BYTES } from '../../features/site/images/compress-image';
import { loadEditorFonts } from '../../features/site/site-fonts';
import type { SimulatorStep } from '../../shared/simulator/draft';
import { KORE_URL } from '../links';
import { ColorSheet } from './color-sheet';
import { recordSimulatorEvent } from './events';
import { handoffLinks } from './handoff';
import { SimulatorPreview } from './simulator-preview';
import { useSimulatorDraft } from './use-simulator-draft';

const NAME_MAX = 80;
const ORDER: readonly SimulatorStep[] = ['names', 'when', 'style', 'photo', 'done'];
const STEP_NUMBER: Partial<Record<SimulatorStep, number>> = {
  names: 1,
  when: 2,
  style: 3,
  photo: 4,
};

/**
 * O Simule (kore.com.br/simule; Simule RN02 a RN12): uma pergunta por tela, com a prévia
 * fixa no topo (no desktop, à esquerda), do Passo 1 ao Pronto, e o Retomar quando há
 * rascunho no navegador. A foto fica só na memória da aba.
 */
export function SimulatorPage({ search = window.location.search }: { search?: string }) {
  const { t } = useTranslation('publicSite');
  const { draft, resuming, update, resume, restart } = useSimulatorDraft({ search });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<'type' | 'tooBig' | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const titleId = useId();
  const step = draft.step === 'start' ? 'names' : draft.step;

  useEffect(() => {
    recordSimulatorEvent('simule_iniciado');
  }, []);
  useEffect(() => {
    if (step === 'done' && !resuming) recordSimulatorEvent('simule_pronto');
  }, [step, resuming]);
  useEffect(() => {
    if (step === 'style') void loadEditorFonts();
  }, [step]);

  // A prévia acompanha a cor do Outra cor quando ela vale; bloqueada, fica na última boa.
  const pickerValid =
    picker !== null &&
    isHexColor(picker) &&
    !checkAppearance({
      primaryColor: picker,
      accentColor: draft.accentColor,
      backgroundMode: draft.backgroundMode,
    }).blocked;
  const previewColor = pickerValid && picker ? picker : draft.primaryColor;

  function go(next: SimulatorStep) {
    update({ step: next });
    window.scrollTo?.({ top: 0 });
  }

  function back() {
    if (resuming) {
      window.location.assign(KORE_URL);
      return;
    }
    const index = ORDER.indexOf(step);
    const previous = ORDER[index - 1];
    if (previous) {
      go(previous);
      return;
    }
    // No passo 1, volta à página de origem, ou ao Início do Kore (RN07).
    if (document.referrer && window.history.length > 1) window.history.back();
    else window.location.assign(KORE_URL);
  }

  async function choosePhoto(file: File) {
    setPhotoError(null);
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setPhotoError('type');
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setPhotoError('tooBig');
      return;
    }
    try {
      const blob = await compressImage(file);
      if (!blob) {
        setPhotoError('tooBig');
        return;
      }
      setPhotoUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(blob);
      });
    } catch {
      setPhotoError('type');
    }
  }

  const number = STEP_NUMBER[step];
  const progress = resuming ? (STEP_NUMBER[draft.step] ?? 4) : step === 'done' ? 4 : (number ?? 1);
  const [mine, partner] = draft.names;
  const canContinue =
    step === 'names'
      ? Boolean(mine.trim() && partner.trim())
      : step === 'when'
        ? Boolean(draft.city.trim() && (draft.eventDate || draft.noDate))
        : true;

  return (
    <div className="kore-simule">
      <SimulatorPreview
        names={draft.names}
        eventDate={draft.noDate ? null : draft.eventDate}
        city={draft.city}
        fontPairKey={draft.fontPairKey}
        primaryColor={previewColor}
        accentColor={draft.accentColor}
        backgroundMode={draft.backgroundMode}
        photoUrl={photoUrl}
      />
      <div className="kore-simule__column">
        <div className="kore-simule__head">
          <div className="kore-simule__top">
            <button type="button" className="kore-simule__back" onClick={back}>
              <ChevronLeft aria-hidden="true" />
              {t('simulator.back')}
            </button>
            <span className="kore-simule__step">
              {resuming
                ? t('simulator.saved')
                : step === 'done'
                  ? t('simulator.done')
                  : t('simulator.step', { n: number })}
            </span>
          </div>
          <Progress
            className="kore-simule__progress"
            hideHeader
            label={
              resuming
                ? t('simulator.saved')
                : step === 'done'
                  ? t('simulator.done')
                  : t('simulator.step', { n: number })
            }
            value={progress}
            max={4}
          />
        </div>

        <main className="kore-simule__panel" aria-labelledby={titleId}>
          <div className="kore-simule__body">
            {resuming ? (
              <>
                <h1 id={titleId} className="kore-simule__title">
                  {t('simulator.resume.title')}
                </h1>
                <p className="kore-simule__help">{t('simulator.resume.help')}</p>
              </>
            ) : step === 'names' ? (
              <>
                <h1 id={titleId} className="kore-simule__title">
                  {t('simulator.names.title')}
                </h1>
                <p className="kore-simule__help">{t('simulator.names.help')}</p>
                <Field label={t('simulator.names.mine')}>
                  {(id) => (
                    <Input
                      id={id}
                      autoComplete="given-name"
                      maxLength={NAME_MAX}
                      placeholder={t('simulator.names.mineExample')}
                      value={mine}
                      onChange={(event) => update({ names: [event.target.value, partner] })}
                    />
                  )}
                </Field>
                <Field label={t('simulator.names.partner')}>
                  {(id) => (
                    <Input
                      id={id}
                      maxLength={NAME_MAX}
                      placeholder={t('simulator.names.partnerExample')}
                      value={partner}
                      onChange={(event) => update({ names: [mine, event.target.value] })}
                    />
                  )}
                </Field>
              </>
            ) : step === 'when' ? (
              <>
                <h1 id={titleId} className="kore-simule__title">
                  {t('simulator.when.title')}
                </h1>
                <p className="kore-simule__help">{t('simulator.when.help')}</p>
                <Field label={t('simulator.when.date')}>
                  {(id) => (
                    <DateField
                      id={id}
                      disabled={draft.noDate}
                      value={draft.eventDate ?? ''}
                      onChange={(event) => update({ eventDate: event.target.value || null })}
                    />
                  )}
                </Field>
                <Checkbox
                  checked={draft.noDate}
                  onChange={(event) =>
                    update({
                      noDate: event.target.checked,
                      ...(event.target.checked && { eventDate: null }),
                    })
                  }
                >
                  {t('simulator.when.noDate')}
                </Checkbox>
                <Field label={t('simulator.when.city')}>
                  {(id) => (
                    <Input
                      id={id}
                      autoComplete="address-level2"
                      maxLength={NAME_MAX}
                      value={draft.city}
                      onChange={(event) => update({ city: event.target.value })}
                    />
                  )}
                </Field>
              </>
            ) : step === 'style' ? (
              <>
                <h1 id={titleId} className="kore-simule__title">
                  {t('simulator.style.title')}
                </h1>
                <p className="kore-simule__help">{t('simulator.style.help')}</p>
                <fieldset className="kore-simule__group" aria-describedby="kore-simule-other-help">
                  <legend className="kore-simule__legend">{t('simulator.style.colors')}</legend>
                  <div className="kore-simule__swatches">
                    {PALETTE_KEYS.map((key) => {
                      const palette = STARTER_PALETTES[key];
                      return (
                        <label key={key} className="kore-simule__swatch">
                          <input
                            type="radio"
                            name="kore-simule-palette"
                            className="kore-simule__swatch-input"
                            aria-label={siteColors[key].label}
                            checked={draft.starterPaletteKey === key}
                            onChange={() =>
                              update({
                                starterPaletteKey: key,
                                primaryColor: palette.primary,
                                accentColor: palette.accent,
                                backgroundMode: palette.background,
                              })
                            }
                          />
                          <span
                            className="kore-simule__swatch-dot"
                            style={{ backgroundColor: palette.primary }}
                          />
                        </label>
                      );
                    })}
                    <button
                      type="button"
                      className="kore-simule__swatch-other"
                      aria-label={t('simulator.style.other')}
                      aria-pressed={draft.starterPaletteKey === null}
                      onClick={() => {
                        recordSimulatorEvent('simule_outra_cor_aberta');
                        setPicker(draft.primaryColor);
                      }}
                    />
                  </div>
                  <p id="kore-simule-other-help" className="kore-simule__caption">
                    {t('simulator.style.otherHelp')}
                  </p>
                </fieldset>
                <fieldset className="kore-simule__group">
                  <legend className="kore-simule__legend">{t('simulator.style.fonts')}</legend>
                  <div className="kore-simule__fonts">
                    {FONT_PAIR_KEYS.map((key) => (
                      <label key={key} className="kore-simule__font">
                        <input
                          type="radio"
                          name="kore-simule-fonts"
                          className="kore-simule__font-input"
                          checked={draft.fontPairKey === key}
                          onChange={() => update({ fontPairKey: key })}
                        />
                        <span
                          className="kore-simule__font-label"
                          style={{ fontFamily: `'${siteFonts[key].display}', serif` }}
                        >
                          {siteFonts[key].label}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : step === 'photo' ? (
              <>
                <h1 id={titleId} className="kore-simule__title">
                  {t('simulator.photo.title')}
                </h1>
                <p className="kore-simule__help">{t('simulator.photo.help')}</p>
                <FileUpload
                  title={t('simulator.photo.drop')}
                  hint={t('simulator.photo.dropHint')}
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  onFile={(file) => void choosePhoto(file)}
                />
                {photoError && (
                  <p className="kore-simule__error" role="alert">
                    {t(`simulator.photo.errors.${photoError}`)}
                  </p>
                )}
                {photoUrl && (
                  <button
                    type="button"
                    className="kore-simule__link"
                    onClick={() => {
                      URL.revokeObjectURL(photoUrl);
                      setPhotoUrl(null);
                    }}
                  >
                    {t('simulator.photo.remove')}
                  </button>
                )}
                <p className="kore-simule__caption">{t('simulator.photo.notice')}</p>
              </>
            ) : (
              <Ready titleId={titleId} hasPhoto={photoUrl !== null} draft={draft} />
            )}
          </div>

          {(resuming || step !== 'done') && (
            <div className="kore-simule__footer">
              {resuming ? (
                <>
                  <Button className="kore-simule__primary" onClick={resume}>
                    {t('simulator.resume.continue')}
                  </Button>
                  <button type="button" className="kore-simule__link" onClick={restart}>
                    {t('simulator.resume.restart')}
                  </button>
                </>
              ) : (
                <>
                  <Button
                    className="kore-simule__primary"
                    disabled={!canContinue}
                    onClick={() => {
                      if (step === 'names') recordSimulatorEvent('simule_nomes');
                      const next = ORDER[ORDER.indexOf(step) + 1];
                      if (next) go(next);
                    }}
                  >
                    {t('simulator.continue')}
                  </Button>
                  {step === 'photo' && (
                    <button
                      type="button"
                      className="kore-simule__link"
                      onClick={() => {
                        if (photoUrl) URL.revokeObjectURL(photoUrl);
                        setPhotoUrl(null);
                        go('done');
                      }}
                    >
                      {t('simulator.photo.skip')}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>
      <ColorSheet
        open={picker !== null}
        value={picker ?? draft.primaryColor}
        accentColor={draft.accentColor}
        backgroundMode={draft.backgroundMode}
        onChange={setPicker}
        onUse={() => {
          if (picker) update({ primaryColor: picker.toUpperCase(), starterPaletteKey: null });
          setPicker(null);
        }}
        onClose={() => {
          if (picker !== null) recordSimulatorEvent('simule_outra_cor_desistiu');
          setPicker(null);
        }}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="kore-simule__field">
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
    </div>
  );
}

/** O Pronto (RN02, RN04, RN08): os botões levam o rascunho, sem a foto, ao app. */
function Ready({
  titleId,
  hasPhoto,
  draft,
}: {
  titleId: string;
  hasPhoto: boolean;
  draft: Parameters<typeof handoffLinks>[0];
}) {
  const { t } = useTranslation('publicSite');
  const links = handoffLinks(draft);
  return (
    <>
      <h1 id={titleId} className="kore-simule__title">
        {t('simulator.ready.title')}
      </h1>
      <p className="kore-simule__help">{t('simulator.ready.help')}</p>
      <ul className="kore-simule__list">
        {(['guests', 'invites', 'gifts'] as const).map((key) => (
          <li key={key} className="kore-simule__item">
            <Check aria-hidden="true" />
            {t(`simulator.ready.${key}`)}
          </li>
        ))}
      </ul>
      <div className="kore-simule__ready-actions">
        <GoogleButton
          className="kore-simule__primary"
          onClick={() => window.location.assign(links.google)}
        >
          {t('simulator.ready.google')}
        </GoogleButton>
        <Button
          variant="secondary"
          className="kore-simule__primary"
          onClick={() => window.location.assign(links.email)}
        >
          {t('simulator.ready.email')}
        </Button>
        {hasPhoto && <p className="kore-simule__caption">{t('simulator.ready.photoNotice')}</p>}
        <p className="kore-simule__caption">{t('simulator.ready.draftNotice')}</p>
        <a className="kore-simule__link" href={links.signIn}>
          {t('simulator.ready.signIn')}
        </a>
      </div>
    </>
  );
}
