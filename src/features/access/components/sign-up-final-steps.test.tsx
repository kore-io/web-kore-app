import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { AlreadyOwner } from './already-owner';
import { InvitePartnerStep } from './invite-partner-step';

describe('Você já tem um casamento', () => {
  it('explica e abre o casamento', async () => {
    const user = userEvent.setup();
    const onOpenWedding = vi.fn();
    render(<AlreadyOwner onOpenWedding={onOpenWedding} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Você já tem um casamento no Kore.' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Abrir meu casamento' }));
    expect(onOpenWedding).toHaveBeenCalledTimes(1);
  });
});

describe('Convidar o parceiro (textos neutros, decisão 155)', () => {
  it('usa o nome sem marcar gênero, envia o e-\u2060mail e permite deixar para depois', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onSkip = vi.fn();
    render(<InvitePartnerStep partnerName="Marcos" onSubmit={onSubmit} onSkip={onSkip} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Convide Marcos' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Marcos vai ter o próprio login, com as mesmas permissões que você. O convite vale por 30 dias.',
      ),
    ).toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: 'E-\u2060mail de Marcos' }),
      'marcos@exemplo.com',
    );
    await user.click(screen.getByRole('button', { name: 'Enviar convite' }));
    expect(onSubmit).toHaveBeenCalledWith({ email: 'marcos@exemplo.com' });
    await user.click(screen.getByRole('button', { name: 'Fazer isso depois' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Dá para convidar depois pelo Dashboard.')).toBeInTheDocument();
  });

  it('erro do e-\u2060mail ligado ao campo', () => {
    render(
      <InvitePartnerStep
        partnerName="Marcos"
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        emailError={'Informe um e-\u2060mail válido.'}
      />,
    );
    expect(
      screen.getByRole('textbox', { name: 'E-\u2060mail de Marcos' }),
    ).toHaveAccessibleDescription('Informe um e-\u2060mail válido.');
  });

  it('é acessível', async () => {
    const { container } = render(
      <main>
        <InvitePartnerStep partnerName="Marcos" onSubmit={vi.fn()} onSkip={vi.fn()} />
        <AlreadyOwner onOpenWedding={vi.fn()} />
      </main>,
    );
    await expectNoA11yViolations({ container });
  });

  it('sem o envio (antes da rota de convites), só o Fazer isso depois (decisão 169(3))', () => {
    render(<InvitePartnerStep partnerName="Marcos" onSkip={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Convide Marcos' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Enviar convite' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Fazer isso depois' })).toBeInTheDocument();
  });
});
