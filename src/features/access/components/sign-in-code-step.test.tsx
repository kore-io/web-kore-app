import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { SignInAlert } from './sign-in-alert';
import { formatCountdown, SignInCodeStep, type SignInCodeStepProps } from './sign-in-code-step';

function props(overrides: Partial<SignInCodeStepProps> = {}): SignInCodeStepProps {
  return {
    email: 'ana@exemplo.com',
    onSubmit: vi.fn(),
    resendSecondsLeft: 42,
    onResend: vi.fn(),
    onUseAnotherEmail: vi.fn(),
    ...overrides,
  };
}

describe('SignInCodeStep', () => {
  it('textos do Penpot com o e-mail e as 6 casas rotuladas (decisão 151)', () => {
    render(<SignInCodeStep {...props()} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Confira seu e-mail' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Enviamos um código de 6 números para ana@exemplo.com. Você também pode entrar pelo botão que está no mesmo e-mail.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Código de 6 números' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Número 1 de 6' })).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
  });

  it('Entrar só habilita com os 6 números e envia o código', async () => {
    const user = userEvent.setup();
    const stepProps = props();
    render(<SignInCodeStep {...stepProps} />);
    const submit = screen.getByRole('button', { name: 'Entrar' });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole('textbox', { name: 'Número 1 de 6' }));
    await user.keyboard('48190');
    expect(submit).toBeDisabled();
    await user.keyboard('5');
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(stepProps.onSubmit).toHaveBeenCalledWith({ code: '481905' });
  });

  it('reenviar: desabilitado com a contagem, link no zero, bloqueado com null', async () => {
    const user = userEvent.setup();
    const stepProps = props();
    const { rerender } = render(<SignInCodeStep {...stepProps} />);
    expect(screen.getByRole('button', { name: 'Reenviar código em 0:42' })).toBeDisabled();

    rerender(<SignInCodeStep {...stepProps} resendSecondsLeft={0} />);
    await user.click(screen.getByRole('button', { name: 'Reenviar código' }));
    expect(stepProps.onResend).toHaveBeenCalledTimes(1);

    rerender(<SignInCodeStep {...stepProps} resendSecondsLeft={null} />);
    expect(screen.getByRole('button', { name: 'Reenviar código' })).toBeDisabled();
  });

  it('Usar outro e-mail volta ao passo do e-mail', async () => {
    const user = userEvent.setup();
    const stepProps = props();
    render(<SignInCodeStep {...stepProps} />);
    await user.click(screen.getByRole('button', { name: 'Usar outro e-mail' }));
    expect(stepProps.onUseAnotherEmail).toHaveBeenCalledTimes(1);
  });

  it('mudar o resetKey limpa as casas (depois de reenviar ou de um código novo)', async () => {
    const user = userEvent.setup();
    const stepProps = props();
    const { rerender } = render(<SignInCodeStep {...stepProps} resetKey={1} />);
    await user.click(screen.getByRole('textbox', { name: 'Número 1 de 6' }));
    await user.keyboard('481');
    rerender(<SignInCodeStep {...stepProps} resetKey={2} />);
    expect(screen.getByRole('textbox', { name: 'Número 1 de 6' })).toHaveValue('');
  });

  it('formata a contagem em m:ss', () => {
    expect(formatCountdown({ seconds: 42 })).toBe('0:42');
    expect(formatCountdown({ seconds: 60 })).toBe('1:00');
    expect(formatCountdown({ seconds: 5 })).toBe('0:05');
  });

  it('é acessível, com o aviso de código errado', async () => {
    const { container } = render(
      <main>
        <SignInCodeStep
          {...props({
            invalid: true,
            notice: <SignInAlert notice={{ kind: 'wrong-code', attemptsLeft: 2 }} />,
          })}
        />
      </main>,
    );
    await expectNoA11yViolations({ container });
  });
});
