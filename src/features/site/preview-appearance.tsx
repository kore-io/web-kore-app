import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { SiteEditorAppearanceResponse } from '../../shared/api/generated/model';

/**
 * A aparência em edição para a prévia ao lado (Aparência RN08): a seção Aparência manda
 * a última combinação válida (RN05); sem ela, a prévia usa a gravada.
 */
const PreviewContext = createContext<(appearance: SiteEditorAppearanceResponse | null) => void>(
  () => undefined,
);

export function PreviewAppearanceProvider({
  onChange,
  children,
}: {
  onChange: (appearance: SiteEditorAppearanceResponse | null) => void;
  children: ReactNode;
}) {
  return <PreviewContext.Provider value={onChange}>{children}</PreviewContext.Provider>;
}

export function usePreviewAppearance(appearance: SiteEditorAppearanceResponse) {
  const set = useContext(PreviewContext);
  const key = JSON.stringify(appearance);
  useEffect(() => {
    set(JSON.parse(key) as SiteEditorAppearanceResponse);
  }, [set, key]);
  useEffect(() => () => set(null), [set]);
}
