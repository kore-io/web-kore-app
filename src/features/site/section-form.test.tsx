import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SectionFormProvider, useSectionForm, type SectionForm } from './section-form';

function Form({ dirty, save }: { dirty: boolean; save: () => Promise<boolean> }) {
  useSectionForm({ dirty, canSave: true, save });
  return null;
}

describe('formulário da seção aberta (Dados básicos RN10)', () => {
  it('a seção se registra, avisa quando muda e some ao sair; o save chamado é o mais novo', async () => {
    const seen: (SectionForm | null)[] = [];
    const onChange = (form: SectionForm | null) => seen.push(form);
    const first = vi.fn(async () => true);
    const second = vi.fn(async () => true);
    const view = (visible: boolean, dirty: boolean) => (
      <SectionFormProvider onChange={onChange}>
        {visible && <Form dirty={dirty} save={dirty ? second : first} />}
      </SectionFormProvider>
    );
    const { rerender } = render(view(true, false));
    expect(seen.at(-1)?.dirty).toBe(false);
    rerender(view(true, true));
    expect(seen.at(-1)?.dirty).toBe(true);
    await seen.at(-1)?.save();
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    rerender(view(false, true));
    expect(seen.at(-1)).toBeNull();
  });
});
