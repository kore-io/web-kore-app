import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { PartnerInviteStep, type PartnerInviteStepProps } from './partner-invite-step';

type SignedOutProps = Extract<PartnerInviteStepProps, { invitedEmail: string }>;

function props(overrides: Partial<SignedOutProps> = {}): SignedOutProps {
  return {
    inviterName: 'Ana',
    couple: 'Ana & Marcos',
    weddingDetails: 'sáb., 14 de nov. de 2026 · Campinas (SP)',
    invitedEmail: 'marcos.rocha@gmail.com',
    onContinueWithGoogle: vi.fn(),
    onSubmit: vi.fn(),
    onDecline: vi.fn(),
    ...overrides,
  };
}

describe('Convite do parceiro (decisão 156)', () => {
  it('textos neutros, o cartão do casamento e o e-\u2060mail do convite preenchido', async () => {
    const user = userEvent.setup();
    const stepProps = props();
    render(<PartnerInviteStep {...stepProps} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Ana convidou você para o casamento' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Entre para montar o site e a lista junto com Ana. Vocês terão as mesmas permissões.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Ana & Marcos')).toHaveClass('kore-wedding-summary__couple');
    expect(screen.getByRole('textbox', { name: 'E-\u2060mail' })).toHaveValue(
      'marcos.rocha@gmail.com',
    );
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));
    expect(stepProps.onSubmit).toHaveBeenCalledWith({ email: 'marcos.rocha@gmail.com' });
    await user.click(screen.getByRole('button', { name: 'Recusar convite' }));
    expect(stepProps.onDecline).toHaveBeenCalledTimes(1);
  });

  it('com sessão: só o Aceitar convite, sem o Google e o e-\u2060mail', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    render(
      <PartnerInviteStep
        signedIn
        onAccept={onAccept}
        inviterName="Ana"
        couple="Ana & Marcos"
        weddingDetails="x"
        onDecline={vi.fn()}
      />,
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Google/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('é acessível', async () => {
    const { container } = render(
      <main>
        <PartnerInviteStep {...props()} />
      </main>,
    );
    await expectNoA11yViolations({ container });
  });
});
