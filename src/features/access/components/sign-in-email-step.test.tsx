import { Alert } from '@kore-io/design';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { SignInEmailStep, type SignInEmailStepProps } from './sign-in-email-step';

function renderStep(overrides: Partial<SignInEmailStepProps> = {}) {
  const props: SignInEmailStepProps = {
    onContinueWithGoogle: vi.fn(),
    onSubmit: vi.fn(),
    signUpHref: '/cadastro',
    plannerHref: 'https://kore.com.br/para-cerimonialistas',
    ...overrides,
  };
  render(<SignInEmailStep {...props} />);
  return props;
}

describe('SignInEmailStep', () => {
  it('mostra os textos do Penpot e da Voz', () => {
    renderStep();
    expect(screen.getByRole('heading', { level: 1, name: 'Entre no Kore' })).toBeInTheDocument();
    expect(
      screen.getByText('Use sua conta Google ou receba um código no seu e-mail. Não tem senha.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeInTheDocument();
    expect(screen.getByText('ou')).toBeInTheDocument();
    const email = screen.getByRole('textbox', { name: 'E-mail' });
    expect(email).toHaveAttribute('placeholder', 'seu@email.com');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByRole('link', { name: 'Criar meu site' })).toHaveAttribute(
      'href',
      '/cadastro',
    );
    expect(screen.getByRole('link', { name: 'Fazer parceria' })).toHaveAttribute(
      'href',
      'https://kore.com.br/para-cerimonialistas',
    );
  });

  it('Google e Receber código chamam o app, com o e-mail sem espaços', async () => {
    const user = userEvent.setup();
    const props = renderStep();
    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }));
    expect(props.onContinueWithGoogle).toHaveBeenCalledTimes(1);
    await user.type(screen.getByRole('textbox', { name: 'E-mail' }), '  ana@exemplo.com ');
    await user.click(screen.getByRole('button', { name: 'Receber código' }));
    expect(props.onSubmit).toHaveBeenCalledWith({ email: 'ana@exemplo.com' });
  });

  it('erro do campo: aria-invalid e mensagem ligada ao campo', () => {
    renderStep({ emailError: 'Mensagem de erro' });
    const email = screen.getByRole('textbox', { name: 'E-mail' });
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('Mensagem de erro');
  });

  it('enviando: o botão fica desabilitado', () => {
    renderStep({ submitting: true });
    expect(screen.getByRole('button', { name: 'Receber código' })).toBeDisabled();
  });

  it('aviso no topo (ex.: Sessão expirada)', () => {
    renderStep({
      notice: (
        <Alert tone="info" title="Sua sessão terminou">
          Entre de novo para continuar. Suas informações estão salvas.
        </Alert>
      ),
    });
    expect(screen.getByText('Sua sessão terminou')).toBeInTheDocument();
  });

  it('é acessível', async () => {
    const { container } = render(
      <main>
        <SignInEmailStep
          onContinueWithGoogle={vi.fn()}
          onSubmit={vi.fn()}
          signUpHref="/cadastro"
          plannerHref="#"
          emailError="Mensagem de erro"
        />
      </main>,
    );
    await expectNoA11yViolations({ container });
  });
});
