import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PartyListItemResponse } from '../../../shared/api/generated/model';
import { PartyRowMenu } from './party-row-menu';

const party = {
  id: 'p1',
  name: 'Família Moreira',
  counts: { confirmed: 2, declined: 1, pending: 0, pendingPlusOnes: 0 },
} as PartyListItemResponse;

describe('o ⋮ do grupo na lista (Prazo e respostas RN08)', () => {
  it('com o grupo já respondido, a colaboradora vê o Mover para a lixeira desabilitado, com o motivo', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<PartyRowMenu party={party} trashLocked onAction={onAction} />);
    await user.click(screen.getByRole('button', { name: 'Ações de Família Moreira' }));
    const trash = screen.getByRole('menuitem', { name: 'Mover para a lixeira' });
    expect(trash).toHaveAttribute('aria-disabled', 'true');
    expect(trash).toHaveAccessibleDescription('Só o casal pode excluir um grupo que já respondeu.');
    await user.click(trash);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('sem a trava, o item chama a ação', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<PartyRowMenu party={party} onAction={onAction} />);
    await user.click(screen.getByRole('button', { name: 'Ações de Família Moreira' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mover para a lixeira' }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'trash' }));
  });
});
