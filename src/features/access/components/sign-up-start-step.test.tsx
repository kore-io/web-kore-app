import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { AccessLayout } from './access-layout';
import { SignUpStartStep, type SignUpStartStepProps } from './sign-up-start-step';

function props(overrides: Partial<SignUpStartStepProps> = {}): SignUpStartStepProps {
  return {
    onContinueWithGoogle: vi.fn(),
    onSubmit: vi.fn(),
    signInHref: '/entrar',
    plannerHref: 'https://kore.com.br/cerimonialistas',
    ...overrides,
  };
}

describe('Cadastro — Início', () => {
  it('textos do Penpot, Continuar e o rodapé', async () => {
    const user = userEvent.setup();
    const stepProps = props();
    render(<SignUpStartStep {...stepProps} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Crie o site do casamento' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('É grátis para montar. Vocês só pagam quando publicarem.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Indicação de/)).toBeNull();
    await user.type(screen.getByRole('textbox', { name: 'E-\u2060mail' }), 'ana@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(stepProps.onSubmit).toHaveBeenCalledWith({ email: 'ana@exemplo.com' });
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
    expect(screen.getByRole('link', { name: 'Fazer parceria' })).toHaveAttribute(
      'href',
      'https://kore.com.br/cerimonialistas',
    );
  });

  it('com indicação: o destaque com o nome e o desconto da API (decisão 155)', () => {
    render(
      <SignUpStartStep {...props({ referral: { name: 'Juliana Prado', discountPercent: 10 } })} />,
    );
    expect(screen.getByText('Indicação de Juliana Prado')).toBeInTheDocument();
    expect(
      screen.getByText('Vocês ganham 10% de desconto na ativação do site.'),
    ).toBeInTheDocument();
  });

  it('o painel do computador usa o texto do casal (decisão 154)', () => {
    render(
      <AccessLayout pitch="couple">
        <SignUpStartStep {...props()} />
      </AccessLayout>,
    );
    expect(screen.getByRole('complementary')).toHaveTextContent(
      'A lista de convidados organizada sozinha.',
    );
  });

  it('é acessível', async () => {
    const { container } = render(
      <main>
        <SignUpStartStep {...props({ referral: { name: 'Juliana Prado', discountPercent: 10 } })} />
      </main>,
    );
    await expectNoA11yViolations({ container });
  });
});
