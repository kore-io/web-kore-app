import { useId, type ReactNode } from 'react';

/**
 * O Painel das telas da Cobrança (Penpot 21, "Painel / …"): no app pela decisão 321, porque
 * o DS não tem um painel; promover ao DS fica como pendência do Penpot.
 */
export interface PanelProps {
  /** O título em type.overline (ex.: "Resumo"); é o título da seção para o leitor de tela. */
  title?: string;
  /** O nível do título (padrão 2, abaixo do h1 do Page Header). */
  headingLevel?: 2 | 3;
  /** O espaço entre os itens: 12 px (Resumo, Comparar) ou 16 px (formulários). */
  gap?: 'sm' | 'md';
  children: ReactNode;
  className?: string;
}

/**
 * Branco, borda gray.300 de 1 px, raio lg (16 px) e 20 px de respiro; com título, é uma
 * seção nomeada pelo título.
 */
export function Panel({ title, headingLevel = 2, gap = 'sm', children, className }: PanelProps) {
  const titleId = useId();
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const names = ['kore-panel', gap === 'md' && 'kore-panel--gap-md', className]
    .filter(Boolean)
    .join(' ');
  return (
    <section className={names} {...(title !== undefined && { 'aria-labelledby': titleId })}>
      {title !== undefined && (
        <Heading id={titleId} className="kore-panel__title">
          {title}
        </Heading>
      )}
      {children}
    </section>
  );
}
