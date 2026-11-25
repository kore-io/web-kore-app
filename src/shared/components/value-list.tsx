import type { ReactNode } from 'react';

/**
 * As linhas de valor do Resumo e do Comparar (Penpot 21, "Linha / …" e "Linha / Total"):
 * no app pela decisão 321. Uma lista de descrição: o rótulo no `dt` e o valor no `dd`. Os
 * valores chegam já formatados (`formatCents`, com o "−R$" dos descontos).
 */
export function ValueList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl className={className === undefined ? 'kore-value-list' : `kore-value-list ${className}`}>
      {children}
    </dl>
  );
}

export interface ValueRowProps {
  /** O rótulo em type.body.md gray.700 (ex.: "7 meses × R$ 29"). */
  label: ReactNode;
  /** O valor em type.label ink, à direita (ex.: "R$ 203,00" ou "−R$ 48,00"). */
  value: ReactNode;
  /**
   * A legenda da linha em type.caption gray.700 (ex.: "A publicação custa no máximo R$ 449,
   * a partir de 11 meses."), abaixo dela.
   */
  caption?: ReactNode;
}

export function ValueRow({ label, value, caption }: ValueRowProps) {
  return (
    <div className="kore-value-list__row">
      <dt className="kore-value-list__label">{label}</dt>
      <dd className="kore-value-list__value">{value}</dd>
      {caption !== undefined && <dd className="kore-value-list__caption">{caption}</dd>}
    </div>
  );
}

/**
 * O Total: o divisor gray.300 acima, o rótulo em type.label ink e o valor em type.heading
 * (18 px, 700).
 */
export function ValueTotal({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="kore-value-list__row kore-value-list__row--total">
      <dt className="kore-value-list__label">{label}</dt>
      <dd className="kore-value-list__value">{value}</dd>
    </div>
  );
}
