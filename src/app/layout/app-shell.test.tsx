import { NavItem } from '@kore-io/design';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LayoutDashboard } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../tests/a11y';
import { AppShell, type AppShellProps } from './app-shell';

function renderShell(overrides: Partial<AppShellProps> = {}) {
  const props: AppShellProps = {
    title: 'Ana & Marcos',
    user: { name: 'Ana Moreira', email: 'ana@exemplo.com', initials: 'AM' },
    activeProfile: 'Perfil ativo: Casal',
    userMenuGroups: [[{ id: 'logout', label: 'Sair', onSelect: vi.fn() }]],
    navigation: (
      <NavItem href="/app" icon={<LayoutDashboard />} current>
        Dashboard
      </NavItem>
    ),
    children: <h1>Conteúdo</h1>,
    ...overrides,
  };
  return render(<AppShell {...props} />);
}

describe('AppShell', () => {
  it('monta Sidebar, Topbar, Menu do usuário e conteúdo com os textos da decisão 149', () => {
    renderShell();
    const sidebar = screen.getByRole('complementary');
    expect(within(sidebar).getByRole('img', { name: 'Kore' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('navigation', { name: 'Menu principal' })).toContainElement(
      within(sidebar).getByRole('link', { name: 'Dashboard' }),
    );
    expect(screen.getByRole('banner')).toHaveTextContent('Ana & Marcos');
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menu do usuário' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Conteúdo');
    expect(screen.queryByRole('button', { name: /Notificações/ })).toBeNull();
  });

  it('o ☰ abre o drawer com o logo, a navegação e o fechar', async () => {
    const user = userEvent.setup();
    renderShell();
    const menuButton = screen.getByRole('button', { name: 'Abrir menu' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await user.click(menuButton);
    const drawer = screen.getByRole('dialog', { name: 'Menu principal' });
    expect(menuButton).toHaveAttribute('aria-controls', drawer.id);
    expect(within(drawer).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Fechar menu' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    [0, 'Notificações'],
    [1, 'Notificações, 1 não lida'],
    [3, 'Notificações, 3 não lidas'],
  ])('sino com %i não lidas: "%s"', async (unread, label) => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    renderShell({ notifications: { unread, onOpen } });
    await user.click(screen.getByRole('button', { name: label }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('é acessível', async () => {
    const { container } = renderShell({ notifications: { unread: 2, onOpen: vi.fn() } });
    await expectNoA11yViolations({ container });
  });
});
