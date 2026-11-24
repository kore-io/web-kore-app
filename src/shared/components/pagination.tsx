import { IconButton } from '@kore-io/design';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  /** A página atual, a partir de 1. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Os textos vêm do app (i18n). */
  labels: {
    /** O nome da navegação para o leitor de tela (ex.: "Páginas"). */
    navigation: string;
    /** "Mostrando 1 a 25 de 132", com os números já calculados. */
    summary: (range: { from: number; to: number; total: number }) => string;
    previous: string;
    next: string;
  };
  className?: string;
}

/** O intervalo mostrado (1 a 25 de N); sem itens, de 0 a 0. */
export function paginationRange({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}): { from: number; to: number; total: number; pages: number } {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return { from: 0, to: 0, total, pages };
  const current = Math.min(Math.max(1, page), pages);
  return {
    from: (current - 1) * pageSize + 1,
    to: Math.min(current * pageSize, total),
    total,
    pages,
  };
}

/**
 * Paginação das listas (no app pela decisão 321) (a tabela de dados do Backoffice, do extrato e dos repasses):
 * "Mostrando 1 a 25 de N" em type.caption gray.700 e os botões Anterior e Próxima, de 40 px
 * com a área de toque de 44 px, desabilitados nas pontas. O resumo é uma região viva
 * educada: a troca de página é anunciada.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  labels,
  className,
}: PaginationProps) {
  const range = paginationRange({ page, pageSize, total });
  const current = Math.min(Math.max(1, page), range.pages);
  return (
    <nav
      aria-label={labels.navigation}
      className={className === undefined ? 'kore-pagination' : `kore-pagination ${className}`}
    >
      <p className="kore-pagination__summary" aria-live="polite">
        {labels.summary({ from: range.from, to: range.to, total: range.total })}
      </p>
      <div className="kore-pagination__buttons">
        <IconButton
          icon={<ChevronLeft size={20} />}
          label={labels.previous}
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        />
        <IconButton
          icon={<ChevronRight size={20} />}
          label={labels.next}
          disabled={current >= range.pages}
          onClick={() => onPageChange(current + 1)}
        />
      </div>
    </nav>
  );
}
