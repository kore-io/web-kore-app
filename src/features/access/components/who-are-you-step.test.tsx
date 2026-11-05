import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { WhoAreYouStep } from './who-are-you-step';

describe('Quem é você? (decisão 106)', () => {
  it('Continuar só habilita com o nome e o título, e envia no formato do contrato', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<WhoAreYouStep partnerNames={['Ana', 'Marcos']} onSubmit={onSubmit} />);
    expect(screen.getByRole('radiogroup', { name: 'Quem é você?' })).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Continuar' });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Marcos' }));
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Noivo' }));
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledWith({ partnerIndex: 2, myTitle: 'groom' });
  });

  it('funciona com os dois nomes iguais', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<WhoAreYouStep partnerNames={['Ana', 'Ana']} onSubmit={onSubmit} />);
    const [first, second] = screen.getAllByRole('radio', { name: 'Ana' });
    await user.click(second as HTMLElement);
    expect(first).not.toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Noiva' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(onSubmit).toHaveBeenCalledWith({ partnerIndex: 2, myTitle: 'bride' });
  });

  it('é acessível', async () => {
    const { container } = render(
      <main>
        <WhoAreYouStep partnerNames={['Ana', 'Marcos']} onSubmit={vi.fn()} />
      </main>,
    );
    await expectNoA11yViolations({ container });
  });
});
