import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { AccessLayout } from './access-layout';

describe('AccessLayout', () => {
  it('tem o painel da marca, o logo, o conteúdo no main e a linha legal', () => {
    render(
      <AccessLayout>
        <h1>Entre no Kore</h1>
      </AccessLayout>,
    );
    expect(screen.getByRole('complementary')).toHaveTextContent(
      'O casamento organizado, para o casal e para quem cuida dele.',
    );
    expect(screen.getAllByRole('img', { name: 'Kore' })).toHaveLength(2);
    expect(screen.getByRole('main')).toHaveTextContent('Entre no Kore');
    expect(
      screen.getByText(
        'Ao continuar, você concorda com os Termos de uso e a Política de privacidade do Kore.',
      ),
    ).toHaveClass('kore-access__legal');
  });

  it('é acessível', async () => {
    const { container } = render(
      <AccessLayout>
        <h1>Entre no Kore</h1>
      </AccessLayout>,
    );
    await expectNoA11yViolations({ container });
  });
});
