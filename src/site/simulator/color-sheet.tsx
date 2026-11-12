import { Button, Input } from '@kore-io/design';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { checkAppearance, isHexColor, type BackgroundMode } from '../../features/site/appearance';

/**
 * O Outra cor do Simule (Simule RN03; Penpot "Outra cor"; decisão 226(4) e (5)): a folha
 * "Escolham a cor" com o seletor nativo e o hexadecimal, como no Editor. A cor boa diz a
 * cor do texto dos botões; a bloqueada mostra o texto da Aparência (sem "ou outro fundo",
 * que não se troca aqui) e trava o Usar esta cor.
 */
export function ColorSheet({
  open,
  value,
  accentColor,
  backgroundMode,
  onChange,
  onUse,
  onClose,
}: {
  open: boolean;
  value: string;
  accentColor: string;
  backgroundMode: BackgroundMode;
  onChange: (value: string) => void;
  onUse: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('publicSite');
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const hexId = useId();
  const messageId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  const valid = isHexColor(value);
  const check = valid
    ? checkAppearance({ primaryColor: value, accentColor, backgroundMode })
    : null;
  const blocked = check?.blocked ?? null;
  const message = !check
    ? null
    : blocked
      ? t(`simulator.picker.blocked.${blocked}`)
      : t(`simulator.picker.good.${check.primaryForeground === '#FFFFFF' ? 'white' : 'dark'}`);

  return (
    <dialog ref={dialog} className="kore-simule-sheet" aria-labelledby={titleId} onClose={onClose}>
      <div className="kore-simule-sheet__header">
        <h2 id={titleId} className="kore-simule-sheet__title">
          {t('simulator.picker.title')}
        </h2>
        <button type="button" className="kore-simule-sheet__close" onClick={onClose}>
          {t('simulator.picker.close')}
        </button>
      </div>
      <div className="kore-simule-sheet__row">
        <input
          type="color"
          className="kore-simule-sheet__picker"
          aria-label={t('simulator.picker.pick')}
          value={valid ? value.toLowerCase() : '#000000'}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
        <label htmlFor={hexId} className="kore-simule-sheet__label">
          {t('simulator.picker.color')}
        </label>
        <Input
          id={hexId}
          className="kore-simule-sheet__hex"
          invalid={!valid || blocked !== null}
          maxLength={7}
          autoCapitalize="characters"
          spellCheck={false}
          {...(message && { 'aria-describedby': messageId })}
          value={value}
          onChange={(event) =>
            onChange(`#${event.target.value.replace(/[#\s]/g, '').toUpperCase()}`)
          }
        />
      </div>
      {message && (
        <p
          id={messageId}
          className={
            blocked
              ? 'kore-simule-sheet__message kore-simule-sheet__message--danger'
              : 'kore-simule-sheet__message'
          }
          {...(blocked && { role: 'alert' })}
        >
          {blocked ? <CircleAlert aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
          {message}
        </p>
      )}
      <Button
        className="kore-simule-sheet__use"
        disabled={!check || blocked !== null}
        onClick={onUse}
      >
        {t('simulator.picker.use')}
      </Button>
    </dialog>
  );
}
