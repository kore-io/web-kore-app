import { Input } from '@kore-io/design';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../tests/a11y';
import { FormField } from './form-field';

describe('FormField', () => {
  it('liga rótulo, campo e ajuda; a ajuda em danger marca o erro', () => {
    render(
      <FormField label="Endereço do site" hint="Mensagem de erro" hintTone="danger">
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} />
        )}
      </FormField>,
    );
    const field = screen.getByRole('textbox', { name: 'Endereço do site' });
    expect(field).toHaveAccessibleDescription('Mensagem de erro');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Mensagem de erro')).toHaveClass('kore-form-field__hint--danger');
  });

  it('ajuda neutra ou de sucesso não marca erro; sem ajuda, sem descrição', () => {
    const { rerender } = render(
      <FormField label="Data" hint="Opcional." hintTone="neutral">
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} />
        )}
      </FormField>,
    );
    expect(screen.getByRole('textbox', { name: 'Data' })).not.toHaveAttribute('aria-invalid');
    rerender(
      <FormField label="Data">
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} />
        )}
      </FormField>,
    );
    expect(screen.getByRole('textbox', { name: 'Data' })).not.toHaveAttribute('aria-describedby');
  });

  it('é acessível', async () => {
    const { container } = render(
      <FormField label="Seu nome" hint="Ajuda" hintTone="success">
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} />
        )}
      </FormField>,
    );
    await expectNoA11yViolations({ container });
  });
});
