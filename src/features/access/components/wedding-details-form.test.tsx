import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { WeddingDetailsForm } from './wedding-details-form';

describe('Cadastro — Dados do casamento', () => {
  it('envia os valores nos nomes do contrato', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onValuesChange = vi.fn();
    render(
      <WeddingDetailsForm
        onSubmit={onSubmit}
        onValuesChange={onValuesChange}
        slugStatus={{ kind: 'available', slug: 'ana-e-marcos' }}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Conte sobre o casamento' }),
    ).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Seu nome' }), 'Ana Beatriz Moreira');
    await user.click(screen.getByRole('radio', { name: 'Noiva' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Com quem você vai casar?' }),
      'Marcos Vinícius Rocha',
    );
    await user.type(screen.getByRole('textbox', { name: 'Cidade' }), 'Campinas');
    await user.selectOptions(screen.getByRole('combobox', { name: 'UF' }), 'SP');
    await user.type(screen.getByRole('textbox', { name: 'Endereço do site' }), 'ana-e-marcos');
    await user.click(screen.getByRole('button', { name: 'Criar nosso site' }));
    expect(onSubmit).toHaveBeenCalledWith({
      myName: 'Ana Beatriz Moreira',
      myTitle: 'bride',
      partnerName: 'Marcos Vinícius Rocha',
      eventDate: '',
      city: 'Campinas',
      state: 'SP',
      slug: 'ana-e-marcos',
    });
    expect(onValuesChange).toHaveBeenLastCalledWith(expect.objectContaining({ city: 'Campinas' }));
  });

  it('Criar nosso site só habilita com o endereço livre (RN05)', () => {
    const { rerender } = render(<WeddingDetailsForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Criar nosso site' })).toBeDisabled();
    rerender(
      <WeddingDetailsForm
        onSubmit={vi.fn()}
        slugStatus={{ kind: 'available', slug: 'ana-e-marcos' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Criar nosso site' })).toBeEnabled();
  });

  it('nomes e cidade com até 80 caracteres (decisão 166); o endereço pode vir de fora', () => {
    render(<WeddingDetailsForm onSubmit={vi.fn()} slugValue="ana-e-marcos" />);
    for (const name of ['Seu nome', 'Com quem você vai casar?', 'Cidade']) {
      expect(screen.getByRole('textbox', { name })).toHaveAttribute('maxlength', '80');
    }
    expect(screen.getByRole('textbox', { name: 'Endereço do site' })).toHaveValue('ana-e-marcos');
  });

  it('a pergunta noivo/noiva é um grupo com nome, e a UF tem as 27 siglas', () => {
    render(<WeddingDetailsForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Você é o noivo ou a noiva?' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('option').filter((option) => option.getAttribute('value')),
    ).toHaveLength(27);
    expect(screen.getByLabelText('Data do casamento')).toHaveAccessibleDescription(
      'Opcional. Se ainda não tiverem a data, deixem em branco.',
    );
  });

  it('endereço disponível em verde; em uso com a sugestão (Endereço em uso)', () => {
    const { rerender } = render(
      <WeddingDetailsForm
        onSubmit={vi.fn()}
        slugStatus={{ kind: 'available', slug: 'ana-e-marcos' }}
      />,
    );
    const available = screen.getByRole('textbox', { name: 'Endereço do site' });
    expect(available).toHaveAccessibleDescription('Disponível: kore.com.br/ana-e-marcos');
    expect(screen.getByText('kore.com.br/ana-e-marcos').closest('p')).toHaveClass(
      'kore-form-field__hint--success',
    );
    expect(screen.getByRole('button', { name: 'Criar nosso site' })).toBeEnabled();
    rerender(
      <WeddingDetailsForm
        onSubmit={vi.fn()}
        slugStatus={{ kind: 'taken', slug: 'ana-e-marcos', suggestion: 'ana-e-marcos-2026' }}
      />,
    );
    const slug = screen.getByRole('textbox', { name: 'Endereço do site' });
    expect(slug).toHaveAttribute('aria-invalid', 'true');
    expect(slug).toHaveAccessibleDescription(
      'kore.com.br/ana-e-marcos já está em uso. Que tal kore.com.br/ana-e-marcos-2026?',
    );
    // Decisão 161: o endereço não quebra no meio, e o botão espera um endereço livre.
    expect(screen.getByText('kore.com.br/ana-e-marcos-2026')).toHaveClass(
      'kore-wedding-details__address',
    );
    expect(screen.getByRole('button', { name: 'Criar nosso site' })).toBeDisabled();
  });

  it('erros por campo (decisão 155), inclusive no grupo noivo/noiva', () => {
    render(
      <WeddingDetailsForm
        onSubmit={vi.fn()}
        errors={{
          myName: 'Informe seu nome.',
          myTitle: 'Escolha noivo ou noiva.',
          state: 'Escolha a UF.',
        }}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Seu nome' })).toHaveAccessibleDescription(
      'Informe seu nome.',
    );
    expect(
      screen.getByRole('group', { name: 'Você é o noivo ou a noiva?' }),
    ).toHaveAccessibleDescription('Escolha noivo ou noiva.');
    expect(screen.getByRole('combobox', { name: 'UF' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('avisa o app quando o endereço muda (checagem de disponibilidade)', async () => {
    const user = userEvent.setup();
    const onSlugChange = vi.fn();
    render(<WeddingDetailsForm onSubmit={vi.fn()} onSlugChange={onSlugChange} />);
    await user.type(screen.getByRole('textbox', { name: 'Endereço do site' }), 'ab');
    expect(onSlugChange).toHaveBeenLastCalledWith({ slug: 'ab' });
  });

  it('é acessível', async () => {
    const { container } = render(
      <main>
        <WeddingDetailsForm
          onSubmit={vi.fn()}
          errors={{ myTitle: 'Escolha noivo ou noiva.' }}
          slugStatus={{ kind: 'taken', slug: 'a', suggestion: 'a-2026' }}
        />
      </main>,
    );
    await expectNoA11yViolations({ container });
  });
});
