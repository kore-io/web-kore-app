import { Radio, type RadioProps } from '@kore-io/design';
import { useId, type ReactNode } from 'react';

/**
 * A forma de pagamento do Publicar e da extensão (Penpot 21, "Formas", "Radio / Pix à vista"
 * e "Opção / Cartão de crédito"): no app pela decisão 321, porque o Radio do DS só tem o
 * rótulo. É o Radio da lib com uma legenda opcional abaixo, alinhada ao início do rótulo.
 * Os campos da forma escolhida (as parcelas, os juros, o cartão) vêm abaixo das opções, no
 * mesmo painel, e não dentro delas, como no Penpot.
 */

export interface PaymentOptionGroupProps {
  /** O id do título que nomeia o grupo (ex.: o do Painel "Forma de pagamento"). */
  labelledBy?: string;
  /** O nome do grupo, quando não há título na tela. */
  label?: string;
  /** As opções (PaymentOption). */
  children: ReactNode;
}

/** As opções lado a lado, com 24 px entre elas; quebram de linha quando não cabem. */
export function PaymentOptionGroup({ labelledBy, label, children }: PaymentOptionGroupProps) {
  return (
    <div
      role="radiogroup"
      className="kore-payment-option-group"
      {...(labelledBy !== undefined && { 'aria-labelledby': labelledBy })}
      {...(label !== undefined && { 'aria-label': label })}
    >
      {children}
    </div>
  );
}

export interface PaymentOptionProps extends Omit<RadioProps, 'children'> {
  /** O rótulo (ex.: "Pix à vista · 3% de desconto"). */
  label: ReactNode;
  /** A legenda em type.caption gray.700 (ex.: "Em até 12x. Até 6x, sem juros."). */
  caption?: ReactNode;
}

/** Uma opção: o Radio e, com 4 px, a legenda, que também descreve o Radio ao leitor de tela. */
export function PaymentOption({ label, caption, ...radio }: PaymentOptionProps) {
  const captionId = useId();
  const describedBy = [radio['aria-describedby'], caption !== undefined && captionId]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="kore-payment-option">
      <Radio {...radio} {...(describedBy !== '' && { 'aria-describedby': describedBy })}>
        {label}
      </Radio>
      {caption !== undefined && (
        <span id={captionId} className="kore-payment-option__caption">
          {caption}
        </span>
      )}
    </div>
  );
}
