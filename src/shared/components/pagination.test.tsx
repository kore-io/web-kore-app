import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../tests/a11y';
import { Pagination, paginationRange, type PaginationProps } from './pagination';

const labels: PaginationProps['labels'] = {
  navigation: 'Páginas',
  summary: ({ from, to, total }) => `Mostrando ${from} a ${to} de ${total}`,
  previous: 'Página anterior',
  next: 'Próxima página',
};

function renderPagination(props: Partial<PaginationProps> = {}) {
  const onPageChange = vi.fn();
  const view = render(
    <Pagination
      page={1}
      pageSize={25}
      total={132}
      onPageChange={onPageChange}
      labels={labels}
      {...props}
    />,
  );
  return { ...view, onPageChange };
}

describe('paginationRange', () => {
  it('o intervalo de cada página, a última incompleta', () => {
    expect(paginationRange({ page: 1, pageSize: 25, total: 132 })).toEqual({
      from: 1,
      to: 25,
      total: 132,
      pages: 6,
    });
    expect(paginationRange({ page: 6, pageSize: 25, total: 132 })).toEqual({
      from: 126,
      to: 132,
      total: 132,
      pages: 6,
    });
  });

  it('sem itens, de 0 a 0; a página fora do intervalo vai para a ponta', () => {
    expect(paginationRange({ page: 1, pageSize: 25, total: 0 })).toEqual({
      from: 0,
      to: 0,
      total: 0,
      pages: 1,
    });
    expect(paginationRange({ page: 9, pageSize: 25, total: 30 })).toMatchObject({
      from: 26,
      to: 30,
    });
  });
});

describe('Pagination', () => {
  it('o resumo com os números, numa região viva, e a navegação com nome', () => {
    renderPagination({ page: 2 });
    expect(screen.getByRole('navigation', { name: 'Páginas' })).toBeInTheDocument();
    const summary = screen.getByText('Mostrando 26 a 50 de 132');
    expect(summary).toHaveAttribute('aria-live', 'polite');
  });

  it('Anterior e Próxima mudam a página', async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderPagination({ page: 2 });
    await user.click(screen.getByRole('button', { name: 'Página anterior' }));
    await user.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(onPageChange.mock.calls).toEqual([[1], [3]]);
  });

  it('nas pontas, o botão fica desabilitado', () => {
    renderPagination({ page: 1 });
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeEnabled();
  });

  it('com uma página só, os dois desabilitados', () => {
    renderPagination({ page: 1, total: 10 });
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled();
    expect(screen.getByText('Mostrando 1 a 10 de 10')).toBeInTheDocument();
  });

  it('sem violações de acessibilidade', async () => {
    const { container } = renderPagination({ page: 3 });
    await expectNoA11yViolations({ container });
  });
});
