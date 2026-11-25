import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../tests/a11y';
import { PaymentOption, PaymentOptionGroup } from './payment-option';

function options({
  onChange = vi.fn(),
  method = 'card',
}: { onChange?: () => void; method?: string } = {}) {
  return render(
    <section aria-labelledby="forma">
      <h2 id="forma">Forma de pagamento</h2>
      <PaymentOptionGroup labelledBy="forma">
        <PaymentOption
          name="method"
          value="pix"
          checked={method === 'pix'}
          onChange={onChange}
          label="Pix à vista · 3% de desconto"
        />
        <PaymentOption
          name="method"
          value="card"
          checked={method === 'card'}
          onChange={onChange}
          label="Cartão de crédito"
          caption="Em até 12x. Até 6x, sem juros."
        />
      </PaymentOptionGroup>
    </section>,
  );
}

describe('PaymentOption (Penpot 21, "Opção / Cartão de crédito")', () => {
  it('o grupo é um radiogroup nomeado pelo título do painel', () => {
    options();
    expect(screen.getByRole('radiogroup', { name: 'Forma de pagamento' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('a legenda descreve o Radio dela, e só ele', () => {
    options();
    expect(screen.getByRole('radio', { name: 'Cartão de crédito' })).toHaveAccessibleDescription(
      'Em até 12x. Até 6x, sem juros.',
    );
    expect(screen.getByRole('radio', { name: 'Pix à vista · 3% de desconto' })).not.toHaveAttribute(
      'aria-describedby',
    );
  });

  it('a descrição que o app passar fica junto com a da legenda', () => {
    render(
      <>
        <p id="motivo">Indisponível enquanto o site está bloqueado.</p>
        <PaymentOption
          name="method"
          value="card"
          label="Cartão de crédito"
          caption="Em até 12x. Até 6x, sem juros."
          aria-describedby="motivo"
          disabled
        />
      </>,
    );
    expect(screen.getByRole('radio', { name: 'Cartão de crédito' })).toHaveAccessibleDescription(
      'Indisponível enquanto o site está bloqueado. Em até 12x. Até 6x, sem juros.',
    );
  });

  it('escolher uma opção avisa o app, com o valor dela', async () => {
    const onChange = vi.fn();
    options({ onChange });
    await userEvent
      .setup()
      .click(screen.getByRole('radio', { name: 'Pix à vista · 3% de desconto' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0]?.[0] as { target: HTMLInputElement }).target.value).toBe('pix');
  });

  it('o toque na legenda escolhe a opção; desabilitada, não', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    options({ onChange, method: 'pix' });
    await user.click(screen.getByText('Em até 12x. Até 6x, sem juros.'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0]?.[0] as { target: HTMLInputElement }).target.value).toBe('card');
    // A legenda não entra no nome do Radio.
    expect(screen.getByRole('radio', { name: 'Cartão de crédito' })).toBeInTheDocument();

    const disabledChange = vi.fn();
    render(
      <PaymentOption
        name="other"
        value="card"
        disabled
        onChange={disabledChange}
        label="Cartão (outro)"
        caption="Legenda desabilitada"
      />,
    );
    await user.click(screen.getByText('Legenda desabilitada'));
    expect(disabledChange).not.toHaveBeenCalled();
  });

  it('sem violações de acessibilidade', async () => {
    const { container } = options();
    await expectNoA11yViolations({ container });
  });
});
