import { Label } from '@kore-io/design';
import { useId, type ReactNode } from 'react';

export type FormFieldHintTone = 'neutral' | 'success' | 'danger';

export interface FormFieldProps {
  label: string;
  /** Marca de opcional ao lado do rótulo, vinda da Voz. */
  optionalText?: string;
  /** Ajuda abaixo do campo (Penpot "Ajuda": caption gray.700; success.text; danger.text). */
  hint?: string;
  hintTone?: FormFieldHintTone;
  /**
   * O campo, recebendo o id (para o rótulo) e o id da ajuda (para o aria-describedby) e
   * se está em erro.
   */
  children: (control: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/**
 * Campo de formulário das telas (os "Campo /" do Penpot): rótulo, o controle e a ajuda,
 * com 6 px entre eles. A ajuda em danger marca o erro e é ligada ao campo.
 */
export function FormField({
  label,
  optionalText,
  hint,
  hintTone = 'neutral',
  children,
}: FormFieldProps) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="kore-form-field">
      <Label htmlFor={id} {...(optionalText !== undefined && { optionalText })}>
        {label}
      </Label>
      {children({
        id,
        ...(hint !== undefined && { describedBy: hintId }),
        invalid: hint !== undefined && hintTone === 'danger',
      })}
      {hint !== undefined && (
        <p id={hintId} className={`kore-form-field__hint kore-form-field__hint--${hintTone}`}>
          {hint}
        </p>
      )}
    </div>
  );
}
