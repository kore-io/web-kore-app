import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarCheck, LayoutDashboard, Users } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { ProfileOption } from './profile-option';
import { ProfilesStep } from './profiles-step';

function renderChoose({ onSelect = vi.fn(), onUseAnotherAccount = vi.fn() } = {}) {
  render(
    <main>
      <ProfilesStep
        title="Com qual perfil você quer entrar?"
        description="Juliana, sua conta tem dois perfis. Você pode trocar depois pelo menu, sem sair."
        onUseAnotherAccount={onUseAnotherAccount}
      >
        <ProfileOption
          icon={<LayoutDashboard />}
          title="Cerimonialista"
          description="Prado Assessoria · 12 casamentos"
          highlightLabel="Último usado"
          onSelect={onSelect}
        />
        <ProfileOption
          icon={<CalendarCheck />}
          title="Casamento Juliana & Tiago"
          description="sáb., 20 de mar. de 2027 · Valinhos (SP)"
          onSelect={vi.fn()}
        />
      </ProfilesStep>
    </main>,
  );
  return { onSelect, onUseAnotherAccount };
}

describe('Seleção de perfil', () => {
  it('cada perfil é um botão com título, apoio e o selo do último usado no nome', () => {
    renderChoose();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Com qual perfil você quer entrar?' }),
    ).toBeInTheDocument();
    const planner = screen.getByRole('button', {
      name: 'Cerimonialista Prado Assessoria · 12 casamentos Último usado',
    });
    expect(planner).toHaveClass('kore-profile-option--highlighted');
    expect(
      screen.getByRole('button', {
        name: 'Casamento Juliana & Tiago sáb., 20 de mar. de 2027 · Valinhos (SP)',
      }),
    ).not.toHaveClass('kore-profile-option--highlighted');
  });

  it('escolher um perfil e entrar com outra conta chamam o app', async () => {
    const user = userEvent.setup();
    const { onSelect, onUseAnotherAccount } = renderChoose();
    await user.click(screen.getByRole('button', { name: /^Cerimonialista/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Entrar com outra conta' }));
    expect(onUseAnotherAccount).toHaveBeenCalledTimes(1);
  });

  it('sem perfil: as duas escolhas, sem selo', () => {
    render(
      <ProfilesStep
        title="Como você quer usar o Kore?"
        description="Apoio"
        onUseAnotherAccount={vi.fn()}
      >
        <ProfileOption
          icon={<CalendarCheck />}
          title="Criar o site do casamento"
          description="Para o casal: site, lista de convidados e confirmações"
          onSelect={vi.fn()}
        />
        <ProfileOption
          icon={<Users />}
          title="Quero fazer parceria"
          description="Para cerimonialistas: todos os casamentos num painel e comissão por casal"
          onSelect={vi.fn()}
        />
      </ProfilesStep>,
    );
    expect(
      screen.getAllByRole('button', { name: /Criar o site|Quero fazer parceria/ }),
    ).toHaveLength(2);
    expect(screen.queryByText('Último usado')).toBeNull();
  });

  it('é acessível', async () => {
    renderChoose();
    await expectNoA11yViolations({ container: document.body });
  });
});
