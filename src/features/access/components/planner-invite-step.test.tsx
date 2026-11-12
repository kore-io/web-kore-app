import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { PlannerInviteStep, type PlannerInviteStepProps } from './planner-invite-step';

function props(overrides: Partial<PlannerInviteStepProps> = {}): PlannerInviteStepProps {
  return {
    couple: 'Ana & Marcos',
    weddingDetails: 'sáb., 14 de nov. de 2026 · Campinas (SP)',
    onAccept: vi.fn(),
    onDecline: vi.fn(),
    ...overrides,
  };
}

describe('Convite do cerimonialista (Penpot e Voz)', () => {
  it('textos, cartão do casamento, permissões e as duas ações', async () => {
    const user = userEvent.setup();
    const stepProps = props();
    render(<PlannerInviteStep {...stepProps} />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Ana e Marcos convidaram você como cerimonialista',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'O casamento vai aparecer em Meus casamentos, e você ajuda a montar o site e a lista.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Ana & Marcos')).toHaveClass('kore-wedding-summary__couple');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Editar o site, os convidados e os envios',
      'Acompanhar as respostas no painel',
      'Publicar, pagar ou mexer na chave Pix: só o casal',
    ]);
    expect(screen.queryByRole('textbox', { name: 'Seu nome' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));
    expect(stepProps.onAccept).toHaveBeenCalledWith({});
    await user.click(screen.getByRole('button', { name: 'Recusar convite' }));
    expect(stepProps.onDecline).toHaveBeenCalledTimes(1);
  });

  it('conta sem nome: o campo Seu nome vai no aceite (decisões 168(4) e 174(6))', async () => {
    const user = userEvent.setup();
    const stepProps = props({ needsName: true, nameError: 'Informe seu nome.' });
    render(<PlannerInviteStep {...stepProps} />);
    const name = screen.getByRole('textbox', { name: 'Seu nome' });
    expect(name).toHaveAccessibleDescription('Informe seu nome.');
    await user.type(name, '  Juliana Prado ');
    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }));
    expect(stepProps.onAccept).toHaveBeenCalledWith({ name: 'Juliana Prado' });
  });

  it('é acessível', async () => {
    const { container } = render(
      <main>
        <PlannerInviteStep {...props({ needsName: true })} />
      </main>,
    );
    await expectNoA11yViolations({ container });
  });
});
