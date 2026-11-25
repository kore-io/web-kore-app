import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../tests/a11y';
import { Panel } from './panel';

describe('Panel (Penpot 21, "Painel / …")', () => {
  it('com título, é uma seção nomeada por ele, com o título em h2', () => {
    render(
      <Panel title="Resumo">
        <p>Linhas</p>
      </Panel>,
    );
    const section = screen.getByRole('region', { name: 'Resumo' });
    expect(within(section).getByRole('heading', { level: 2, name: 'Resumo' })).toHaveClass(
      'kore-panel__title',
    );
  });

  it('o h3 quando pedido e o espaço de formulário', () => {
    render(
      <Panel title="Quem paga" headingLevel={3} gap="md">
        <p>Campos</p>
      </Panel>,
    );
    const heading = screen.getByRole('heading', { level: 3, name: 'Quem paga' });
    expect(heading.closest('section')).toHaveClass('kore-panel', 'kore-panel--gap-md');
  });

  it('sem título, uma seção sem nome (não é região)', () => {
    render(
      <Panel>
        <p>Data de saída do ar</p>
      </Panel>,
    );
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });
});

it('o Painel sem violações de acessibilidade', async () => {
  const { container } = render(
    <Panel title="Resumo">
      <p>Linhas</p>
    </Panel>,
  );
  await expectNoA11yViolations({ container });
});
