import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

/**
 * O formulário da seção aberta, para o cabeçalho do Editor (Dados básicos RN10): o
 * Salvar grava a seção aberta, fica desabilitado sem mudança ou com erro que trava
 * (ex.: a cor bloqueada da Aparência), e a troca de seção com mudança pede o Dialog.
 */
export interface SectionForm {
  dirty: boolean;
  /** Falso quando há algo que trava o Salvar (ex.: contraste, S2 RN05). */
  canSave: boolean;
  /** Grava a seção; devolve se gravou. */
  save: () => Promise<boolean>;
}

const RegisterContext = createContext<(form: SectionForm | null) => void>(() => undefined);

export function SectionFormProvider({
  onChange,
  children,
}: {
  onChange: (form: SectionForm | null) => void;
  children: ReactNode;
}) {
  return <RegisterContext.Provider value={onChange}>{children}</RegisterContext.Provider>;
}

/** A seção aberta se registra no Editor; ao sair, some. O `save` é sempre o mais novo. */
export function useSectionForm({ dirty, canSave, save }: SectionForm) {
  const register = useContext(RegisterContext);
  const latestSave = useRef(save);
  useEffect(() => {
    latestSave.current = save;
  });
  useEffect(() => {
    register({ dirty, canSave, save: () => latestSave.current() });
  }, [register, dirty, canSave]);
  useEffect(() => () => register(null), [register]);
}
