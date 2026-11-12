import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { InviteInvalid } from './invite-invalid';
import { InviteOtherAccount } from './invite-other-account';

describe('Outra conta', () => {
  it('mostra os dois e-\u2060mails, o aviso e as duas saídas (Voz)', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onUseAnotherAccount = vi.fn();
    render(
      <InviteOtherAccount
        invitedEmail="marcos.rocha@gmail.com"
        currentEmail="marcos.vr@hotmail.com"
        onConfirm={onConfirm}
        onUseAnotherAccount={onUseAnotherAccount}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Confira a conta' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'O convite foi enviado para marcos.rocha@gmail.com, mas você entrou como marcos.vr@hotmail.com.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('O casamento vai ficar nesta conta')).toBeInTheDocument();
    expect(
      screen.getByText('Para entrar depois, use sempre marcos.vr@hotmail.com.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sim, usar marcos.vr@hotmail.com' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Entrar com outra conta' }));
    expect(onUseAnotherAccount).toHaveBeenCalledTimes(1);
  });

  it('é acessível', async () => {
    const { container } = render(
      <main>
        <InviteOtherAccount
          invitedEmail="a@exemplo.com"
          currentEmail="b@exemplo.com"
          onConfirm={vi.fn()}
          onUseAnotherAccount={vi.fn()}
        />
      </main>,
    );
    await expectNoA11yViolations({ container });
  });
});

describe('Convite inválido', () => {
  it('explica o motivo, sugere pedir outro e leva ao Entrar (Voz)', async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    render(<InviteInvalid onSignIn={onSignIn} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Este convite não vale mais' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Peça um convite novo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entrar no Kore' }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('é acessível', async () => {
    const { container } = render(
      <main>
        <InviteInvalid onSignIn={vi.fn()} />
      </main>,
    );
    await expectNoA11yViolations({ container });
  });
});
